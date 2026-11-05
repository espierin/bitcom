(() => {
  'use strict';
  const steps = window.BITCOM_STEPS;
  const cloud = window.WorkshopCloud;
  const key = cloud?.storageKey('progress') || 'efi-bitcom-progress-v1';
  const byId = new Map(steps.map(s => [s.id, s]));
  let memory = {completed: [], last: null, updatedAt: null};
  let unavailable = false;
  let unsaved = false;
  function missingBefore(page) {
    const number=Number((page.match(/^step-(\d)\.html$/)||[])[1]);
    return steps.filter(s=>Number(s.page.match(/\d/)[0])<number&&!memory.completed.includes(s.id));
  }
  function validate(value) {
    if (!value || typeof value !== 'object' || !Array.isArray(value.completed) ||
        value.completed.length > steps.length || value.completed.some(id => !byId.has(id))) throw Error('Invalid progress in backup.');
    if (value.last !== null && !byId.has(value.last)) throw Error('Invalid resume position in backup.');
    return {completed:[...new Set(value.completed)], last:value.last,
      updatedAt:typeof value.updatedAt==='string' ? value.updatedAt.slice(0,40) : null};
  }
  function snapshot() {
    if(unsaved)return structuredClone(memory);
    try { const raw=localStorage.getItem(key); memory=raw?validate(JSON.parse(raw)):{completed:[],last:null,updatedAt:null}; }
    catch { unavailable=true; }
    return structuredClone(memory);
  }
  function store(value, sync = true) {
    memory=validate(value);
    try { localStorage.setItem(key,JSON.stringify(memory));unavailable=false;unsaved=false; }
    catch { unavailable=true;unsaved=true; }
    render();
    if (sync) cloud?.queue('progress',memory);
    if(window.dispatchEvent)window.dispatchEvent(new Event('bitcom-progress'));
  }
  const box=document.createElement('section');box.className='progress-panel';box.setAttribute('aria-label','Your saved progress');
  const heading=document.createElement('h2');heading.textContent='Your saved progress';
  const count=document.createElement('p');
  const resume=document.createElement('a');resume.className='action-link';
  const backup=document.createElement('a');backup.href='workbook.html#workbook-actions';backup.textContent='Save or restore a backup';
  const links=document.createElement('div');links.className='workbook-actions';links.append(resume,backup);
  const note=document.createElement('p');note.className='progress-note';
  box.append(heading,count,links,note);
  cloud?.attach(box);
  document.querySelector('nav[aria-label="Workshop navigation"]').after(box);
  function render() {
    count.textContent=`${memory.completed.length} of ${steps.length} tasks marked complete. Your reading position is saved separately.`;
    const savedStep=byId.get(memory.last)||steps[0];
    const step=missingBefore(savedStep.page)[0]||savedStep;
    resume.href=step.page+'#'+step.id;
    resume.textContent=memory.last?'Continue: '+step.title:'Begin Step 1';
    note.textContent=unavailable?'Browser storage could not be read or written. Download a backup before leaving.':
      cloud?.session() ? 'Signed-in work is saved on this browser and synced to the server. Check the server status before closing.' :
      'Guest mode. This browser keeps a local copy. Before ending the session, download a JSON backup to keep or transfer your progress.';
    document.querySelectorAll('[data-complete-step]').forEach(input=>{input.checked=memory.completed.includes(input.dataset.completeStep);});
    document.querySelectorAll('.page-contents a[href^="#step-"]').forEach(link=>{
      const id=link.getAttribute('href').slice(1);
      let status=link.querySelector('.task-index-status');
      if(!status){
        status=document.createElement('span');
        status.className='task-index-status';
        link.append(status);
      }
      status.textContent=memory.completed.includes(id)?' ✓ Complete':'';
    });
    const chapterStatus=document.querySelector('[data-chapter-status]');
    if(chapterStatus?.dataset?.chapterStatus){
      const chapter=steps.filter(step=>step.page===chapterStatus.dataset.chapterStatus);
      const remaining=chapter.filter(step=>!memory.completed.includes(step.id));
      chapterStatus.textContent=remaining.length
        ? `${chapter.length-remaining.length} of ${chapter.length} tasks complete. Next unchecked task: ${remaining[0].id.slice(5)}.`
        : `All ${chapter.length} tasks on this page are complete.`;
    }
  }
  snapshot();render();
  const headings=[...document.querySelectorAll('h3[id^="step-"]')].filter(h=>byId.has(h.id));
  for(const h of headings) {
    const label=document.createElement('label');label.className='task-complete';
    const input=document.createElement('input');input.type='checkbox';input.dataset.completeStep=h.id;
    input.checked=memory.completed.includes(h.id);
    label.append(input,document.createTextNode('I have completed task '+h.id.slice(5)));
    const next=headings[headings.indexOf(h)+1];
    if(next && next.parentElement===h.parentElement)next.before(label);
    else h.parentElement.append(label);
    input.addEventListener('change',()=>{
      const value=snapshot();const completed=new Set(value.completed);
      input.checked?completed.add(h.id):completed.delete(h.id);
      store({...value,completed:[...completed],last:h.id,updatedAt:new Date().toISOString()});
    });
  }
  function position() {
    if(!headings.length||missingBefore(byId.get(headings[0].id).page).length)return;
    let current=null;
    for(const h of headings) { if(h.getBoundingClientRect().top<=180)current=h; else break; }
    if(!current)return;
    const value=snapshot();
    if(value.last!==current.id)store({...value,last:current.id,updatedAt:new Date().toISOString()});
  }
  let timer;
  window.addEventListener('scroll',()=>{clearTimeout(timer);timer=setTimeout(position,500);},{passive:true});
  window.addEventListener('pagehide',position);
  window.addEventListener('hashchange',()=>{
    const current=headings.find(h=>h.id===location.hash.slice(1));
    if(current&&!missingBefore(byId.get(current.id).page).length)store({...snapshot(),last:current.id,updatedAt:new Date().toISOString()});
  });
  window.addEventListener('storage',event=>{if(event.key===key){snapshot();render();}});
  if(headings.length&&!missingBefore(byId.get(headings[0].id).page).length) {
    const anchor=location.hash.slice(1);
    const current=headings.find(h=>h.id===anchor)||headings.find(h=>h.id===memory.last)||headings[0];
    store({...snapshot(),last:current.id,updatedAt:new Date().toISOString()},false);
  }
  window.WorkshopProgress={snapshot,validate,restore:store,steps,missingBefore};
})();
