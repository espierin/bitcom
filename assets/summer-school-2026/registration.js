(() => {
  'use strict';
  const config = window.BITCOM_REGISTRATION;
  const form = document.getElementById('registration-form');
  const email = document.getElementById('registration-email');
  const remember = document.getElementById('remember-registration');
  const button = document.getElementById('registration-submit');
  const message = document.getElementById('registration-status');
  const success = document.getElementById('registration-success');
  const key = 'efi-bitcom-registration-receipt-v1';
  const hash = new URLSearchParams(location.hash.slice(1));
  let confirmation = hash.get('token_hash') ? {token_hash:hash.get('token_hash')}
    : hash.get('access_token') ? {access_token:hash.get('access_token')} : null;
  const linkError = hash.has('error') || hash.has('error_description');
  // Clear identity credentials before any API requests. Never retain Supabase tokens.
  if (confirmation || linkError || hash.has('refresh_token')) history.replaceState(null,'',location.pathname);
  let registration = null;
  let busy = false;

  function tell(text) { message.textContent = text; }
  function saved() {
    for (const name of ['sessionStorage','localStorage']) {
      try { const v=JSON.parse(window[name].getItem(key)||'null'); if(v?.receipt && v.expires>Date.now()/1000)return v; }
      catch { /* Registration still works without browser storage. */ }
    }
    return null;
  }
  function clearSaved() {
    for (const name of ['sessionStorage','localStorage']) { try { window[name].removeItem(key); } catch {} }
  }
  async function api(path, body) {
    const response=await fetch(config.api+path,{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify(body),cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(30000)});
    const data=await response.json().catch(()=>({}));
    if(!response.ok) { const error=new Error(data.detail||'service_unavailable'); error.status=response.status; throw error; }
    return data;
  }
  function completed(data) {
    registration=data;
    success.hidden=false;
    document.getElementById('confirmed-email').textContent=data.email;
    document.getElementById('confirmed-date').textContent=new Date(data.confirmed_at).toLocaleString();
    tell('Your email is confirmed and your workshop registration has been saved.');
    button.textContent='Continue with this email';
    success.querySelector('a').focus();
  }
  function errorText(error) {
    if(error.status===429)return 'Please wait before trying again. Do not repeatedly request a new email. If several participants are waiting, ask the facilitator to stagger registration.';
    if(error.message==='email_does_not_match_confirmation')return 'Use the email address that received this link. If you entered another address, request a fresh confirmation link.';
    if(error.status===400)return 'This link could not be confirmed. It may have expired or already been used. Request a new link and open the most recent email.';
    return 'Registration is temporarily unavailable. Your workshop work is not lost. Try again later or continue to the workshop and tell the facilitator.';
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if(busy || !config?.enabled || !form.reportValidity())return;
    busy=true;button.disabled=true;success.hidden=true;
    const address=email.value.trim();
    try {
      if(confirmation) {
        tell('Checking your confirmation and saving your registration…');
        const data=await api('/confirm',{email:address,...confirmation,remember:remember.checked});
        confirmation=null;
        clearSaved();
        let stored=true;
        try { (remember.checked?localStorage:sessionStorage).setItem(key,JSON.stringify({receipt:data.receipt,expires:data.expires})); }
        catch { stored=false; }
        completed(data);
        if(!stored)tell('Registration saved. Browser storage is unavailable, so you will need a new email link next time.');
      } else {
        const previous=saved();
        if(previous) {
          try { completed(await api('/resume',{email:address,receipt:previous.receipt})); return; }
          catch(error) { if(error.status!==401)throw error; clearSaved(); }
        }
        tell('Requesting your confirmation email…');
        await api('/request',{email:address});
        tell('Request accepted. Check your inbox and spam folder for the confirmation email. Open its link, enter the same email address and press Confirm registration. Your registration is only saved after confirmation.');
        button.textContent='Send another confirmation link';
      }
    } catch(error) {
      tell(errorText(error));
      if(error.status===400) { confirmation=null;button.textContent='Send a new confirmation link'; }
    } finally { busy=false;button.disabled=false; }
  });
  document.getElementById('forget-registration').addEventListener('click',async()=>{
    const previous=saved();clearSaved();success.hidden=true;registration=null;
    if(previous) { try { await api('/forget',{receipt:previous.receipt}); } catch { tell('The local copy was removed. Server revocation could not be confirmed; the receipt will expire automatically.');return; } }
    email.value='';button.textContent='Send confirmation link';tell('This browser has forgotten your registration. The organiser’s registration record is retained.');email.focus();
  });
  document.getElementById('download-registration').addEventListener('click',()=>{
    if(!registration)return;
    const {email,workshop,confirmed_at,registered_at}=registration;
    const blob=new Blob([JSON.stringify({email,workshop,confirmed_at,registered_at},null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='EFI-BITCom-registration.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
  });
  email.value=''; // Deliberately request the participant's address at each start.
  if(!config?.enabled) {
    button.disabled=true;email.disabled=true;remember.disabled=true;
    tell('Email registration is not open yet. You can already use the workshop; no email address is collected by this page while registration is closed.');
  } else if(confirmation) {
    button.textContent='Confirm registration';tell('Enter the email address that received this link, then confirm.');
  } else if(linkError) {
    tell('The email link has expired or could not be used. Enter your email address to request a new link.');
  } else {
    tell('Enter your own email address to start. If this browser remembers a confirmed registration, you can continue without another email.');
  }
})();
