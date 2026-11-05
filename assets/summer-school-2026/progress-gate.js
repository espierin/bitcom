(() => {
  const progress=window.WorkshopProgress;if(!progress)return;
  const page=location.pathname.split('/').pop();
  const panel=document.createElement('section');panel.className='progress-gate';panel.hidden=true;
  const title=document.createElement('h2');title.textContent='Finish the earlier tasks first';
  const message=document.createElement('p');message.setAttribute('role','status');
  const back=document.createElement('a');back.className='action-link';
  const help=document.createElement('p');help.textContent='Mark each task complete at its end. Your workbook, help and downloads remain available. If you changed browsers, restore your JSON backup to recover completed tasks.';
  panel.append(title,message,back,help);document.querySelector('.progress-panel').after(panel);
  function explain(missing){panel.hidden=false;message.textContent=`${missing.length} earlier tasks still need to be completed.`;back.href=missing[0].page+'#'+missing[0].id;back.textContent='Go to '+missing[0].title;}
  function render(){
    progress.snapshot();const missing=progress.missingBefore(page);
    document.querySelectorAll('.manual-step,.page-turn').forEach(el=>{el.hidden=missing.length>0;});
    if(missing.length)explain(missing);else panel.hidden=true;
    document.querySelectorAll('a[href]').forEach(a=>{
      const url=new URL(a.href,location.href);if(url.origin!==location.origin)return;
      const target=url.pathname.split('/').pop();if(!/^step-[1-4]\.html$/.test(target))return;
      const locked=progress.missingBefore(target).length>0;
      if(locked){a.setAttribute('aria-disabled','true');a.dataset.progressLocked=target;a.title='Complete all tasks on the preceding pages first';}
      else if(a.dataset.progressLocked){a.removeAttribute('aria-disabled');delete a.dataset.progressLocked;a.removeAttribute('title');}
    });
  }
  document.addEventListener('click',event=>{const a=event.target.closest('a[data-progress-locked]');if(!a)return;progress.snapshot();const missing=progress.missingBefore(a.dataset.progressLocked);if(!missing.length){render();return;}event.preventDefault();explain(missing);panel.scrollIntoView({block:'center'});back.focus({preventScroll:true});});
  window.addEventListener('bitcom-progress',render);window.addEventListener('storage',render);render();
})();
