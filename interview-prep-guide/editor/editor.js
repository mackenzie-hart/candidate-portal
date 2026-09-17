let previewMode = sessionStorage.getItem('prep-editor-preview-mode') || 'desktop';
let pages = [];
let currentId = null;
let currentContent = null;
let dirty = false;
let formVisible = false;

const $ = (sel) => document.querySelector(sel);
const preview = $('#preview');
const previewEmpty = $('#preview-empty');
const statusEl = $('#status');
const formRoot = $('#form-root');
const pageSelect = $('#page-select');
const pageHint = $('#page-hint');
const sidebar = $('#sidebar');
const btnToggleForm = $('#btn-toggle-form');

function setStatus(msg, type = '') {
  statusEl.textContent = msg;
  statusEl.className = `status ${type}`;
}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('json')) return res.json();
  return res.text();
}

function setPreviewMode(mode) {
  previewMode = mode === 'mobile' ? 'mobile' : 'desktop';
  sessionStorage.setItem('prep-editor-preview-mode', previewMode);
  const panel = $('#preview-panel');
  panel?.classList.toggle('mobile', previewMode === 'mobile');
  document.querySelectorAll('.preview-mode-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.previewMode === previewMode);
  });
}

function initPreviewModeToggle() {
  setPreviewMode(previewMode);
  document.querySelectorAll('.preview-mode-btn').forEach((btn) => {
    btn.addEventListener('click', () => setPreviewMode(btn.dataset.previewMode));
  });
}

function isLocked(id) {
  return LocationForm.LOCKED_SLUGS.has(id);
}

function markDirty() {
  dirty = true;
  setStatus('Unsaved changes — click Save changes', 'warn');
}

function showPreview(html, mode = 'srcdoc') {
  if (mode === 'srcdoc') {
    preview.removeAttribute('src');
    preview.srcdoc = html;
  } else {
    preview.removeAttribute('srcdoc');
    preview.src = html;
  }
  preview.addEventListener(
    'load',
    () => {
      previewEmpty.style.display = 'none';
    },
    { once: true }
  );
}

function showPreviewError(message) {
  previewEmpty.textContent = message;
  previewEmpty.style.display = 'flex';
  preview.removeAttribute('srcdoc');
  preview.removeAttribute('src');
}

async function refreshVisualPreview() {
  if (!currentId || !currentContent) return;
  try {
    previewEmpty.textContent = 'Loading preview…';
    previewEmpty.style.display = 'flex';
    const editable = true;
    const html = await api('/api/preview-draft', {
      method: 'POST',
      body: JSON.stringify({ id: currentId, data: currentContent, editable }),
    });
    showPreview(html, 'srcdoc');
  } catch (e) {
    showPreviewError(`Preview failed: ${e.message}`);
    setStatus(e.message, 'err');
  }
}

function setFormVisible(visible) {
  formVisible = visible;
  sidebar.classList.toggle('sidebar--form-open', visible);
  document.querySelector('.workspace')?.classList.toggle('sidebar-expanded', visible);
  btnToggleForm.textContent = visible ? 'Hide form fields' : 'Show form fields';
  if (visible && currentContent && currentId !== 'index' && !isLocked(currentId)) {
    formRoot.innerHTML = LocationForm.renderLocationForm(currentContent);
    bindRichEditors(formRoot, markDirty);
    formRoot.querySelectorAll('.input').forEach((el) => {
      el.addEventListener('input', markDirty);
    });
    LocationForm.bindBlockActions(formRoot, currentContent, () => {
      LocationForm.readFormIntoContent(formRoot, currentContent);
      setFormVisible(true);
      markDirty();
      refreshVisualPreview();
    });
  }
}

function renderPage() {
  if (!currentContent || !currentId) return;

  pageHint.textContent =
    'Click any text on the preview to edit it. When you click away, your change is remembered. Click Save changes to write the JSON files.';

  const isIndex = currentId === 'index';
  btnToggleForm.disabled = isIndex;
  btnToggleForm.title = isIndex ? 'Form fields aren’t available for the main hub — edit it on the preview.' : '';
  if (isIndex && formVisible) setFormVisible(false);
  else if (formVisible) setFormVisible(true);

  refreshVisualPreview();
}

async function loadPages() {
  pages = await api('/api/pages');

  pageSelect.innerHTML = pages
    .map((p) => `<option value="${p.id}">${p.label}</option>`)
    .join('');

  const saved = sessionStorage.getItem('prep-editor-page');
  const firstEditable = pages[0]?.id;
  currentId = saved && pages.some((p) => p.id === saved) ? saved : firstEditable;
  pageSelect.value = currentId;
  await loadPage(currentId);
}

async function loadPage(id) {
  if (dirty && !confirm('You have unsaved changes. Switch city anyway?')) {
    pageSelect.value = currentId;
    return;
  }

  currentId = id;
  sessionStorage.setItem('prep-editor-page', id);
  dirty = false;
  currentContent = await api(`/api/content/${id}`);
  renderPage();
  setStatus('Ready — click text on the preview to edit', 'ok');
}

function normalizePreviewHtml(html) {
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

function readPreviewEditValue(el) {
  const type = el.dataset.editType;
  if (type === 'html') return normalizePreviewHtml(el.innerHTML);
  if (type === 'paragraphs') return el.innerText.replace(/\r\n/g, '\n').trim();
  return el.innerText.replace(/\s+/g, ' ').trim();
}

// Clicking "Save changes" blurs whatever contenteditable field was just
// edited, but that field's blur handler notifies us via postMessage —
// which is delivered asynchronously. Without this, Save's own click
// handler can run and read currentContent before that message arrives,
// silently dropping the edit you just made. Reading straight from the
// (same-origin) iframe DOM avoids depending on that message ever landing.
function syncPendingEdits() {
  if (!currentContent) return;
  let doc;
  try {
    doc = preview.contentDocument;
  } catch {
    return;
  }
  if (!doc) return;
  doc.querySelectorAll('.prep-edit[data-edit-path]').forEach((el) => {
    LocationForm.applyVisualEdit(
      currentContent,
      el.dataset.editPath,
      el.dataset.editType,
      readPreviewEditValue(el)
    );
  });
}

async function savePage() {
  if (!currentId) return;
  try {
    syncPendingEdits();
    const payload = structuredClone(currentContent);
    if (formVisible) {
      LocationForm.readFormIntoContent(formRoot, payload);
    }
    await api(`/api/content/${currentId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    currentContent = payload;
    dirty = false;
    setStatus(
      currentId === 'index'
        ? 'Saved main hub JSON + HTML'
        : currentId === 'redwood-city'
          ? 'Saved Redwood City JSON + HTML'
          : 'Saved JSON + HTML (Redwood City unchanged unless you edited it)',
      'ok'
    );
    refreshVisualPreview();
  } catch (e) {
    setStatus(e.message, 'err');
  }
}

window.addEventListener('message', (event) => {
  if (event.data?.type !== 'prep-edit' || !currentContent) return;
  LocationForm.applyVisualEdit(
    currentContent,
    event.data.path,
    event.data.editType,
    event.data.value
  );
  markDirty();
});

$('#btn-save').addEventListener('click', savePage);
$('#btn-rebuild').addEventListener('click', async () => {
  try {
    await api('/api/build', {
      method: 'POST',
      body: JSON.stringify({ excludeSlugs: ['redwood-city'] }),
    });
    setStatus('Rebuilt all cities except Redwood City', 'ok');
    refreshVisualPreview();
  } catch (e) {
    setStatus(e.message, 'err');
  }
});
$('#btn-rebuild-all').addEventListener('click', async () => {
  if (
    !confirm(
      'Rebuild every city page from JSON, including Redwood City? Only do this if you and your teammate agree — it overwrites the HTML files.'
    )
  ) {
    return;
  }
  try {
    await api('/api/build', {
      method: 'POST',
      body: JSON.stringify({ excludeSlugs: [] }),
    });
    setStatus('Rebuilt all cities including Redwood City', 'ok');
    refreshVisualPreview();
  } catch (e) {
    setStatus(e.message, 'err');
  }
});
$('#btn-refresh-preview').addEventListener('click', refreshVisualPreview);
$('#btn-toggle-form').addEventListener('click', () => setFormVisible(!formVisible));
pageSelect.addEventListener('change', () => loadPage(pageSelect.value));

window.addEventListener('beforeunload', (e) => {
  if (dirty) e.preventDefault();
});

initPreviewModeToggle();
loadPages().catch((e) => setStatus(e.message, 'err'));
