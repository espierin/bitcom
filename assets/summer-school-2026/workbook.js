const form = document.getElementById('workbook-form');
const fields = [...form.querySelectorAll('textarea')];
const workbookCloud = window.WorkshopCloud;
const key = workbookCloud?.storageKey('workbook') || 'efi-bitcom-workbook-v1';
const status = document.getElementById('save-status');
let unsaved = false;
function snapshot() { return Object.fromEntries(fields.map(f => [f.name, f.value])); }
function show(data) { for (const f of fields) f.value = typeof data[f.name] === 'string' ? data[f.name] : ''; }
function save() {
  workbookCloud?.queue('workbook',snapshot());
  try { localStorage.setItem(key, JSON.stringify(snapshot())); unsaved = false; status.textContent = 'Saved in this browser at ' + new Date().toLocaleTimeString(); }
  catch { unsaved = true; status.textContent = 'Browser storage is unavailable. Download your answers before closing this page.'; }
}
try { const data = JSON.parse(localStorage.getItem(key) || '{}'); if (data && typeof data === 'object') show(data); status.textContent = 'Ready. Your answers are saved here as you type. Keep the workbook open in one tab.'; }
catch { status.textContent = 'Could not read browser storage. Download a backup before closing this page.'; }
for (const field of fields.filter(field => field.dataset.copyable !== undefined)) {
  const actions = document.createElement('div');
  actions.className = 'workbook-copy';
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Copy all';
  button.setAttribute('aria-label', 'Copy all: ' + field.labels[0].textContent);
  const feedback = document.createElement('span');
  feedback.setAttribute('role', 'status');
  actions.append(button, feedback);
  field.after(actions);

  field.addEventListener('input', () => { feedback.textContent = ''; });
  button.addEventListener('click', async () => {
    const text = field.value;
    feedback.textContent = '';
    if (!text) {
      feedback.textContent = 'This field is empty.';
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      feedback.textContent = 'Copied to clipboard.';
    } catch {
      field.focus();
      field.select();
      feedback.textContent = 'Text selected. Press Ctrl+C or Command+C, or use your device’s Copy command.';
    }
  });
}
form.addEventListener('input', event => {
  try {
    const latest = unsaved ? null : JSON.parse(localStorage.getItem(key) || '{}');
    if (latest && typeof latest === 'object') {
      for (const field of fields) {
        if (field !== event.target && typeof latest[field.name] === 'string') field.value = latest[field.name];
      }
    }
  } catch {}
  save();
});
window.addEventListener('storage', e => {
  if (e.key !== key || unsaved) return;
  try {
    show(JSON.parse(e.newValue || '{}') || {});
    status.textContent = 'Workbook updated from another window in this browser.';
  } catch {
    status.textContent = 'Could not read the update from another window. Download your current answers before reloading.';
  }
});
function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], {type}));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000);
}
document.getElementById('export-json').addEventListener('click', () => download('EFI-BITCom-workbook.json', JSON.stringify({format:'efi-bitcom-workbook',version:1,answers:snapshot(),progress:window.WorkshopProgress.snapshot(),exportedAt:new Date().toISOString()},null,2), 'application/json'));
function report() {
 const lines = ['EFI BITCom workshop', 'Participant workbook', ''];
 const progress=window.WorkshopProgress.snapshot();
 lines.push('Completed tasks: '+progress.completed.length+' / '+window.WorkshopProgress.steps.length);
 const last=window.WorkshopProgress.steps.find(s=>s.id===progress.last);
 if(last)lines.push('Resume at: '+last.title);
 lines.push('');
 for(const group of form.querySelectorAll('fieldset')) { lines.push(group.querySelector('legend').textContent, ''); for(const f of group.querySelectorAll('textarea')) lines.push(form.querySelector('label[for="'+f.id+'"]').textContent, f.value || '(No answer recorded)', ''); }
 return lines.join('\n');
}
document.getElementById('export-text').addEventListener('click', () => download('EFI-BITCom-workbook.txt', report(), 'text/plain;charset=utf-8'));
document.getElementById('import-json').addEventListener('change', async e => {
 const file=e.target.files[0]; if(!file)return; const message=document.getElementById('import-status');
 try {
  if(file.size>2000000)throw Error('File exceeds 2 MB.');
  const data=JSON.parse(await file.text());
  if(data.format!=='efi-bitcom-workbook'||data.version!==1||!data.answers||Array.isArray(data.answers)||typeof data.answers!=='object')throw Error('Select a workbook JSON backup.');
  const answers={};
  for(const f of fields){const value=data.answers[f.name]??'';if(typeof value!=='string'||value.length>30000)throw Error('Invalid answer in backup.');answers[f.name]=value;}
  const progress=data.progress===undefined?null:window.WorkshopProgress.validate(data.progress);
  if((fields.some(f=>f.value.trim())||window.WorkshopProgress.snapshot().completed.length)&&!confirm('Replace your current answers, notes and (if included) progress with this backup? Download your current backup first if you want to keep it.'))return;
  show(answers);save();if(progress)window.WorkshopProgress.restore(progress);
  message.textContent=progress?'Answers, scratchpad and progress restored. Use Continue above to resume.':'Answers restored from an older backup. Task progress was left unchanged.';
 }
 catch(error){message.textContent='Import failed. '+error.message;}finally{e.target.value='';}
});
document.getElementById('print-report').addEventListener('click', () => { let block=document.getElementById('print-answers');if(!block){block=document.createElement('pre');block.id='print-answers';form.after(block);}block.textContent=report();window.print(); });
