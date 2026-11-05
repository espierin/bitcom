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

class Save(Revoke):
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
            return isinstance(v, str) and re.fullmatch(r'step-[1-4](\.\d+){1,2}', v)
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

    @router.get('/status')
    def status():
        return {'enabled':available(), 'workshop':WORKSHOP}

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

    @router.post('/load')
    def load(body: Revoke):
        ready()
        with app.state.engine.begin() as c:
            owner = participant(c, body.receipt)
            rows = c.execute(select(work).where(work.c.user_id == owner['user_id'])).mappings()
            return {row['kind']: {'revision':row['revision'], 'data':json.loads(row['data'])} for row in rows}

    @router.post('/save')
    def save(body: Save):
        ready()
        encoded = validate_work(body.kind, body.data)
        with app.state.engine.begin() as c:
            owner = participant(c, body.receipt)
            query = (work.c.user_id == owner['user_id'], work.c.kind == body.kind)
            revision = c.execute(select(work.c.revision).where(*query)).scalar_one_or_none()
            if body.revision != (revision or 0):
                raise HTTPException(409, 'newer_server_copy')
            next_revision = body.revision+1
            if revision is None:
                c.execute(insert(work).values(user_id=owner['user_id'], kind=body.kind,
                          revision=next_revision, data=encoded))
            else:
                c.execute(update(work).where(*query).values(revision=next_revision, data=encoded))
            return {'revision':next_revision}

    @router.post('/forget')
    def forget(body: Revoke):
        ready()
        with app.state.engine.begin() as c:
            c.execute(delete(receipts).where(receipts.c.token_hash==digest(body.receipt)))
        return {'forgotten':True}

    app.include_router(router)
