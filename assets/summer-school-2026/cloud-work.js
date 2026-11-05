(() => {
  'use strict';
  const config = window.BITCOM_REGISTRATION;
  const sessionKey = 'efi-bitcom-cloud-session-v1';
  const keys = { progress: 'efi-bitcom-progress-v1', workbook: 'efi-bitcom-workbook-v1' };
  const kinds = Object.keys(keys);
  let session = config?.enabled ? read(sessionKey) : null;
  if (!session?.receipt || !session.scope || session.expires <= Date.now()/1000) session = null;
  let timer, loading, flushing;
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
    return session ? keys[kind]+':'+session.scope : keys[kind];
  }
  function metaKey(kind) { return storageKey(kind)+':sync'; }
  function meta(kind) { return read(metaKey(kind), { revision:0 }); }
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
  function load() {
    if (!session) return Promise.resolve(false);
    if (loading) return loading;
    const receipt = session.receipt;
    loading = request('/load',{receipt}).then(remote=>{
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
      tell('Signed in. Your workshop work is linked to your email.');
      return true;
    }).catch(error=>{
      tell(error.status===401 ? 'Sign in again to sync. Download a backup before closing.'
        : 'Server unavailable. Use your browser copy and download a backup before closing.');
      return false;
    }).finally(()=>{loading=null;});
    return loading;
  }
  async function savePending() {
    if (loading) await loading;
    for (const kind of kinds) {
      let current = meta(kind);
      if (conflicts.has(kind) || current.pending === undefined) continue;
      while (current.pending !== undefined) {
        const pending = current.pending;
        const {revision} = await request('/save',{
          receipt:session.receipt,kind,revision:current.revision,data:pending,
        }).catch(error=>{
          if (error.status===409) conflicts.add(kind);
          throw error;
        });
        const latest = meta(kind);
        put(metaKey(kind), JSON.stringify(latest.pending)===JSON.stringify(pending)
          ? {revision} : {...latest,revision});
        current = meta(kind);
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
    if (flushing) return flushing;
    const saving = navigator.locks
      ? navigator.locks.request('efi-bitcom-sync:'+session.scope,savePending)
      : savePending();
    flushing = saving.catch(error=>{
      tell(error.status===409 ? 'A newer server copy exists. Download a backup, then use “Load server copy” to continue.'
        : error.status===401 ? 'Sign in again to sync. Download a backup before closing.'
        : 'Server save failed. Your browser copy is available. Download a backup before closing.');
      return false;
    }).finally(()=>{flushing=null;});
    return flushing;
  }
  function queue(kind,data) {
    if (!session) return;
    try { put(metaKey(kind),{...meta(kind),pending:data}); }
    catch { tell('Browser storage is unavailable. Download a backup before closing.'); return; }
    tell('Changes pending. Wait for “Saved on the server” before closing.');
    clearTimeout(timer);
    timer=setTimeout(flush,850);
  }
  async function connect(confirmed, copyGuest) {
    session={receipt:confirmed.receipt,scope:confirmed.scope,expires:confirmed.expires};
    put(sessionKey,session);
    if (!(await load())) return false;
    if (copyGuest) {
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
    try { await request('/forget',{receipt:session.receipt}); }
    catch { tell('Server sign-out could not be verified. Try again or close this browser.'); return; }
    for (const kind of kinds) {
      localStorage.removeItem(storageKey(kind));
      localStorage.removeItem(metaKey(kind));
    }
    localStorage.removeItem(sessionKey);
    location.reload();
  }
  async function useServerCopy() {
    if (!window.confirm('Replace the signed-in copy on this browser with the server copy? Download a JSON backup first if you want to keep your local changes.')) return;
    if (flushing) await flushing;
    clearTimeout(timer);
    try {
      const remote = await request('/load',{receipt:session.receipt});
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
    for (const [title, handler] of [['Save on server now',flush],['Load server copy',useServerCopy],['Sign out',signOut]]) {
      const button=document.createElement('button');
      button.type='button';
      button.textContent=title;
      button.addEventListener('click',handler);
      actions.append(button);
    }
    panel.append(message,actions);
  }
  window.WorkshopCloud={storageKey,queue,attach,request,connect,session:()=>session,signOut};
  if (session) {
    load().then(ok=>{if(ok && kinds.some(kind=>meta(kind).pending!==undefined)) flush();});
    window.addEventListener('online',flush);
    document.addEventListener('visibilitychange',()=>{if(document.hidden && kinds.some(kind=>meta(kind).pending!==undefined)) flush();});
  }
  window.addEventListener('storage',event=>{
    if (event.key===sessionKey && (read(sessionKey)?.scope || null)!==(session?.scope || null)) location.reload();
  });
})();
