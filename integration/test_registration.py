"""Exercise email confirmation and account-isolated storage without sending SMTP."""
import os
import smtplib
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select, update
from sqlalchemy.pool import StaticPool
import bitcom_registration as module


class RegistrationTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {'BITCOM_REGISTRATION_ENABLED':'true'})
        self.env.start()
        self.engine = create_engine('sqlite://',connect_args={'check_same_thread':False},poolclass=StaticPool)
        module.initialise(self.engine)
        app = FastAPI()
        app.state.engine = self.engine
        app.state.bitcom_ready = True
        app.state.settings = SimpleNamespace(smtp_host='smtp.invalid', smtp_sender='workshop@example.org')
        module.install(app)
        self.client = TestClient(app)
        self.mail = patch.object(module,'send_link').start()
        self.addCleanup(patch.stopall)
        self.addCleanup(self.engine.dispose)
        self.email = 'participant@example.org'

    def post(self, route, body):
        return self.client.post('/api/bitcom/registration/'+route,json=body)

    def link(self, email=None):
        assert self.post('request',{'email':email or self.email}).status_code == 200
        return self.mail.call_args.args[-1]

    def account(self, email=None):
        return self.post('confirm',{'email':email or self.email,'token':self.link(email)}).json()

    def test_disabled_and_invalid_email(self):
        self.assertEqual(self.post('request',{'email':'abc'}).status_code,422)
        os.environ['BITCOM_REGISTRATION_ENABLED']='false'
        self.assertEqual(self.post('request',{'email':self.email}).status_code,503)
        self.mail.assert_not_called()

    def test_wrong_address_retry_and_single_use(self):
        token = self.link()
        self.assertEqual(self.post('request',{'email':self.email}).status_code,429)
        self.assertEqual(self.post('confirm',{'email':'other@example.org','token':token}).status_code,400)
        with self.engine.connect() as c:
            self.assertEqual(len(c.execute(select(module.registrations)).all()),0)
        confirmed = self.post('confirm',{'email':self.email,'token':token})
        self.assertEqual(confirmed.status_code,200)
        self.assertEqual(self.post('confirm',{'email':self.email,'token':token}).status_code,400)

    def test_expired_link(self):
        token = self.link()
        with self.engine.begin() as c:
            c.execute(update(module.links).values(expires=0))
        self.assertEqual(self.post('confirm',{'email':self.email,'token':token}).status_code,400)

    def test_smtp_failure_invalidates_link(self):
        self.mail.side_effect = smtplib.SMTPException('delivery failed')
        self.assertEqual(self.post('request',{'email':self.email}).status_code,503)
        with self.engine.connect() as c:
            self.assertEqual(c.execute(select(module.links)).all(),[])

    def test_server_work_isolated_and_restored_on_new_sign_in(self):
        first = self.account()
        second = self.account('other@example.org')
        receipt = first['receipt']
        progress = {'completed':['step-1.1'],'last':'step-1.2','updatedAt':None}
        notes = {'scratch_notes':'Workshop note'}
        for kind,data in [('progress',progress),('workbook',notes)]:
            self.assertEqual(self.post('save',{'receipt':receipt,'kind':kind,'revision':0,'data':data}).json(),{'revision':1})
        self.assertEqual(self.post('load',{'receipt':second['receipt']}).json(),{})
        self.assertEqual(self.post('save',{'receipt':receipt,'kind':'progress','revision':0,'data':progress}).status_code,409)
        self.assertEqual(self.post('forget',{'receipt':receipt}).status_code,200)
        self.assertEqual(self.post('load',{'receipt':receipt}).status_code,401)
        with self.engine.begin() as c:
            c.execute(update(module.limits).values(until=0))
        again = self.account()
        self.assertEqual(again['scope'],first['scope'])
        self.assertEqual(self.post('load',{'receipt':again['receipt']}).json(),{
            'progress':{'revision':1,'data':progress}, 'workbook':{'revision':1,'data':notes},
        })

    def test_invalid_and_expired_receipts(self):
        first = self.account()
        self.assertEqual(self.post('load',{'receipt':'x'*43}).status_code,401)
        self.assertEqual(self.post('save',{'receipt':first['receipt'],'kind':'workbook','revision':0,'data':{'bad':[]}}).status_code,422)
        with self.engine.begin() as c:
            c.execute(update(module.receipts).values(expires=0))
        self.assertEqual(self.post('load',{'receipt':first['receipt']}).status_code,401)

    def test_40_distinct_addresses_can_request_links(self):
        for i in range(40):
            self.link(f'participant{i}@example.org')
        self.assertEqual(self.mail.call_count,40)
