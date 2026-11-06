"""Optional EPT FastAPI extension. No EPT users, grants or measurements are modified.

Copy into ept_api, initialise(engine) during startup, then install(app).
Enable only after completing SETUP.txt. Supabase Data API stays disabled.
"""
import hashlib
import json
import os
import re
import secrets
import smtplib
import ssl
import time
from datetime import datetime, timezone
from email.headerregistry import Address
from email.message import EmailMessage
from email.utils import parseaddr
from html import escape
from uuid import uuid4

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import Column, Float, Integer, MetaData, String, Table, Text, delete, insert, select, text, update
from sqlalchemy.exc import IntegrityError

CALLBACK = 'https://espierin.github.io/bitcom/register.html'
WORKSHOP = 'efi-bitcom-2026-session-1'
CASE_NUMBERS = tuple(f'{n:02}' for n in range(1, 7))
TASKS = {
    f'step-{task}' for task in (
        '1.1 1.2 1.3 2.1 2.2 2.3 2.4 2.5 2.6 2.7 '
        '3.0 3.1 3.1.1 3.1.2 3.1.3 3.2 3.2.1 3.2.2 3.2.3 '
        '3.3 3.3.1 3.3.2 3.3.3 3.3.4 3.3.5 3.3.6 '
        '4.1 4.2 4.3 4.4 4.4.1 4.4.2 4.4.3 4.5 4.6 4.7 4.8'
    ).split()
}
metadata = MetaData()
registrations = Table('bitcom_registrations', metadata,
    Column('user_id', String(36), primary_key=True), Column('email', String(254), nullable=False, unique=True),
    Column('workshop', String(80), nullable=False), Column('confirmed_at', String(80), nullable=False),
    Column('registered_at', Float, nullable=False), Column('last_seen', Float, nullable=False))
receipts = Table('bitcom_registration_receipts', metadata,
    Column('token_hash', String(64), primary_key=True), Column('user_id', String(36), nullable=False),
    Column('expires', Float, nullable=False))
limits = Table('bitcom_registration_limits', metadata,
    Column('key', String(80), primary_key=True), Column('until', Float, nullable=False),
    Column('count', Float, nullable=False))
links = Table('bitcom_registration_links', metadata,
    Column('email', String(254), primary_key=True), Column('token_hash', String(64), nullable=False),
    Column('expires', Float, nullable=False))
work = Table('bitcom_saved_work', metadata,
    Column('user_id', String(36), primary_key=True), Column('kind', String(12), primary_key=True),
    Column('revision', Integer, nullable=False), Column('data', Text, nullable=False))
runs = Table('bitcom_case_runs', metadata,
    Column('user_id', String(36), primary_key=True), Column('id', String(36), primary_key=True),
    Column('case_number', String(2)), Column('started_at', Float, nullable=False),
    Column('archived_at', Float))
run_work = Table('bitcom_case_work', metadata,
    Column('user_id', String(36), primary_key=True), Column('run_id', String(36), primary_key=True),
    Column('kind', String(12), primary_key=True), Column('revision', Integer, nullable=False),
    Column('data', Text, nullable=False))

def initialise(engine):
    with engine.begin() as c:
        metadata.create_all(c)
        if engine.dialect.name == 'postgresql':
            for table in metadata.sorted_tables:
                c.execute(text(f'ALTER TABLE "{table.name}" ENABLE ROW LEVEL SECURITY'))
                c.execute(text(f'REVOKE ALL ON TABLE "{table.name}" FROM PUBLIC, anon, authenticated'))

def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()

def normalise(value):
    value = value.strip().lower()
    if len(value) > 254 or not re.fullmatch(r'[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+', value):
        raise ValueError('Enter a valid email address.')
    return value

class Email(BaseModel):
    model_config = ConfigDict(extra='forbid')
    email: str = Field(min_length=3, max_length=254)
    _email = field_validator('email')(normalise)

class Confirm(Email):
    token: str = Field(min_length=32, max_length=128)
    remember: bool = False

class Resume(Email):
    receipt: str = Field(min_length=32, max_length=128)

class Revoke(BaseModel):
    model_config = ConfigDict(extra='forbid')
    receipt: str = Field(min_length=32, max_length=128)

class RunRequest(Revoke):
    run_id: str | None = Field(default=None, pattern=r'^[a-f0-9-]{36}$')

class Save(RunRequest):
    kind: str = Field(pattern=r'^(progress|workbook)$')
    revision: int = Field(ge=0)
    data: dict

def send_link(settings, address, token):
    url = f'{CALLBACK}#bitcom_token={token}'
    message = EmailMessage()
    # Keep the relay's authorised mailbox; brand only the BITCom message.
    message['From'] = Address(display_name='EFI BITCom', addr_spec=parseaddr(settings.smtp_sender)[1])
    message['To'] = address
    message['Subject'] = 'Your EFI BITCom workshop sign-in link'
    message.set_content(
        'Open the link and confirm your address to sign in to the EFI BITCom workshop.\n'
        'The link can be used once within 20 minutes.\n\n'
        f'{url}\n\n'
        'If you did not request this link, you can ignore this email.\n'
    )
    message.add_alternative(
        '<p>Confirm your email address to sign in to the EFI BITCom workshop.</p>'
        f'<p><a href="{escape(url, quote=True)}">Confirm email and sign in</a></p>'
        '<p>You can use this link once within 20 minutes.</p>'
        '<p>If you did not request this link, you can ignore this email.</p>',
        subtype='html',
    )
    context = ssl.create_default_context()
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
        smtp.starttls(context=context)
        if settings.smtp_user:
            smtp.login(settings.smtp_user, settings.smtp_password)
        smtp.send_message(message)

def validate_work(kind, value):
    if kind == 'workbook':
        if len(value) > 30 or any(not re.fullmatch(r'[a-z][a-z0-9_]{0,59}', key)
                                  or not isinstance(note, str) or len(note) > 30000
                                  for key, note in value.items()):
            raise HTTPException(422, 'invalid_workbook')
    else:
        def task_id(v):
            return isinstance(v, str) and v in TASKS
        completed = value.get('completed')
        last = value.get('last')
        updated = value.get('updatedAt')
        if (set(value) - {'completed', 'last', 'updatedAt'} or
            not isinstance(completed, list) or len(completed) > 37 or
            not all(task_id(task) for task in completed) or
            (last is not None and not task_id(last)) or
            (updated is not None and (not isinstance(updated, str) or len(updated) > 40))):
            raise HTTPException(422, 'invalid_progress')
    encoded = json.dumps(value, ensure_ascii=False)
    if len(encoded.encode()) > 850000:
        raise HTTPException(413, 'work_too_large')
    return encoded

def install(app):
    router = APIRouter(prefix='/api/bitcom/registration')

    def available():
        s = app.state.settings
        return (os.getenv('BITCOM_REGISTRATION_ENABLED') == 'true'
                and bool(getattr(app.state, 'bitcom_ready', False))
                and bool(s.smtp_host and s.smtp_sender))

    def ready():
        if not available():
            raise HTTPException(503, 'registration_not_open')

    def rate(key, maximum, seconds):
        now = time.time()
        try:
            with app.state.engine.begin() as c:
                # Serialize the first request in a new window on Postgres.
                if app.state.engine.dialect.name == 'postgresql':
                    c.execute(text('SELECT pg_advisory_xact_lock(hashtext(:key)::bigint)'), {'key':key})
                c.execute(delete(limits).where(limits.c.key == key, limits.c.until < now))
                row = c.execute(select(limits).where(limits.c.key == key).with_for_update()).mappings().first()
                if row:
                    if row['count'] >= maximum:
                        raise HTTPException(429, 'try_later', headers={'Retry-After': str(max(1, int(row['until']-now)))})
                    c.execute(update(limits).where(limits.c.key == key).values(count=row['count']+1))
                else:
                    c.execute(insert(limits).values(key=key, until=now+seconds, count=1))
        except IntegrityError:
            raise HTTPException(429, 'try_later', headers={'Retry-After': '60'})

    def summary(row):
        return {'email':row['email'], 'workshop':row['workshop'], 'confirmed_at':row['confirmed_at'],
                'scope':row['user_id'],
                'registered_at':datetime.fromtimestamp(row['registered_at'], timezone.utc).isoformat()}

    def participant(connection, receipt):
        row = connection.execute(
            select(registrations).join(receipts, registrations.c.user_id == receipts.c.user_id)
            .where(receipts.c.token_hash == digest(receipt), receipts.c.expires > time.time())
            .with_for_update(of=registrations)
        ).mappings().first()
        if row is None:
            raise HTTPException(401, 'confirmation_required')
        return row

    def account_runs(connection, user_id):
        return connection.execute(select(runs).where(runs.c.user_id == user_id)
                                  .order_by(runs.c.started_at.desc())).mappings().all()

    def create_run(connection, user_id, case_number, archived=False):
        run_id = str(uuid4())
        now = time.time()
        connection.execute(insert(runs).values(user_id=user_id, id=run_id,
            case_number=case_number, started_at=now, archived_at=now if archived else None))
        return run_id

    def ensure_runs(connection, user_id):
        if account_runs(connection, user_id):
            return
        legacy = connection.execute(select(work).where(work.c.user_id == user_id)).mappings().all()
        previous_case = None
        notes = next((json.loads(row['data']) for row in legacy if row['kind'] == 'workbook'), {})
        # Only adopt an old assignment when the participant recorded the exact input.
        filenames = set(re.findall(r'\bcase-(0[1-6])-genomic\.fasta\b',
            ' '.join(notes.get(field, '') for field in ('case', 'context', 'synthetic')), re.I))
        if len(filenames) == 1:
            previous_case = filenames.pop()
        if legacy:
            previous = create_run(connection, user_id, previous_case, archived=previous_case is None)
            for row in legacy:
                connection.execute(insert(run_work).values(user_id=user_id, run_id=previous,
                    kind=row['kind'], revision=row['revision'], data=row['data']))
        if previous_case is None:
            create_run(connection, user_id, secrets.choice(CASE_NUMBERS))

    def profile_data(connection, owner):
        user_id = owner['user_id']
        progress_rows = connection.execute(select(run_work.c.run_id, run_work.c.data)
            .where(run_work.c.user_id == user_id, run_work.c.kind == 'progress'))
        progress = {run_id: json.loads(data) for run_id, data in progress_rows}
        records = []
        for row in account_runs(connection, user_id):
            saved = progress.get(row['id'], {})
            complete = set(saved.get('completed', ())) == TASKS
            records.append({'id':row['id'], 'case':row['case_number'],
                            'started_at':row['started_at'], 'active':row['archived_at'] is None,
                            'completed':len(set(saved.get('completed', ())) & TASKS),
                            'last':saved.get('last'), 'complete':complete})
        active = next(record for record in records if record['active'])
        used = {record['case'] for record in records}
        return {'email':owner['email'], 'active':active, 'runs':records, 'total':len(TASKS),
                'remaining':len(set(CASE_NUMBERS) - used)}

    def work_query(connection, user_id, run_id, writable=False):
        if run_id is None:
            if writable and account_runs(connection, user_id):
                raise HTTPException(409, 'refresh_required')
            return work, (work.c.user_id == user_id,)
        row = connection.execute(select(runs.c.archived_at)
            .where(runs.c.user_id == user_id, runs.c.id == run_id)).first()
        if row is None:
            raise HTTPException(404, 'workbook_not_found')
        if writable and row.archived_at is not None:
            raise HTTPException(409, 'case_archived')
        return run_work, (run_work.c.user_id == user_id, run_work.c.run_id == run_id)

    @router.get('/status')
    def status():
        return {'enabled':available(), 'workshop':WORKSHOP, 'case_runs':True}

    @router.post('/request')
    def request_link(body: Email):
        ready()
        # Shared classroom networks do not get an artificial ten-person IP cap.
        rate('send-global', 120, 3600)
        rate('send-'+digest(body.email), 1, 60)
        token = secrets.token_urlsafe(32)
        hashed = digest(token)
        now = time.time()
        with app.state.engine.begin() as c:
            c.execute(delete(links).where((links.c.email == body.email) | (links.c.expires < now)))
            c.execute(insert(links).values(email=body.email, token_hash=hashed, expires=now+1200))
            c.execute(delete(limits).where(limits.c.until < now))
        try:
            send_link(app.state.settings, body.email, token)
        except (smtplib.SMTPException, OSError, ValueError):
            with app.state.engine.begin() as c:
                c.execute(delete(links).where(links.c.email == body.email, links.c.token_hash == hashed))
            raise HTTPException(503, 'email_service_unavailable')
        return {'accepted':True}

    @router.post('/confirm')
    def confirm(body: Confirm):
        ready()
        rate('verify-global', 240, 3600)
        now = time.time()
        token = secrets.token_urlsafe(32)
        duration = 30*86400 if body.remember else 12*3600
        with app.state.engine.begin() as c:
            consumed = c.execute(delete(links).where(links.c.email == body.email,
                links.c.token_hash == digest(body.token), links.c.expires > now))
            if consumed.rowcount != 1:
                raise HTTPException(400, 'confirmation_invalid_or_expired')
            row = c.execute(select(registrations).where(registrations.c.email == body.email)).mappings().first()
            if row:
                user_id = row['user_id']
                c.execute(update(registrations).where(registrations.c.user_id==user_id)
                          .values(last_seen=now))
            else:
                user_id = str(uuid4())
                c.execute(insert(registrations).values(user_id=user_id,email=body.email,workshop=WORKSHOP,
                          confirmed_at=datetime.now(timezone.utc).isoformat(),registered_at=now,last_seen=now))
            c.execute(delete(receipts).where(receipts.c.expires < now))
            c.execute(insert(receipts).values(token_hash=digest(token),user_id=user_id,expires=now+duration))
            row = c.execute(select(registrations).where(registrations.c.user_id==user_id)).mappings().one()
        return {**summary(row), 'receipt':token, 'expires':now+duration}

    @router.post('/resume')
    def resume(body: Resume):
        ready()
        now = time.time()
        with app.state.engine.begin() as c:
            row = c.execute(select(registrations).join(receipts,registrations.c.user_id==receipts.c.user_id)
                            .where(receipts.c.token_hash==digest(body.receipt),receipts.c.expires>now,
                                   registrations.c.email==body.email)).mappings().first()
            if row is None:
                raise HTTPException(401, 'confirmation_required')
            c.execute(update(registrations).where(registrations.c.user_id==row['user_id']).values(last_seen=now))
        return summary(row)

    @router.post('/profile')
    def profile(body: Revoke):
        ready()
        with app.state.engine.begin() as c:
            owner = participant(c, body.receipt)
            ensure_runs(c, owner['user_id'])
            return profile_data(c, owner)

    @router.post('/new-run')
    def new_run(body: RunRequest):
        ready()
        with app.state.engine.begin() as c:
            owner = participant(c, body.receipt)
            ensure_runs(c, owner['user_id'])
            current = profile_data(c, owner)
            active = current['active']
            if active['id'] != body.run_id or not active['complete']:
                raise HTTPException(409, 'finish_active_case')
            available_cases = sorted(set(CASE_NUMBERS) - {record['case'] for record in current['runs']})
            if not available_cases:
                raise HTTPException(409, 'no_cases_remaining')
            c.execute(update(runs).where(runs.c.user_id == owner['user_id'], runs.c.id == active['id'])
                      .values(archived_at=time.time()))
            create_run(c, owner['user_id'], secrets.choice(available_cases))
            return profile_data(c, owner)

    @router.post('/load')
    def load(body: RunRequest):
        ready()
        with app.state.engine.begin() as c:
            owner = participant(c, body.receipt)
            table, query = work_query(c, owner['user_id'], body.run_id)
            rows = c.execute(select(table).where(*query)).mappings()
            return {row['kind']: {'revision':row['revision'], 'data':json.loads(row['data'])} for row in rows}

    @router.post('/save')
    def save(body: Save):
        ready()
        encoded = validate_work(body.kind, body.data)
        with app.state.engine.begin() as c:
            owner = participant(c, body.receipt)
            table, scope = work_query(c, owner['user_id'], body.run_id, writable=True)
            query = (*scope, table.c.kind == body.kind)
            revision = c.execute(select(table.c.revision).where(*query)).scalar_one_or_none()
            if body.revision != (revision or 0):
                raise HTTPException(409, 'newer_server_copy')
            next_revision = body.revision+1
            if revision is None:
                values = {'user_id':owner['user_id'], 'kind':body.kind,
                          'revision':next_revision, 'data':encoded}
                if body.run_id is not None:
                    values['run_id'] = body.run_id
                c.execute(insert(table).values(**values))
            else:
                c.execute(update(table).where(*query).values(revision=next_revision, data=encoded))
            return {'revision':next_revision}

    @router.post('/forget')
    def forget(body: Revoke):
        ready()
        with app.state.engine.begin() as c:
            c.execute(delete(receipts).where(receipts.c.token_hash==digest(body.receipt)))
        return {'forgotten':True}

    app.include_router(router)
