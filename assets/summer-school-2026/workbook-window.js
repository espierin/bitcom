(() => {
  'use strict';
  const name = 'EFI_BITCom_Workbook';
  const current = new URL(location.href);
  const workbook = new URL('workbook.html', current);
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
    window.addEventListener('pageshow', () => jump(location.hash));
    window.addEventListener('hashchange', () => jump(location.hash));
    window.addEventListener('message', event => {
      if (event.origin !== current.origin || event.source !== window.opener ||
          event.data?.type !== 'efi-bitcom-workbook-jump' || event.data.hash !== location.hash) return;
      jump(location.hash);
    });
    document.addEventListener('click', event => {
      const link = event.target.closest('a.workbook-instruction');
      if (!link || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey ||
          event.shiftKey || event.altKey || !window.opener || window.opener.closed) return;
      const url = new URL(link.href, current);
      if (url.origin !== current.origin) return;
      try {
        window.opener.location.href = url.href;
        window.opener.focus();
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
    if (!link.title) link.title = url.hash ? 'Open this part of the workbook in its separate window' : 'Open workbook in a separate window';
    }
  }
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const url = new URL(link.href, current);
    if (url.origin !== current.origin || url.pathname !== workbook.pathname) return;
    // Only our own same-origin workbook uses this reusable named window.
    const opened = window.open('', name, 'popup=yes,width=960,height=850,resizable=yes,scrollbars=yes');
    if (opened) {
      event.preventDefault();
      try {
        const here = new URL(opened.location.href);
        if (here.origin === url.origin && here.pathname === url.pathname) {
          // A hash navigation preserves the already open workbook and its edits.
          if (here.hash !== url.hash) opened.location.hash = url.hash;
          else if (url.hash) opened.postMessage({type:'efi-bitcom-workbook-jump',hash:url.hash}, url.origin);
          else opened.scrollTo(0, 0);
        } else {
          opened.location.replace(url.href);
        }
      } catch {
        opened.location = url.href;
      }
      opened.focus();
    }
    // If popups are blocked, the normal target link remains available.
  });
})();
