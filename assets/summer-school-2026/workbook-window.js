(() => {
  'use strict';
  const name = 'EFI_BITCom_Workbook';
  const current = new URL(location.href);
  const workbook = new URL('workbook.html', current);
  const features = 'popup=yes,width=960,height=850,resizable=yes,scrollbars=yes';
  let workshopWindow = window.opener;
  function jump(hash) {
    if (!hash) return;
    const field = document.getElementById(hash.slice(1));
    if (!field) return;
    field.scrollIntoView({block:'start'});
    if (field.tagName === 'TEXTAREA') field.focus({preventScroll:true});
  }
  // Inside the workbook, its section links stay in this window.
  if (current.pathname === workbook.pathname) {
    window.name = name;
    for (const link of document.querySelectorAll('a[href]')) {
      const url = new URL(link.href,current);
      if (url.origin === current.origin && url.pathname === workbook.pathname) link.removeAttribute('target');
    }
    window.addEventListener('pageshow', () => jump(location.hash));
    window.addEventListener('hashchange', () => jump(location.hash));
    window.addEventListener('message', event => {
      if (event.origin !== current.origin || event.data?.type !== 'efi-bitcom-workbook-jump') return;
      workshopWindow = event.source;
      if (event.data.hash === location.hash) jump(location.hash);
    });
    document.addEventListener('click', event => {
      const link = event.target.closest('a[href]');
      if (!link || event.defaultPrevented || event.button !== 0) return;
      const url = new URL(link.href, current);
      if (url.origin !== current.origin || url.pathname === workbook.pathname) return;
      if (!workshopWindow || workshopWindow.closed) {
        const opened = window.open(url.href, 'EFI_BITCom_Workshop', features);
        if (opened) {
          workshopWindow = opened;
          opened.focus();
          event.preventDefault();
        }
        return;
      }
      try {
        if (!link.hasAttribute('data-return-to-workshop')) {
          workshopWindow.location.href = url.href;
        }
        workshopWindow.focus();
        event.preventDefault();
      } catch {
        // A workbook opened independently can follow the link normally.
      }
    });
    return;
  }
  for (const link of document.querySelectorAll('a[href]')) {
    const url = new URL(link.href, current);
    if (url.origin === current.origin && url.pathname === workbook.pathname) {
      link.target = name;
      link.rel = 'noopener';
      link.classList.add('workbook-link');
      if (!link.title) link.title = 'Open in the separate workbook window';
    }
  }
  function openWorkbook(event) {
    const link = event.target.closest('a[href]');
    if (!link || event.defaultPrevented || ![0,1].includes(event.button)) return;
    const url = new URL(link.href, current);
    if (url.origin !== current.origin || url.pathname !== workbook.pathname) return;
    event.preventDefault();
    const opened = window.open('', name, features);
    const blocked = document.getElementById('workbook-popup-blocked');
    if (!opened) {
      const message = blocked || document.createElement('p');
      message.id = 'workbook-popup-blocked';
      message.setAttribute('role','alert');
      message.textContent = 'Your browser blocked the workbook window. Allow pop-ups for this site, then select the workbook link again.';
      if (!blocked) link.closest('p, li, section, nav')?.after(message);
      message.scrollIntoView({block:'nearest'});
      return;
    }
    blocked?.remove();
    try {
      const here = new URL(opened.location.href);
      if (here.origin === url.origin && here.pathname === url.pathname && here.search === url.search) {
        if (here.hash !== url.hash) opened.location.hash = url.hash;
        if (!url.hash) opened.scrollTo(0, 0);
        opened.postMessage({type:'efi-bitcom-workbook-jump',hash:url.hash}, url.origin);
      } else {
        opened.location.replace(url.href);
      }
    } catch {
      opened.location = url.href;
    }
    opened.focus();
  }
  document.addEventListener('click', openWorkbook);
  document.addEventListener('auxclick', openWorkbook);
})();
