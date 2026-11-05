(() => {
  'use strict';
  const name = 'EFI_BITCom_Workbook';
  const current = new URL(location.href);
  const workbook = new URL('workbook.html', current);
  // Inside the workbook, its section links stay in this window.
  if (current.pathname === workbook.pathname) {
    window.name = name;
    return;
  }
  for (const link of document.querySelectorAll('a[href]')) {
    const url = new URL(link.href, current);
    if (url.origin === current.origin && url.pathname === workbook.pathname) {
      link.target = name;
      link.rel = 'noopener';
      link.title = 'Open workbook in a separate window';
    }
  }
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const url = new URL(link.href, current);
    if (url.origin !== current.origin || url.pathname !== workbook.pathname) return;
    // Only our own same-origin workbook uses this reusable named window.
    const opened = window.open(url.href, name, 'popup=yes,width=960,height=850,resizable=yes,scrollbars=yes');
    if (opened) {
      event.preventDefault();
      opened.focus();
    }
    // If popups are blocked, the normal target link remains available.
  });
})();
