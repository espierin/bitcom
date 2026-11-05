"""Optional EPT FastAPI extension. No EPT users, grants or measurements are modified.

Copy into ept_api, initialise(engine) during startup, then install(app).
Enable only after completing SETUP.txt. Supabase Data API stays disabled.
"""
import hashlib
import os
import re
import secrets
import time
from datetime import datetime, timezone
from uuid import UUID

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import Column, Float, MetaData, String, Table, delete, insert, select, text, update
from sqlalchemy.exc import IntegrityError

CALLBACK = 'https://espierin.github.io/bitcom/register.html'
WORKSHOP = 'efi-bitcom-2026-session-1'
metadata = MetaData()
registrations = Table('bitcom_registrations', metadata,
    Column('user_id', String(36), primary_key=True), Column('email', String(254), nullable=False),
    Column('workshop', String(80), nullable=False), Column('confirmed_at', String(80), nullable=False),
    Column('registered_at', Float, nullable=False), Column('last_seen', Float, nullable=False))
receipts = Table('bitcom_registration_receipts', metadata,
    Column('token_hash', String(64), primary_key=True), Column('user_id', String(36), nullable=False),
    Column('expires', Float, nullable=False))
limits = Table('bitcom_registration_limits', metadata,
    Column('key', String(80), primary_key=True), Column('until', Float, nullable=False),
    Column('count', Float, nullable=False))

def initialise(engine):
    with engine.begin() as c:
        metadata.create_all(c)
        if engine.dialect.name == 'postgresql':
            for table in metadata.sorted_tables:
                c.execute(text(f'ALTER TABLE "{table.name}" ENABLE ROW LEVEL SECURITY'))
                c.execute(text(f'REVOKE ALL ON TABLE "{table.name}" FROM anon, authenticated'))

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
    token_hash: str = Field(default='', max_length=512)
    access_token: str = Field(default='', max_length=8192)
    remember: bool = False

class Resume(Email):
    receipt: str = Field(min_length=32, max_length=128)

class Revoke(BaseModel):
    model_config = ConfigDict(extra='forbid')
    receipt: str = Field(min_length=32, max_length=128)

def install(app):
    router = APIRouter(prefix='/api/bitcom/registration')

    def available():
        s = app.state.settings
        return (os.getenv('BITCOM_REGISTRATION_ENABLED') == 'true'
                and s.supabase_url.startswith('https://') and bool(s.supabase_public_key))

    def ready():
        if not available():
            raise HTTPException(503, 'registration_not_open')

    def rate(key, maximum, seconds):
        now = time.time()
        try:
            with app.state.engine.begin() as c:
                c.execute(delete(limits).where(limits.c.until < now))
                row = c.execute(select(limits).where(limits.c.key == key).with_for_update()).mappings().first()
                if row:
                    if row['count'] >= maximum:
                        raise HTTPException(429, 'try_later', headers={'Retry-After': str(max(1, int(row['until']-now)))})
                    c.execute(update(limits).where(limits.c.key == key).values(count=row['count']+1))
                else:
                    c.execute(insert(limits).values(key=key, until=now+seconds, count=1))
        except IntegrityError:
            raise HTTPException(429, 'try_later', headers={'Retry-After': '60'})

    def identity(method, path, *, payload=None, token=None, params=None):
        s = app.state.settings
        headers = {'apikey': s.supabase_public_key}
        if token:
            headers['Authorization'] = 'Bearer '+token
        try:
            r = httpx.request(method, s.supabase_url.rstrip('/')+'/auth/v1'+path,
                              json=payload, params=params, headers=headers, timeout=20)
        except httpx.HTTPError:
            raise HTTPException(503, 'email_service_unavailable')
        if r.status_code == 429:
            raise HTTPException(429, 'try_later', headers={'Retry-After':'60'})
        if not r.is_success:
            raise HTTPException(400 if path != '/otp' else 503,
                                'confirmation_invalid_or_expired' if path != '/otp' else 'email_service_unavailable')
        try:
            return r.json()
        except ValueError:
            raise HTTPException(503, 'email_service_unavailable')

    def summary(row):
        return {'email':row['email'], 'workshop':row['workshop'], 'confirmed_at':row['confirmed_at'],
                'registered_at':datetime.fromtimestamp(row['registered_at'], timezone.utc).isoformat()}

    @router.get('/status')
    def status():
        return {'enabled':available(), 'workshop':WORKSHOP}

    @router.post('/request')
    def request_link(body: Email):
        ready()
        # Shared classroom networks do not get an artificial ten-person IP cap.
        rate('send-global', 120, 3600)
        rate('send-'+digest(body.email), 1, 60)
        identity('POST', '/otp', payload={'email':body.email, 'create_user':True},
                 params={'redirect_to':CALLBACK})
        return {'accepted':True}

    @router.post('/confirm')
    def confirm(body: Confirm):
        ready()
        rate('verify-global', 240, 3600)
        if bool(body.token_hash) == bool(body.access_token):
            raise HTTPException(400, 'confirmation_invalid_or_expired')
        if body.token_hash:
            user = identity('POST','/verify',payload={'token_hash':body.token_hash,'type':'email'}).get('user',{})
        else:
            user = identity('GET','/user',token=body.access_token)
        try:
            user_id = str(UUID(user['id']))
            email = normalise(user['email'])
            confirmed = user['email_confirmed_at']
            if not confirmed or email != body.email:
                raise ValueError()
        except (KeyError, ValueError, TypeError):
            raise HTTPException(400, 'email_does_not_match_confirmation')
        now = time.time()
        token = secrets.token_urlsafe(32)
        duration = 30*86400 if body.remember else 12*3600
        with app.state.engine.begin() as c:
            row = c.execute(select(registrations).where(registrations.c.user_id==user_id)).mappings().first()
            if row:
                c.execute(update(registrations).where(registrations.c.user_id==user_id)
                          .values(email=email, confirmed_at=confirmed, last_seen=now))
            else:
                c.execute(insert(registrations).values(user_id=user_id,email=email,workshop=WORKSHOP,
                          confirmed_at=confirmed,registered_at=now,last_seen=now))
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

    @router.post('/forget')
    def forget(body: Revoke):
        ready()
        with app.state.engine.begin() as c:
            c.execute(delete(receipts).where(receipts.c.token_hash==digest(body.receipt)))
        return {'forgotten':True}

    app.include_router(router)
