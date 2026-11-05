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
  if(!images.length || typeof HTMLDialogElement==='undefined')return;
  const dialog=document.createElement('dialog');dialog.className='screenshot-dialog';
  dialog.setAttribute('aria-labelledby','screenshot-title');
  const bar=document.createElement('div');bar.className='screenshot-toolbar';
  const title=document.createElement('h2');title.id='screenshot-title';
  const zoom=document.createElement('button');zoom.type='button';zoom.textContent='Actual size';zoom.setAttribute('aria-pressed','false');
  const close=document.createElement('button');close.type='button';close.textContent='Close ×';close.setAttribute('aria-label','Close screenshot');
  bar.append(title,zoom,close);
  const viewport=document.createElement('div');viewport.className='screenshot-viewport';viewport.tabIndex=0;viewport.setAttribute('aria-label','Full screenshot; scroll when viewing at actual size');
  const full=document.createElement('img');viewport.append(full);
  const hint=document.createElement('p');hint.className='screenshot-hint';hint.textContent='Complete original screenshot. Choose Actual size to inspect details; scroll if needed. Close with Escape or Close.';
  dialog.append(bar,viewport,hint);document.body.append(dialog);
  let opener,previousOverflow;
  function open(img,trigger){
    opener=trigger;full.src=img.currentSrc||img.src;full.alt=img.alt;
    title.textContent=img.alt||'Full screenshot';
    viewport.classList.remove('actual-size');zoom.textContent='Actual size';zoom.setAttribute('aria-pressed','false');
    previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
    dialog.showModal();viewport.scrollTop=viewport.scrollLeft=0;close.focus();
  }
  close.addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{document.body.style.overflow=previousOverflow;opener?.focus();});
  dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
  zoom.addEventListener('click',()=>{const actual=viewport.classList.toggle('actual-size');zoom.textContent=actual?'Fit to window':'Actual size';zoom.setAttribute('aria-pressed',String(actual));viewport.scrollTop=viewport.scrollLeft=0;});
  for(const img of images){
    const link=img.parentElement;
    const frame=document.createElement('div');frame.className='screenshot-frame';link.before(frame);frame.append(link);
    link.classList.add('screenshot-preview');link.setAttribute('aria-haspopup','dialog');link.setAttribute('aria-label','Enlarge screenshot: '+img.alt);
    const region=regions[new URL(img.src).pathname.split('/').pop()];
    function crop(){if(!region||!img.naturalWidth)return;const[x,y,w,h]=region;frame.style.maxWidth=Math.min(900,img.naturalWidth*w/100*1.3)+"px";link.style.aspectRatio=`${img.naturalWidth*w} / ${img.naturalHeight*h}`;link.classList.add('focused-preview');img.style.width=(10000/w)+'%';img.style.left=(-100*x/w)+'%';img.style.top=(-100*y/h)+'%';}
    img.addEventListener('load',crop);crop();
    const button=document.createElement('button');button.type='button';button.className='screenshot-magnifier';button.title='View complete screenshot';button.setAttribute('aria-label','View complete screenshot: '+img.alt);button.setAttribute('aria-haspopup','dialog');
    button.innerHTML='<svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="10" cy="10" r="6.5"/><path d="m15 15 6 6M7 10h6M10 7v6"/></svg>';
    frame.append(button);
    button.addEventListener('click',()=>open(img,button));
    link.addEventListener('click',event=>{if(event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();open(img,link);});
    const note=document.createElement('p');note.className='screenshot-preview-note';note.textContent='Detail preview · use the magnifier for the complete screenshot.';frame.after(note);
  }
})();
