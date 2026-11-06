(() => {
  'use strict';
  const cloud = window.WorkshopCloud;
  const progress = window.WorkshopProgress;
  const runParam = new URLSearchParams(location.search).get('run');
  const archive = cloud.readOnly();
  const caseLabel = record => record.case ? 'Case ' + record.case : 'Previous workshop work';
  const caseFile = record => 'case-' + record.case + '-genomic.fasta';

  function element(tag, text, className) {
    const node = document.createElement(tag);
    node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  function link(href, text, className) {
    const node = element('a',text,className);
    node.href = href;
    return node;
  }
  function download(record) {
    const node = link('downloads/summer-school-2026/' + caseFile(record),'Download assigned FASTA');
    node.download = '';
    return node;
  }
  function routeFor(record) {
    const current = record.active ? progress.snapshot() : null;
    const step = progress.steps.find(task => task.id === (current?.last || record.last)) || progress.steps[0];
    const suffix = record.active ? '' : '?run=' + encodeURIComponent(record.id);
    const previous = current && progress.missingBefore(step.page)[0];
    const target = previous || step;
    return target.page + suffix + '#' + target.id;
  }
  function scopeArchiveLink(node) {
    if (!archive) return;
    const target = new URL(node.href,location.href);
    if (target.origin !== location.origin || !/(?:\/step-[1-4]|\/workbook)\.html$/.test(target.pathname)) return;
    if (!target.searchParams.has('run')) target.searchParams.set('run',runParam);
    node.href = target.href;
  }
  if (archive) {
    document.querySelectorAll('a[href]').forEach(scopeArchiveLink);
    document.addEventListener('click',event=>{
      const node = event.target.closest('a[href]');
      if (node) scopeArchiveLink(node);
    },true);
  }

  function render() {
    const signedIn = cloud.authenticated();
    for (const node of document.querySelectorAll('[data-account-link]')) {
      node.textContent = signedIn ? 'My profile' : 'Sign in';
      node.href = signedIn ? 'profile.html' : 'register.html';
    }
    const record = cloud.run();
    const resume = document.querySelector('[data-case-resume]');
    if (resume && record?.active) {
      resume.href = routeFor(record);
      resume.textContent = 'Continue ' + caseLabel(record);
    }
    for (const box of document.querySelectorAll('[data-case-status]')) {
      box.hidden = !record && !archive;
      if (!record && !archive) continue;
      const title = element('strong',record ? caseLabel(record) : 'Earlier workbook');
      const actions = element('div','','case-actions');
      box.replaceChildren(title);
      if (record?.case) {
        box.append(element('span',caseFile(record)));
        actions.append(download(record));
      }
      actions.append(link(signedIn ? 'profile.html' : 'register.html',signedIn ? 'My profile and case history' : 'Sign in to load your cases'));
      box.append(actions);
      if (archive) box.append(element('p','Saved copy for reference. Open your active case from My profile.'));
    }
    const finished = document.querySelector('[data-case-finished]');
    if (finished) {
      finished.hidden = archive || !record || progress.snapshot().completed.length !== progress.steps.length;
      if (!finished.hidden && !cloud.profile()?.remaining) {
        finished.querySelector('a').textContent = 'Open My profile to review this workbook';
      }
    }
    const panel = document.getElementById('case-profile');
    if (!panel) return;
    panel.hidden = !signedIn;
    document.getElementById('profile-sign-in').hidden = signedIn;
    const account = cloud.profile();
    if (!signedIn || !account?.active) return;
    document.getElementById('profile-email').textContent = account.email;
    const completed = progress.snapshot().completed.length;
    const cards = account.runs.map(run => {
      const card = element('article','','case-profile-card');
      card.append(element('h3',caseLabel(run) + (run.active ? ' · Active' : '')));
      card.append(element('p',run.case ? caseFile(run) : 'Saved before automatic FASTA assignment.'));
      const count = run.active ? completed : run.completed;
      card.append(element('p',count + ' of ' + account.total + ' tasks complete'));
      const actions = element('div','','case-actions');
      if (run.case) actions.append(download(run));
      const book = link('workbook.html' + (run.active ? '' : '?run=' + encodeURIComponent(run.id)),run.active ? 'Open workbook' : 'Read workbook','workbook-link');
      book.target = 'EFI_BITCom_Workbook';
      actions.append(book,link(routeFor(run),run.active ? 'Continue this case' : 'View this route','workbook-instruction'));
      card.append(actions);
      return card;
    });
    document.getElementById('profile-cases').replaceChildren(...cards);
    document.getElementById('profile-new-case').hidden = !account.remaining || completed !== account.total;
    document.getElementById('profile-next-note').textContent = account.remaining
      ? 'Complete every task in your active case to get another FASTA.'
      : 'You have been assigned all available FASTA cases.';
  }

  const next = document.getElementById('profile-new-case');
  if (next) {
    const status = document.getElementById('profile-status');
    next.addEventListener('click',async () => {
      next.disabled = true;
      status.textContent = 'Saving this case and assigning the next FASTA…';
      try {
        await cloud.startNext();
        location.assign('step-1.html#step-1.1');
      } catch (error) {
        status.textContent = error.message === 'save_pending'
          ? 'Server saving is incomplete. Wait for your work to sync and try again.'
          : 'Could not start another case. Reload your profile and check your active case.';
        next.disabled = false;
      }
    });
    document.getElementById('profile-sign-out').addEventListener('click',cloud.signOut);
  }
  window.addEventListener('bitcom-profile',render);
  window.addEventListener('bitcom-progress',render);
  window.addEventListener('storage',event=>{
    if (event.key===cloud.storageKey('progress')) render();
  });
  render();
})();
