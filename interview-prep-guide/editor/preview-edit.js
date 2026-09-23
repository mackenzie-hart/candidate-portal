(function () {
  function normalizeHtml(html) {
    return String(html || '')
      .replace(/<b>/gi, '<strong>')
      .replace(/<\/b>/gi, '</strong>')
      .replace(/<i>/gi, '<em>')
      .replace(/<\/i>/gi, '</em>')
      .replace(/<div>/gi, '<p>')
      .replace(/<\/div>/gi, '</p>')
      .replace(/<p><\/p>/g, '')
      .trim();
  }

  function readValue(el) {
    const type = el.dataset.editType;
    if (type === 'html') return normalizeHtml(el.innerHTML);
    if (type === 'paragraphs') return el.innerText.replace(/\r\n/g, '\n').trim();
    return el.innerText.replace(/\s+/g, ' ').trim();
  }

  function sendUpdate(el) {
    window.parent.postMessage(
      {
        type: 'prep-edit',
        path: el.dataset.editPath,
        editType: el.dataset.editType,
        value: readValue(el),
      },
      '*'
    );
  }

  document.body.classList.add('prep-visual-mode');

  document.querySelectorAll('.prep-edit').forEach((el) => {
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && el.dataset.editType === 'text') {
        e.preventDefault();
        el.blur();
      }
    });
    el.addEventListener('blur', () => sendUpdate(el));
    // Editable text sometimes sits inside a link card (e.g. index page
    // "Explore" links) — don't let clicking-to-edit trigger navigation.
    if (el.closest('a')) {
      el.addEventListener('click', (e) => e.preventDefault());
    }
  });

  // Location cards on the hub and the "Back to Main Page" link both point
  // at another editable preview page. Left alone, clicking them navigates
  // this iframe directly — which the parent editor never finds out about,
  // so it keeps treating whatever page you last picked from the dropdown
  // as the one being edited. Any edit made after that lands on the wrong
  // page's saved content instead of the one actually on screen. Routing
  // the click through the parent (which owns currentId) keeps the two in
  // sync no matter how you get to a page.
  document.addEventListener(
    'click',
    (e) => {
      const link = e.target.closest('a[href]');
      if (!link) return;
      const match = link.getAttribute('href').match(/^\/api\/preview\/([\w-]+)(?:[/?]|$)/);
      if (!match) return;
      e.preventDefault();
      const active = document.activeElement;
      if (active && active.classList && active.classList.contains('prep-edit')) {
        sendUpdate(active);
      }
      window.parent.postMessage({ type: 'prep-navigate', id: match[1] }, '*');
    },
    true
  );
})();
