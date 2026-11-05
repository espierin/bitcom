(() => {
  const status=document.getElementById('ns-timer-status');
  if(!status)return;
  const key='efi-bitcom-netsurfp-deadline-v1';let deadline=0;
  try{deadline=Number(localStorage.getItem(key))||0;}catch{}
  function render(){
    if(!deadline){status.textContent='After submitting once, start the timer. You can use saved results immediately if the service fails.';return;}
    const seconds=Math.max(0,Math.ceil((deadline-Date.now())/1000));
    status.textContent=seconds?`Waiting limit: ${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')} remaining. Keep the job tab and identifier; do not resubmit.`:'Two minutes have passed. If your result is not ready, continue with the saved-results viewer below. Keep the original job; do not resubmit.';
  }
  document.getElementById('ns-timer-start').addEventListener('click',()=>{deadline=Date.now()+120000;try{localStorage.setItem(key,String(deadline));}catch{}render();});
  window.addEventListener('storage',e=>{if(e.key===key){deadline=Number(e.newValue)||0;render();}});
  render();setInterval(render,1000);
})();
