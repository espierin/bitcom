"""Offline tests. Identity responses are mocked; no emails or production writes."""
import os
import unittest
from types import SimpleNamespace
from unittest.mock import patch
import httpx
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select, update
from sqlalchemy.pool import StaticPool
import bitcom_registration as module

USER={'id':'12345678-1234-4234-8234-123456789abc','email':'participant@example.org',
      'email_confirmed_at':'2026-11-05T10:00:00Z'}

class RegistrationTests(unittest.TestCase):
    def setUp(self):
        self.env=patch.dict(os.environ,{'BITCOM_REGISTRATION_ENABLED':'true'});self.env.start()
        self.engine=create_engine('sqlite://',connect_args={'check_same_thread':False},poolclass=StaticPool)
        module.initialise(self.engine)
        self.app=FastAPI();self.app.state.engine=self.engine
        self.app.state.settings=SimpleNamespace(supabase_url='https://identity.invalid',supabase_public_key='test-key')
        module.install(self.app);self.client=TestClient(self.app)
        self.provider=patch.object(module.httpx,'request',return_value=httpx.Response(200,json={'user':USER}))
        self.request=self.provider.start()

    def tearDown(self):
        self.provider.stop();self.env.stop();self.engine.dispose()

    def post(self,path,body):
        return self.client.post('/api/bitcom/registration/'+path,json=body)

    def confirm(self,**extra):
        return self.post('confirm',{'email':USER['email'],'token_hash':'valid-test-hash',**extra})

    def test_disabled_does_not_send_or_write(self):
        os.environ['BITCOM_REGISTRATION_ENABLED']='false'
        self.assertEqual(self.post('request',{'email':USER['email']}).status_code,503)
        self.request.assert_not_called()

    def test_syntax_validation_before_provider(self):
        for email in ('abc','a@b','a b@example.org','<script>@example.org'):
            self.assertEqual(self.post('request',{'email':email}).status_code,422)
        self.request.assert_not_called()

    def test_fixed_redirect_and_email_cooldown(self):
        self.assertEqual(self.post('request',{'email':USER['email']}).status_code,200)
        self.assertEqual(self.request.call_args.kwargs['params']['redirect_to'],module.CALLBACK)
        self.assertEqual(self.post('request',{'email':USER['email']}).status_code,429)
        with self.engine.connect() as c:self.assertEqual(len(c.execute(select(module.registrations)).all()),0)

    def test_unconfirmed_or_wrong_email_not_registered(self):
        self.assertEqual(self.confirm(email='other@example.org').status_code,400)
        self.request.return_value=httpx.Response(200,json={'user':{**USER,'email_confirmed_at':None}})
        self.assertEqual(self.confirm().status_code,400)
        with self.engine.connect() as c:self.assertEqual(len(c.execute(select(module.registrations)).all()),0)

    def test_invalid_provider_token(self):
        self.request.return_value=httpx.Response(403,json={'message':'invalid'})
        self.assertEqual(self.confirm().status_code,400)

    def test_confirm_resume_wrong_email_expiry_and_forget(self):
        response=self.confirm(remember=True);self.assertEqual(response.status_code,200)
        token=response.json()['receipt']
        with self.engine.connect() as c:
            row=c.execute(select(module.receipts)).mappings().one()
            self.assertEqual(row['token_hash'],module.digest(token));self.assertNotEqual(row['token_hash'],token)
        self.assertEqual(self.post('resume',{'email':USER['email'],'receipt':token}).status_code,200)
        self.assertEqual(self.post('resume',{'email':'someone@example.org','receipt':token}).status_code,401)
        self.assertEqual(self.post('resume',{'email':USER['email'],'receipt':'x'*43}).status_code,401)
        with self.engine.begin() as c:c.execute(update(module.receipts).values(expires=0))
        self.assertEqual(self.post('resume',{'email':USER['email'],'receipt':token}).status_code,401)
        new=self.confirm().json()['receipt']
        self.assertEqual(self.post('forget',{'receipt':new}).status_code,200)
        self.assertEqual(self.post('resume',{'email':USER['email'],'receipt':new}).status_code,401)
        with self.engine.connect() as c:self.assertEqual(len(c.execute(select(module.registrations)).all()),1)

    def test_40_distinct_addresses_not_blocked_as_one_classroom(self):
        for i in range(40):
            self.assertEqual(self.post('request',{'email':f'participant{i}@example.org'}).status_code,200)
        self.assertEqual(self.request.call_count,40)

    def test_no_participant_list_endpoint(self):
        self.assertEqual(self.client.get('/api/bitcom/registration/participants').status_code,404)

if __name__=='__main__':unittest.main()
