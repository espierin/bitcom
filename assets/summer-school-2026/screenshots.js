(() => {
  'use strict';
  // Visible region in percent: x, y, width, height. Originals remain untouched.
  const regions = {
    'sfat-input.jpg':[1,27,96,59], 'sfat-features.jpg':[1,18,96,77],
    'sfat-cds.jpg':[1,44,96,53], 'sfat-protein.jpg':[1,45,96,52],
    'align-input.jpg':[9,10,81,75], 'align-queue.jpg':[9,10,81,38],
    'blast-input.jpg':[1,24,78,55], 'translate-input.jpg':[2,28,95,42],
    'translate-result.jpg':[2,47,95,51], 'netsurfp-input.jpg':[5,29,89,40],
    'netsurfp-result.jpg':[5,24,89,73], 'molstar-selection.jpg':[0,0,99,83],
    'molstar-color.jpg':[16,12,41,44], 'molstar-surface-menu.jpg':[72,37,27,51],
    'molstar-export.jpg':[42,12,27,52], 'sms-input.jpg':[14,17,51,40],
    'sms-result.jpg':[0,0,68,44]
  };
  const images=[...document.querySelectorAll('.screen-example figure a > img')];
  const notes=window.BITCOM_SCREEN_NOTES||{};
  const path='assets/summer-school-2026/screenshots/';
  const byId=new Map();
  for(const [file,spots] of Object.entries(notes)){
    for(const spot of spots)byId.set(spot[0],{file,spot});
  }
  const local={
    'download-case':['Downloads → Practice cases','Scroll to the number assigned by your facilitator and click the file labelled Genomic DNA, or CDS if that is your assigned input. Open the downloaded FASTA in a plain-text editor.','Practice cases\n  Case assigned by your facilitator\n    Genomic DNA  ·  CDS (when supplied)'],
    'download-reference':['Downloads → Reference','Choose Genomic DNA, CDS or Protein to match the input requested by the task. Keep the original file unchanged.','Reference\n  Genomic DNA  ·  CDS  ·  Protein'],
    'find-record':['FASTA file → one record','Use Find on the raw FASTA page and check that the exact allele is on a header line. The record ends before the next > header.','>reference_example\nACGTTACG\n>next_record'],
    'dna-copy':['Plain-text editor → DNA letters','For a letters-only input, start below the > header and stop before the next >. Paste into a blank plain-text file; keep the original FASTA as a separate source.','>demonstration  ← leave out\nACGTTACG        ← copy these letters'],
    'save-text':['Plain-text editor → File → Save As','Choose your workshop folder, enter the filename printed in the task, and save as plain text. If your editor adds .txt to a required .fasta name, choose All files and check the final extension.','File → Save As\n  Folder: your workshop folder\n  Name: use the exact name in this step'],
    'fasta-paste':['Plain-text editor → new FASTA','On the first line type a unique header beginning with >. Press Enter and paste the amino-acid letters below it. Do not include a terminal stop character in the alignment input.','>demonstration_protein\nMAVTGL'],
    'record-workbook':['My workbook → linked answer field','Use the link on this line. It opens or brings forward the separate workbook and jumps to the intended field. Paste your evidence or type your answer; it saves automatically.','Linked workbook field\n  Enter your own observations here'],
    'record-scratchpad':['My workbook → Scratchpad','Use the linked scratchpad for rough notes only. Move your final evidence into the named answer field so it is easy to find in the report.','Scratchpad\n  Draft notes and copied snippets']
  };
  if(!images.length&&!document.querySelector('[data-show-where]'))return;

  const bubble=document.createElement('div');bubble.id='screenshot-pointer-note';
  bubble.className='screenshot-pointer-note';bubble.hidden=true;
  const bubbleTitle=document.createElement('strong');
  const bubbleText=document.createElement('p');
  const bubbleFigure=document.createElement('div');bubbleFigure.className='pointer-figure';
  const bubbleImage=document.createElement('img');bubbleImage.alt='';
  const bubblePin=document.createElement('span');bubblePin.className='pointer-pin';bubblePin.setAttribute('aria-hidden','true');
  const bubbleExample=document.createElement('pre');
  bubbleFigure.append(bubbleImage,bubblePin);
  bubble.append(bubbleTitle,bubbleText,bubbleFigure,bubbleExample);document.body.append(bubble);
  let active=null,pinned=false,hideTimer;
  function dismiss(){
    clearTimeout(hideTimer);
    active?.setAttribute('aria-expanded','false');active=null;pinned=false;bubble.hidden=true;
  }
  function place(){
    if(!active)return;
    const r=active.getBoundingClientRect();
    if(r.bottom<0||r.top>innerHeight||r.right<0||r.left>innerWidth){dismiss();return;}
    const width=bubble.offsetWidth,height=bubble.offsetHeight;
    const below=r.bottom+5,above=r.top-height-5;
    bubble.style.left=Math.max(8,Math.min(r.left,innerWidth-width-8))+'px';
    bubble.style.top=Math.max(8,Math.min(below+height<=innerHeight?below:above,innerHeight-height-8))+'px';
  }
  function show(button,entry,visual){
    clearTimeout(hideTimer);
    if(active===button){place();return;}
    dismiss();active=button;button.setAttribute('aria-expanded','true');
    (button.closest('dialog')||document.body).append(bubble);
    const spot=entry.spot;
    bubbleTitle.textContent=spot?spot[3]:entry[0];
    bubbleText.textContent=spot?spot[4]:entry[1];
    bubbleFigure.hidden=!(spot&&visual);
    bubbleExample.hidden=Boolean(spot)||!visual;
    if(spot&&visual){
      bubbleImage.src=path+entry.file;
      bubblePin.style.left=spot[1]+'%';bubblePin.style.top=spot[2]+'%';
    }else if(!spot&&visual){
      bubbleExample.textContent=entry[2];
    }
    bubble.classList.toggle('pointer-visual',visual);
    bubble.hidden=false;place();
  }
  bubbleImage.addEventListener('load',place);
  function later(){
    clearTimeout(hideTimer);hideTimer=setTimeout(()=>{
      if(!pinned&&!bubble.matches(':hover')&&!active?.matches(':hover,:focus-visible'))dismiss();
    },180);
  }
  bubble.addEventListener('pointerenter',()=>clearTimeout(hideTimer));
  bubble.addEventListener('pointerleave',later);
  function bind(button,entry,visual){
    button.type='button';button.setAttribute('aria-controls',bubble.id);button.setAttribute('aria-expanded','false');
    button.addEventListener('pointerenter',event=>{if(event.pointerType==='mouse'&&!pinned)show(button,entry,visual);});
    button.addEventListener('pointerleave',later);
    button.addEventListener('focus',()=>{if(button.matches(':focus-visible'))show(button,entry,visual);});
    button.addEventListener('blur',later);
    button.addEventListener('click',()=>{
      if(active===button&&pinned){dismiss();return;}
      show(button,entry,visual);pinned=true;
    });
  }
  document.addEventListener('pointerdown',e=>{if(active&&!active.contains(e.target)&&!bubble.contains(e.target))dismiss();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&active){e.preventDefault();e.stopPropagation();dismiss();}},true);
  window.addEventListener('resize',place);
  window.addEventListener('scroll',place,true);

  for(const node of document.querySelectorAll('[data-show-where]')){
    const key=node.dataset.showWhere;
    const linkedField=key==='record-workbook'&&node.querySelector('a[href^="workbook.html#"]');
    const entry=linkedField
      ? ['My workbook → '+linkedField.textContent.replace(/\s*↗\s*$/,''),local[key][1],local[key][2]]
      : byId.get(key)||local[key];
    if(!entry)continue;
    const button=document.createElement('button');
    button.className='show-where-button';button.textContent='Show where';
    button.setAttribute('aria-label','Show where: '+(entry.spot?entry.spot[3]:entry[0]));
    node.append(' ',button);bind(button,entry,true);
  }

  function mark(frame,file,region){
    const [x,y,w,h]=region||[0,0,100,100];
    for(const [index,spot] of (notes[file]||[]).entries()){
      const left=(spot[1]-x)*100/w,top=(spot[2]-y)*100/h;
      if(left<0||left>100||top<0||top>100)continue;
      const button=document.createElement('button');button.className='screenshot-spot';
      button.textContent=String(index+1);
      button.setAttribute('aria-label',`Note ${index+1}: ${spot[3]}`);
      button.style.left=Math.max(4,Math.min(96,left))+'%';
      button.style.top=Math.max(6,Math.min(94,top))+'%';
      frame.append(button);bind(button,{file,spot},false);
    }
  }
  function reading(file){
    if(!notes[file])return null;
    const details=document.createElement('details');details.className='screenshot-reading';
    const summary=document.createElement('summary');summary.textContent='Read all screen notes';
    const list=document.createElement('ol');
    for(const spot of notes[file]){
      const item=document.createElement('li'),label=document.createElement('strong');
      label.textContent=spot[3]+': ';item.append(label,spot[4]);list.append(item);
    }
    details.append(summary,list);return details;
  }
  if(!images.length || typeof HTMLDialogElement==='undefined')return;
  const dialog=document.createElement('dialog');dialog.className='screenshot-dialog';
  dialog.setAttribute('aria-labelledby','screenshot-title');
  const bar=document.createElement('div');bar.className='screenshot-toolbar';
  const title=document.createElement('h2');title.id='screenshot-title';
  const zoom=document.createElement('button');zoom.type='button';zoom.textContent='Actual size';zoom.setAttribute('aria-pressed','false');
  const close=document.createElement('button');close.type='button';close.textContent='Close ×';close.setAttribute('aria-label','Close screenshot');
  bar.append(title,zoom,close);
  const viewport=document.createElement('div');viewport.className='screenshot-viewport';viewport.tabIndex=0;viewport.setAttribute('aria-label','Full screenshot; scroll when viewing at actual size');
  const fullStage=document.createElement('div');fullStage.className='screenshot-full-stage';
  const full=document.createElement('img');fullStage.append(full);viewport.append(fullStage);
  const hint=document.createElement('p');hint.className='screenshot-hint';hint.textContent='Complete original screenshot. Hover, focus or tap a number for its note. Choose Actual size to inspect details; scroll if needed. Close with Escape or Close.';
  dialog.append(bar,viewport,hint);document.body.append(dialog);
  let opener,previousOverflow;
  function open(img,trigger){
    dismiss();
    opener=trigger;full.src=img.currentSrc||img.src;full.alt=img.alt;
    fullStage.querySelectorAll('.screenshot-spot').forEach(spot=>spot.remove());
    mark(fullStage,new URL(img.src).pathname.split('/').pop());
    title.textContent=img.alt||'Full screenshot';
    viewport.classList.remove('actual-size');zoom.textContent='Actual size';zoom.setAttribute('aria-pressed','false');
    previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
    dialog.showModal();viewport.scrollTop=viewport.scrollLeft=0;close.focus();
  }
  close.addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{dismiss();document.body.append(bubble);document.body.style.overflow=previousOverflow;opener?.focus();});
  dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
  zoom.addEventListener('click',()=>{const actual=viewport.classList.toggle('actual-size');zoom.textContent=actual?'Fit to window':'Actual size';zoom.setAttribute('aria-pressed',String(actual));viewport.scrollTop=viewport.scrollLeft=0;});
  for(const img of images){
    const link=img.parentElement;
    const frame=document.createElement('div');frame.className='screenshot-frame';link.before(frame);frame.append(link);
    link.classList.add('screenshot-preview');link.setAttribute('aria-haspopup','dialog');link.setAttribute('aria-label','Enlarge screenshot: '+img.alt);
    const file=new URL(img.src).pathname.split('/').pop();
    const region=regions[file];
    function crop(){if(!region||!img.naturalWidth)return;const[x,y,w,h]=region;frame.style.maxWidth=Math.min(900,img.naturalWidth*w/100*1.3)+"px";link.style.aspectRatio=`${img.naturalWidth*w} / ${img.naturalHeight*h}`;link.classList.add('focused-preview');img.style.width=(10000/w)+'%';img.style.left=(-100*x/w)+'%';img.style.top=(-100*y/h)+'%';}
    img.addEventListener('load',crop);crop();
    const button=document.createElement('button');button.type='button';button.className='screenshot-magnifier';button.title='View complete screenshot';button.setAttribute('aria-label','View complete screenshot: '+img.alt);button.setAttribute('aria-haspopup','dialog');
    button.innerHTML='<svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="10" cy="10" r="6.5"/><path d="m15 15 6 6M7 10h6M10 7v6"/></svg>';
    frame.append(button);
    mark(frame,file,region);
    button.addEventListener('click',()=>open(img,button));
    link.addEventListener('click',event=>{if(event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();open(img,link);});
    const note=document.createElement('p');note.className='screenshot-preview-note';
    note.textContent=notes[file]?'Hover, focus or tap the numbers for notes. Use the magnifier for the complete screenshot.':'Detail preview · use the magnifier for the complete screenshot.';
    frame.after(note);
    const allNotes=reading(file);
    if(allNotes)(frame.parentElement.querySelector('figcaption')||note).after(allNotes);
  }
})();
