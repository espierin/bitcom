(() => {
  'use strict';
  const cloud = window.WorkshopCloud;
  const config = window.BITCOM_REGISTRATION;
  const byId = id => document.getElementById(id);
  const form = byId('registration-form');
  const email = byId('registration-email');
  const button = byId('registration-submit');
  const status = byId('registration-status');
  const success = byId('registration-success');
  const hash = new URLSearchParams(location.hash.slice(1));
  let token = hash.get('bitcom_token');
  if (token !== null) history.replaceState(null,'',location.pathname);
  let busy = false;

  const tell = text => { status.textContent = text; };
  function signedIn() {
    form.hidden = true;
    success.hidden = false;
    tell('You are signed in to the workshop.');
    success.querySelector('a').focus();
  }

  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if (busy || !config?.enabled || !form.reportValidity()) return;
    busy=true;
    button.disabled=true;
    const address=email.value.trim();
    try {
      if (token) {
        tell('Confirming your sign-in and loading your server copy…');
        const data=await cloud.request('/confirm',{
          email:address, token, remember:byId('remember-registration').checked,
        });
        token=null;
        const saved=await cloud.connect(data,byId('copy-guest-work').checked);
        signedIn();
        if (!saved) tell('Signed in. Server sync needs attention. Keep a JSON backup of your browser copy.');
      } else {
        tell('Requesting your email link…');
        await cloud.request('/request',{email:address});
        tell('Request accepted. Check your inbox and spam folder. Open the link within 20 minutes, enter the same address and select Confirm sign-in.');
        button.textContent='Send another sign-in link';
      }
    } catch(error) {
      if (error.status===400) {
        tell('The link could not be confirmed. Check that you entered the receiving address. If the link is expired or already used, request a new one.');
      } else if(error.status===429) {
        tell('Please wait before requesting another link. You can continue as a guest.');
      } else {
        tell('Email sign-in is temporarily unavailable. Continue as a guest and download a JSON backup before closing.');
      }
    } finally { busy=false;button.disabled=false; }
  });

  byId('request-new-link').addEventListener('click',()=>{
    token=null;
    button.textContent='Send sign-in link';
    byId('confirm-options').hidden=true;
    tell('Enter your email address and send a new link.');
    email.focus();
  });
  byId('forget-registration').addEventListener('click',cloud.signOut);
  email.value='';
  if (!config?.enabled) {
    tell('Email sign-in is currently closed. Continue as a guest and download a JSON backup before closing.');
  } else if (token) {
    form.hidden=false;
    button.textContent='Confirm sign-in';
    byId('confirm-options').hidden=false;
    tell('Enter the email address that received this link, then confirm.');
  } else if (cloud.session()) {
    signedIn();
  } else {
    form.hidden=false;
    tell('Enter your email to receive a one-time sign-in link, or continue as a guest.');
  }
})();
