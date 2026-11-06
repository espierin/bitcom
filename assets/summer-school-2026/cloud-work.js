(() => {
  'use strict';
  const config = window.BITCOM_REGISTRATION;
  const sessionKey = 'efi-bitcom-cloud-session-v1';
  const keys = { progress: 'efi-bitcom-progress-v1', workbook: 'efi-bitcom-workbook-v1' };
  const kinds = Object.keys(keys);
  let session = config?.enabled ? read(sessionKey) : null;
  if (!session?.receipt || !session.scope) session = null;
  const requestedRun = new URLSearchParams(location.search).get('run');
  const historyRun = /\/(?:workbook|step-[1-4])\.html$/.test(location.pathname) &&
    /^[a-f0-9-]{36}$/.test(requestedRun) ? requestedRun : null;
  const profileKey = () => 'efi-bitcom-profile:' + session.scope;
  let profile = session ? read(profileKey()) : null;
  let runId = historyRun || profile?.active?.id || null;
  let timer, retryTimer, loading, flushing, rejectedReceipt;
  let status = session ? 'Checking your server copy…' : '';
  const conflicts = new Set();

  function read(key, fallback = null) {
    try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; }
    catch { return fallback; }
  }
  function put(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }
  function storageKey(kind) {
    if (session) return [keys[kind],session.scope,runId].filter(Boolean).join(':');
    return historyRun ? keys[kind]+':unavailable:'+historyRun : keys[kind];
  }
  function metaKey(kind) { return storageKey(kind)+':sync'; }
  function meta(kind) { return read(metaKey(kind), { revision:0 }); }
  function hasPendingWork() {
    return kinds.some(kind=>!conflicts.has(kind) && meta(kind).pending!==undefined);
  }
  function tell(message) {
    status = message;
    for (const element of document.querySelectorAll('[data-cloud-status]')) element.textContent = status;
  }
  async function request(path, body) {
    const response = await fetch(config.api+path, {
      method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body),
      credentials:'omit', cache:'no-store', signal:AbortSignal.timeout(30000),
    });
    const data = await response.json().catch(()=>({}));
    if (!response.ok) throw Object.assign(new Error(data.detail || 'service_unavailable'), {status:response.status});
    return data;
  }
  function notify(key, data) {
    window.dispatchEvent(new StorageEvent('storage',{key,newValue:JSON.stringify(data)}));
  }
  const authenticated = () => Boolean(session && session.receipt !== rejectedReceipt && session.expires > Date.now()/1000);
  const runBody = () => ({receipt:session.receipt, ...(runId ? {run_id:runId} : {})});
  const withSaveLock = action => navigator.locks
    ? navigator.locks.request('efi-bitcom-sync:'+session.scope,action)
    : action();
  function rememberProfile(value) {
    profile = value;
    put(profileKey(),value);
    window.dispatchEvent(new Event('bitcom-profile'));
  }
  function load(allowSwitch = false) {
    if (!authenticated()) {
      if (session) tell('Your sign-in expired. Sign in again with the same email to sync this work.');
      return Promise.resolve(false);
    }
    if (loading) return loading;
    const receipt = session.receipt;
    loading = (async () => {
      // Finish any old browser saves before the server archives the previous workbook.
      if (!runId && hasPendingWork() && !flushing) await withSaveLock(savePending);
      const account = await request('/profile',{receipt}).catch(error=>{
        if (error.status !== 404) throw error;
        return null;
      });
      if (session?.receipt !== receipt) return false;
      if (account?.active) {
        const selected = historyRun || account.active.id;
        if (selected !== runId && !allowSwitch) {
          rememberProfile(account);
          location.reload();
          return false;
        }
        runId = selected;
        rememberProfile(account);
      }
      const remote = await request('/load',runBody());
      if (session?.receipt !== receipt) return false;
      for (const kind of kinds) {
        if (meta(kind).pending !== undefined) continue;
        const saved = remote[kind];
        if ((saved?.revision || 0) < meta(kind).revision) continue;
        if (saved) {
          if (kind==='progress') window.WorkshopProgress?.validate(saved.data);
          put(storageKey(kind),saved.data);
          notify(storageKey(kind),saved.data);
        }
        put(metaKey(kind),{revision:saved?.revision || 0});
      }
      tell(historyRun ? 'Viewing the saved copy of this earlier workbook.' : 'Signed in. Your workshop work is linked to your email.');
      return true;
    })().catch(error=>{
      if (error.status===401 && session?.receipt===receipt) {
        rejectedReceipt=receipt;
        window.dispatchEvent(new Event('bitcom-profile'));
      }
      tell(error.status===401 ? 'Sign in again to sync. Download a backup before closing.'
        : error.status===404 && historyRun ? 'This workbook is not available for this account.'
        : 'Server unavailable. Use your browser copy and download a backup before closing.');
      return false;
    }).finally(()=>{loading=null;});
    return loading;
  }
  async function savePending() {
    while (hasPendingWork()) {
      for (const kind of kinds) {
        const current = meta(kind);
        if (conflicts.has(kind) || current.pending === undefined) continue;
        const pending = current.pending;
        const {revision} = await request('/save',{
          ...runBody(),kind,revision:current.revision,data:pending,
        }).catch(error=>{
          if (error.status===409) conflicts.add(kind);
          throw error;
        });
        const latest = meta(kind);
        put(metaKey(kind), JSON.stringify(latest.pending)===JSON.stringify(pending)
          ? {revision} : {...latest,revision});
      }
    }
    if (conflicts.size) {
      tell('A newer server copy exists. Download a backup, then use “Load server copy” to continue.');
      return false;
    }
    tell('Saved on the server.');
    return true;
  }
  function flush() {
    clearTimeout(timer);
    if (!session) return Promise.resolve(false);
    if (historyRun) return Promise.resolve(true);
    if (flushing) return flushing;
    if (!authenticated()) return Promise.resolve(false);
    const saveWhenReady = async () => {
      if (loading && !(await loading)) return false;
      return savePending();
    };
    const saving = withSaveLock(saveWhenReady);
    flushing = saving.catch(error=>{
      tell(error.status===409 ? 'A newer server copy exists. Download a backup, then use “Load server copy” to continue.'
        : error.status===401 ? 'Sign in again to sync. Download a backup before closing.'
        : 'Server save failed. Your browser copy is available. Download a backup before closing.');
      return false;
    }).finally(()=>{flushing=null;});
    return flushing;
  }
  function queue(kind,data) {
    if (!session || historyRun) return;
    try { put(metaKey(kind),{...meta(kind),pending:data}); }
    catch { tell('Browser storage is unavailable. Download a backup before closing.'); return; }
    tell(authenticated() ? 'Changes pending. Wait for “Saved on the server” before closing.'
      : 'Saved in this browser. Sign in again with the same email to sync.');
    if (!authenticated()) return;
    clearTimeout(timer);
    timer=setTimeout(flush,850);
  }
  function retryPending() {
    if (authenticated() && hasPendingWork()) return flush();
  }
  function scheduleRetry() {
    if (retryTimer===undefined) retryTimer=setInterval(retryPending,10*60*1000);
  }
  async function connect(confirmed, copyGuest) {
    if (loading) await loading;
    session={receipt:confirmed.receipt,scope:confirmed.scope,expires:confirmed.expires};
    profile=read(profileKey());
    runId=profile?.active?.id || null;
    put(sessionKey,session);
    scheduleRetry();
    if (!(await load(true))) return false;
    if (copyGuest && !runId) {
      for (const kind of kinds) {
        const guest = read(keys[kind]);
        if (guest && meta(kind).revision===0 && meta(kind).pending===undefined) {
          put(storageKey(kind),guest);
          queue(kind,guest);
        }
      }
    }
    return flush();
  }
  async function signOut() {
    if (!session) return;
    if (!(await flush())) {
      tell('Download your backup first. Sign out from the registration page after keeping a copy.');
      if (!window.confirm('Server saving is incomplete. Sign out anyway and clear this browser’s signed-in copy?')) return;
    }
    try { if (authenticated()) await request('/forget',{receipt:session.receipt}); }
    catch { tell('Server sign-out could not be verified. Try again or close this browser.'); return; }
    for (const kind of kinds) {
      const base = keys[kind]+':'+session.scope;
      for (const id of [null,runId,...(profile?.runs || []).map(record=>record.id)]) {
        const scoped = id ? base+':'+id : base;
        localStorage.removeItem(scoped);
        localStorage.removeItem(scoped+':sync');
      }
    }
    localStorage.removeItem(profileKey());
    localStorage.removeItem(sessionKey);
    location.reload();
  }
  async function useServerCopy() {
    if (!window.confirm('Replace the signed-in copy on this browser with the server copy? Download a JSON backup first if you want to keep your local changes.')) return;
    if (flushing) await flushing;
    clearTimeout(timer);
    try {
      const remote = await request('/load',runBody());
      if (remote.progress) window.WorkshopProgress?.validate(remote.progress.data);
      for (const kind of kinds) {
        if (remote[kind]) put(storageKey(kind),remote[kind].data);
        else localStorage.removeItem(storageKey(kind));
        put(metaKey(kind),{revision:remote[kind]?.revision || 0});
      }
      location.reload();
    } catch { tell('Server copy could not be loaded. Your browser copy is still available.'); }
  }
  function attach(panel) {
    if (!session) return;
    const message = document.createElement('p');
    message.dataset.cloudStatus = '';
    message.setAttribute('role','status');
    message.textContent=status;
    const actions = document.createElement('div');
    actions.className='workbook-actions';
    for (const [title, handler] of historyRun ? [] : [['Save on server now',flush],['Load server copy',useServerCopy]]) {
      const button=document.createElement('button');
      button.type='button';
      button.textContent=title;
      button.addEventListener('click',handler);
      actions.append(button);
    }
    panel.append(message,actions);
  }
  async function startNext() {
    if (!(await flush())) throw Error('save_pending');
    const account = await request('/new-run',runBody());
    rememberProfile(account);
    return account;
  }
  window.WorkshopCloud={storageKey,queue,attach,request,connect,session:()=>session,authenticated,signOut,
    profile:()=>profile,run:()=>profile?.runs.find(record=>record.id===runId),readOnly:()=>Boolean(historyRun),
    refresh:load,startNext};
  if (session) {
    scheduleRetry();
    load().then(ok=>{if(ok) retryPending();});
  }
  window.addEventListener('online',retryPending);
  document.addEventListener('visibilitychange',()=>{if(document.hidden) retryPending();});
  window.addEventListener('storage',event=>{
    if (event.key===sessionKey && (read(sessionKey)?.receipt || null)!==(session?.receipt || null)) location.reload();
    if (session && event.key===profileKey()) {
      const account = read(profileKey());
      if (!historyRun && account?.active?.id !== runId) location.reload();
      else {
        profile=account;
        window.dispatchEvent(new Event('bitcom-profile'));
      }
    }
    if (session && !historyRun && kinds.some(kind=>event.key===metaKey(kind)) && hasPendingWork()) {
      clearTimeout(timer);
      timer=setTimeout(retryPending,850);
    }
  });
})();
