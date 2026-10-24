(() => {
'use strict';
const pdfjsLib = window.pdfjsLib;
pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
const { PDFDocument, StandardFonts, rgb, degrees, BlendMode, LineCapStyle } = PDFLib;

/* ---------- icons ---------- */
const IC = {
  redact:'M4 5h16v14H4zM7 12h10',
  shape:'M4 4h9v9H4zM11 11h9v9h-9z',
  stamp:'M7 14h10l1 4H6zM12 4a3 3 0 013 3c0 2-1 3-1 5h-4c0-2-1-3-1-5a3 3 0 013-3z',
  select:'M5 3l13 7-6 1.6L9 18z',
  edit:'M4 7V5h11v2M9.5 5v13M7 18h5M14 15l6-6 2 2-6 6h-2z',
  text:'M5 6V4h14v2M12 4v16M9 20h6',
  sign:'M3 16c3-1 4-8 6-8s0 7 2 7 3-4 4-4 1 3 3 3 2-1 3-1M3 20h18',
  image:'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15.5 9.5h.01',
  white:'M15 4l5 5-9 9H6l-3-3zM9 10l5 5M11 18h9',
  hl:'M8 15l-3 3h6M13 4l6 6-7 7-6-6z',
  draw:'M4 20l4-1 11-11-3-3L5 16zM14 7l3 3',
  check:'M4 12.5l5 5L20 6.5',
  date:'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  undo:'M9 14L4 9l5-5M4 9h11a5 5 0 010 10h-3',
  redo:'M15 14l5-5-5-5M20 9H9a5 5 0 000 10h3',
  plus:'M12 5v14M5 12h14', minus:'M5 12h14',
  fit:'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  rot:'M20 11a8 8 0 11-2.3-5.7M20 4v5h-5',
  rotl:'M4 11a8 8 0 102.3-5.7M4 4v5h5',
  trash:'M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13',
  copy:'M8 8h12v12H8zM4 16V4h12',
  up:'M12 19V5M6 11l6-6 6 6', down:'M12 5v14M6 13l6 6 6-6',
  pages:'M6 3h9l4 4v14H6zM14 3v5h5', sliders:'M4 7h10M18 7h2M4 17h4M12 17h8M14 5v4M8 15v4',
  form:'M3 7h18v10H3zM7 10v4',
  ftext:'M3 8h18v8H3zM6.5 10.5v3', fmulti:'M3 5h18v14H3zM6.5 8.5h11M6.5 12h11M6.5 15.5h6',
  fcheck:'M5 5h14v14H5zM8.5 12l2.5 2.5 4.5-5', fradio:'M12 4a8 8 0 100 16 8 8 0 000-16zM12 10a2 2 0 100 4 2 2 0 000-4z', fchoice:'M3 7h18v10H3zM14.5 11l2 2 2-2',
  close:'M6 6l12 12M18 6L6 18', ocr:'M4 7V4h3M17 4h3v3M20 17v3h-3M7 20H4v-3M8 10h8M8 14h5'
};
const svg = (k, sw=1.8) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${IC[k]}"/></svg>`;

/* ---------- state ---------- */
const S = {
  sources: [], pages: [], formVals: {}, imgs: {}, sigs: [],
  tool: 'select', zoom: 1, sel: null, editing: null, pending: null,
  selPages: new Set(), cur: 0, docName: 'sample-form', isSample: true, flatten: false,
  tdef: { font: 'Arial', size: 12, color: '#111111', bold: false },
  ink: '#1d3fa6', inkW: 2, hl: '#ffe14d', checkMark: 'check', checkSize: 14, checkColor: '#111111',
  shape: 'rect', stamp: 0, fieldType: 'text', radioGroup: null,
  undo: [], redo: []
};
const FONT_CSS = { Arial: 'Arial, Helvetica, sans-serif', Helvetica: 'Helvetica, Arial, sans-serif', 'Times New Roman': '"Times New Roman", Times, serif', Times: 'Times, "Times New Roman", serif', 'Courier New': '"Courier New", Courier, monospace', Courier: 'Courier, "Courier New", monospace' };
const INKS = ['#111111', '#1d3fa6', '#b42318', '#1f7a4d'];
const STAMPS = [['APPROVED', '#1f7a4d'], ['PAID', '#1f7a4d'], ['REVIEWED', '#1d3fa6'], ['DRAFT', '#6b7280'], ['CONFIDENTIAL', '#b42318'], ['REJECTED', '#b42318'], ['VOID', '#b42318']];
const HLS = ['#ffe14d', '#9cf29a', '#9fd8ff', '#ffb3d9'];
let uidN = 1; const nid = () => 'n' + (uidN++).toString(36) + Math.random().toString(36).slice(2, 6);
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const el = (tag, cls) => { const e = document.createElement(tag); if (cls) e.className = cls; return e; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pageById = id => S.pages.find(p => p.id === id);
const dispRot = p => (((p.baseRot || 0) + p.rot) % 360 + 360) % 360;
const r1 = v => Math.round(v * 10) / 10;

/* ---------- toast / busy ---------- */
let toastT;
function toast(msg, kind) { const t = $('#toast'); t.textContent = msg; t.className = 'toast' + (kind ? ' ' + kind : ''); t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, kind === 'err' ? 6000 : 2800); }
function busy(msg) { $('#busy').hidden = !msg; if (msg) $('#busyText').textContent = msg; }
const tick = () => new Promise(r => setTimeout(r, 0));

/* ---------- downloads ---------- */
const dlPromise = (window.claude && window.claude.use) ? window.claude.use('downloads').catch(() => null) : Promise.resolve(null);
async function saveFile(name, blob) {
  const dl = await dlPromise;
  if (dl) {
    try { await dl.save({ filename: name, data: blob }); toast('Saved ' + name); return; }
    catch (e) {
      if (e && e.code === 'declined') { toast('Download cancelled'); return; }
      if (e && e.code === 'rate_limited') { toast('A download prompt is already open. Try again in a moment.', 'err'); return; }
      if (e && !['unavailable', 'not_granted', 'capability_disabled', 'capability_removed'].includes(e.code)) { toast('Could not save: ' + (e.message || e.code), 'err'); return; }
    }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000); toast('Downloaded ' + name);
}

/* ---------- images ---------- */
const imgElCache = new Map();
function loadImg(url) {
  if (imgElCache.has(url)) return imgElCache.get(url);
  const p = new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('This image format is not supported by your browser')); i.src = url; });
  imgElCache.set(url, p); return p;
}
function addImg(bytes, type, w, h) {
  const id = nid(); const url = URL.createObjectURL(new Blob([bytes], { type: type === 'png' ? 'image/png' : 'image/jpeg' }));
  S.imgs[id] = { bytes, type, url, w, h }; return id;
}
const canvasBlob = (c, type = 'image/png', q) => new Promise(r => c.toBlob(r, type, q));
async function fileToImg(file, whiteToAlpha = false) {
  const url = URL.createObjectURL(file);
  try {
    const im = await loadImg(url);
    const w = im.naturalWidth, h = im.naturalHeight;
    if (/png/i.test(file.type) && !whiteToAlpha) return addImg(new Uint8Array(await file.arrayBuffer()), 'png', w, h);
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
    const keepAlpha = whiteToAlpha || /png|gif|webp|svg/i.test(file.type);
    if (!keepAlpha) { x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); }
    x.drawImage(im, 0, 0);
    if (whiteToAlpha) {
      const d = x.getImageData(0, 0, w, h), a = d.data;
      for (let i = 0; i < a.length; i += 4) { const l = (a[i] + a[i + 1] + a[i + 2]) / 3; if (l > 200) a[i + 3] = Math.round(clamp((255 - l) / 55, 0, 1) * a[i + 3]); }
      x.putImageData(d, 0, 0);
    }
    const blob = await canvasBlob(c, keepAlpha ? 'image/png' : 'image/jpeg', .92);
    return addImg(new Uint8Array(await blob.arrayBuffer()), keepAlpha ? 'png' : 'jpg', w, h);
  } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
}
function dataUrlBytes(du) { const b = atob(du.split(',')[1]); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }

/* ---------- loading documents ---------- */
const tcCache = new Map();
async function addPdfSource(bytes, name) {
  let pdf;
  try { pdf = await pdfjsLib.getDocument({ data: bytes.slice(0), isEvalSupported: false }).promise; }
  catch (e) { if (e && e.name === 'PasswordException') throw new Error(name + ' is password-protected. Remove the password and try again.'); throw new Error(name + ' could not be read as a PDF.'); }
  const src = S.sources.push({ name, bytes, pdf }) - 1;
  const out = [];
  for (let i = 0; i < pdf.numPages; i++) {
    const pg = await pdf.getPage(i + 1);
    const view = pg.view.slice();
    const p = { id: nid(), kind: 'pdf', src, idx: i, rot: 0, baseRot: pg.rotate || 0, w: view[2] - view[0], h: view[3] - view[1], view, annots: [], fields: [], ocr: null };
    try { p.fields = parseFields(await pg.getAnnotations({ intent: 'display' }), view, src); } catch (e) {}
    out.push(p);
  }
  return out;
}
function parseFields(anns, view, src) {
  const f = [];
  for (const a of anns) {
    if (a.subtype !== 'Widget' || !a.fieldName || a.hidden) continue;
    const r = a.rect;
    const fld = { key: src + ':' + a.fieldName, name: a.fieldName, x: Math.min(r[0], r[2]) - view[0], y: view[3] - Math.max(r[1], r[3]), w: Math.abs(r[2] - r[0]), h: Math.abs(r[3] - r[1]), ro: !!a.readOnly };
    const has = fld.key in S.formVals;
    if (a.fieldType === 'Tx') { fld.type = 'text'; fld.multi = !!a.multiLine; fld.max = a.maxLen || 0; fld.fs = a.textFormat ? 0 : 0; if (!has) S.formVals[fld.key] = a.fieldValue || ''; }
    else if (a.fieldType === 'Btn' && a.checkBox) { fld.type = 'check'; if (!has) S.formVals[fld.key] = !!a.fieldValue && a.fieldValue !== 'Off'; }
    else if (a.fieldType === 'Btn' && a.radioButton) { fld.type = 'radio'; fld.on = a.buttonValue; if (!has) S.formVals[fld.key] = (a.fieldValue && a.fieldValue !== 'Off') ? a.fieldValue : ''; }
    else if (a.fieldType === 'Ch') { fld.type = 'choice'; fld.options = (a.options || []).map(o => ({ v: o.exportValue, l: o.displayValue })); if (!has) S.formVals[fld.key] = Array.isArray(a.fieldValue) ? (a.fieldValue[0] || '') : (a.fieldValue || ''); }
    else continue;
    f.push(fld);
  }
  return f;
}
const A4 = [595.28, 841.89];
async function imagePage(file) {
  const id = await fileToImg(file);
  const im = S.imgs[id];
  const land = im.w > im.h;
  const [w, h] = land ? [A4[1], A4[0]] : A4;
  const m = 18, s = Math.min((w - 2 * m) / im.w, (h - 2 * m) / im.h);
  const bw = im.w * s, bh = im.h * s;
  return { id: nid(), kind: 'image', img: id, rot: 0, baseRot: 0, w, h, view: [0, 0, w, h], box: { x: (w - bw) / 2, y: (h - bh) / 2, w: bw, h: bh }, annots: [], fields: [], ocr: null };
}
const isPdf = f => /pdf/i.test(f.type) || /\.pdf$/i.test(f.name);
const isImg = f => /^image\//i.test(f.type) || /\.(png|jpe?g|webp|gif|bmp)$/i.test(f.name);

async function openFiles(files, mode, at) {
  files = [...files].filter(f => isPdf(f) || isImg(f));
  if (!files.length) { toast('Choose a PDF or an image file (PNG, JPG, WebP).', 'err'); return; }
  busy('Opening ' + (files.length > 1 ? files.length + ' files' : files[0].name) + '…');
  try {
    if (mode === 'replace') {
      S.sources = []; tcCache.clear(); thumbCache.clear(); S.formVals = {}; S.undo = []; S.redo = []; S.selPages.clear(); S.sel = null; S.editing = null;
      S.isSample = false; S.docName = files[0].name.replace(/\.[^.]+$/, '') || 'document';
    }
    const np = [];
    for (const f of files) { if (isPdf(f)) np.push(...await addPdfSource(new Uint8Array(await f.arrayBuffer()), f.name)); else np.push(await imagePage(f)); }
    if (mode === 'replace') { S.pages = np; S.cur = 0; fitZoom(); }
    else { checkpoint(); const pos = at == null ? S.pages.length : at; S.pages.splice(pos, 0, ...np); }
    rebuild(); updateHeader();
    if (mode !== 'replace') { toast(`Added ${np.length} page${np.length > 1 ? 's' : ''}`); scrollToPage(S.pages.indexOf(np[0])); }
  } catch (e) { toast(e.message || 'Could not open that file.', 'err'); }
  finally { busy(null); }
}

/* ---------- undo ---------- */
const snap = () => JSON.stringify({ pages: S.pages, formVals: S.formVals });
function checkpoint() { S.undo.push(snap()); if (S.undo.length > 80) S.undo.shift(); S.redo = []; syncUndo(); }
function restore(json) {
  const before = structKey(); const d = JSON.parse(json); S.pages = d.pages; S.formVals = d.formVals; S.sel = null; S.editing = null;
  if (structKey() === before) { S.pages.forEach(p => { renderForm(p); renderAnnots(p); }); renderInspector(); } else rebuild();
  syncUndo();
}
const structKey = () => S.pages.map(p => p.id + ':' + p.rot).join('|') + '@' + S.zoom;
function undo() { commitEdit(); if (!S.undo.length) return; S.redo.push(snap()); restore(S.undo.pop()); }
function redo() { if (!S.redo.length) return; S.undo.push(snap()); restore(S.redo.pop()); }
function syncUndo() { $('#bUndo').disabled = !S.undo.length; $('#bRedo').disabled = !S.redo.length; }

/* ---------- stage ---------- */
const stage = $('#stage'), stageInner = $('#stageInner');
const pageEls = new Map();
const io = new IntersectionObserver(es => { for (const e of es) if (e.isIntersecting) paintPage(e.target.dataset.id); }, { root: stage, rootMargin: '800px 0px' });

function rebuild() { buildStage(); buildThumbs(); renderInspector(); syncUndo(); updatePageNo(); updateHeader(); }

function buildStage() {
  io.disconnect(); stageInner.innerHTML = ''; pageEls.clear();
  if (!S.pages.length) {
    const fresh = !S.sources.length; const e = el('div', 'empty'); e.innerHTML = fresh ? `<div class="dz"><h3>Open a PDF to get started</h3><p class="note">Drop a PDF or images anywhere on this page. Fill forms, sign, edit text and rearrange pages, then export.</p><div class="btnrow" style="justify-content:center"><button class="btn primary" id="emptyOpen">Open a PDF or images</button><button class="btn" id="emptySample">Try a sample form</button><button class="btn" id="emptyRestore" hidden></button></div></div>` : `<div class="card" style="max-width:340px;text-align:center;align-items:center"><h3>No pages left</h3><p class="note">Open a PDF, drop files here, or add a blank page from the Pages panel.</p><button class="btn primary" id="emptyOpen">Open a file</button></div>`;
    stageInner.append(e); $('#emptyOpen').onclick = () => $('#fOpen').click(); const sb = $('#emptySample'); if (sb) sb.onclick = loadSample; const rb = $('#emptyRestore'); if (rb && lastSession) { rb.hidden = false; rb.textContent = 'Restore ' + lastSession.docName + '.pdf (' + new Date(lastSession.t).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) + ')'; rb.onclick = restoreSession; } return;
  }
  const z = S.zoom;
  S.pages.forEach((p, i) => {
    const rot = dispRot(p), W = p.w * z, H = p.h * z;
    const holder = el('div', 'pageholder');
    const wrap = el('div', 'pagewrap'); wrap.dataset.id = p.id;
    wrap.style.width = (rot % 180 ? H : W) + 'px'; wrap.style.height = (rot % 180 ? W : H) + 'px';
    const inner = el('div', 'page'); inner.style.width = W + 'px'; inner.style.height = H + 'px';
    inner.style.transform = `translate(-50%,-50%) rotate(${rot}deg)`;
    const canvas = el('canvas'); canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    const tl = el('div', 'textlayer'), fl = el('div', 'formlayer'), al = el('div', 'annotlayer');
    inner.append(canvas, tl, fl, al); wrap.append(inner);
    const lab = el('div', 'pagelabel'); lab.textContent = `Page ${i + 1} of ${S.pages.length}`;
    holder.append(wrap, lab); stageInner.append(holder);
    pageEls.set(p.id, { holder, wrap, inner, canvas, tl, fl, al, key: '' });
    renderForm(p); renderAnnots(p); io.observe(wrap);
  });
  $('#zoomVal').textContent = Math.round(z * 100) + '%';
  if (fm && fm.length) paintFind();
}

async function drawBase(p, ctx, scale) {
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  if (p.kind === 'pdf') {
    const pg = await S.sources[p.src].pdf.getPage(p.idx + 1);
    await pg.render({ canvasContext: ctx, viewport: pg.getViewport({ scale, rotation: 0 }), annotationMode: pdfjsLib.AnnotationMode.ENABLE_FORMS }).promise;
  } else if (p.kind === 'image') {
    const im = await loadImg(S.imgs[p.img].url); const b = p.box;
    ctx.drawImage(im, b.x * scale, b.y * scale, b.w * scale, b.h * scale);
  }
}
async function paintPage(id) {
  const p = pageById(id), E = pageEls.get(id); if (!p || !E) return;
  const key = S.zoom + ':' + id; if (E.key === key) return; E.key = key;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const c = E.canvas; c.width = Math.round(p.w * S.zoom * dpr); c.height = Math.round(p.h * S.zoom * dpr);
  try { await drawBase(p, c.getContext('2d'), S.zoom * dpr); } catch (e) { console.warn(e); }
  renderTextLayer(p);
}

async function getText(p) {
  if (p.kind !== 'pdf') return { items: [], styles: {} };
  const k = p.src + ':' + p.idx;
  if (!tcCache.has(k)) { const pg = await S.sources[p.src].pdf.getPage(p.idx + 1); tcCache.set(k, await pg.getTextContent()); }
  return tcCache.get(k);
}
function textItems(p, tc) {
  const v = p.view, out = [];
  for (const it of tc.items) {
    if (!it.str || !it.str.trim()) continue;
    const [a, b, c, d, e, f] = it.transform;
    const size = Math.hypot(c, d) || Math.hypot(a, b); if (!size) continue;
    const st = tc.styles[it.fontName] || {};
    const asc = st.ascent || 0.8;
    const base = v[3] - f;
    const n = { str: it.str, x: e - v[0], base, y: base - size * asc, w: it.width, h: size, size, angle: Math.atan2(b, a), family: st.fontFamily || 'sans-serif' };
    const pv = out[out.length - 1];
    if (pv && !n.angle && !pv.angle && Math.abs(pv.base - n.base) < size * .3 && Math.abs(pv.size - size) < .6) {
      const gap = n.x - (pv.x + pv.w);
      if (gap > -size * .5 && gap < size * .45) { pv.str += (gap > size * .15 && !/\s$/.test(pv.str) && !/^\s/.test(n.str) ? ' ' : '') + n.str; pv.w = Math.max(pv.w, n.x + n.w - pv.x); continue; }
    }
    out.push(n);
  }
  for (const l of p.ocr || []) out.push({ str: l.text, x: l.x, base: l.y + l.h * .8, y: l.y, w: l.w, h: l.h, size: l.h, angle: 0, family: 'sans-serif', ocr: true });
  return out;
}
const measureCtx = document.createElement('canvas').getContext('2d');
async function renderTextLayer(p) {
  const E = pageEls.get(p.id); if (!E) return;
  const items = textItems(p, await getText(p));
  if (!pageEls.get(p.id) || pageEls.get(p.id) !== E) return;
  const z = S.zoom, frag = document.createDocumentFragment();
  items.forEach((it, i) => {
    const s = el('span'); s.textContent = it.str; s.dataset.i = i;
    const fs = it.size * z, fam = /serif/i.test(it.family) && !/sans/i.test(it.family) ? 'serif' : /mono/i.test(it.family) ? 'monospace' : 'sans-serif';
    s.style.left = it.x * z + 'px'; s.style.top = (it.base - it.size * 0.8) * z + 'px';
    s.style.fontSize = fs + 'px'; s.style.fontFamily = fam;
    measureCtx.font = `${fs}px ${fam}`;
    const mw = measureCtx.measureText(it.str).width || 1;
    const sx = it.w > 0 ? (it.w * z) / mw : 1;
    s.style.transform = `${it.angle ? `rotate(${-it.angle}rad) ` : ''}scaleX(${sx})`;
    frag.append(s);
  });
  E.tl.innerHTML = ''; E.tl.append(frag); E.items = items;
}

/* ---------- form layer ---------- */
function renderForm(p) {
  const E = pageEls.get(p.id); if (!E) return; const z = S.zoom; E.fl.innerHTML = '';
  for (const f of p.fields) {
    let n;
    if (f.type === 'text') {
      n = el(f.multi ? 'textarea' : 'input', 'fld'); if (!f.multi) n.type = 'text';
      n.value = S.formVals[f.key] ?? ''; if (f.max) n.maxLength = f.max;
      n.style.fontSize = clamp(f.multi ? 10 : f.h * .62, 6, 14) * z + 'px';
      n.oninput = () => { S.formVals[f.key] = n.value; syncField(f.key, n); };
    } else if (f.type === 'check') {
      n = el('input', 'fld'); n.type = 'checkbox'; n.checked = !!S.formVals[f.key];
      n.onchange = () => { S.formVals[f.key] = n.checked; syncField(f.key, n); };
    } else if (f.type === 'radio') {
      n = el('input', 'fld'); n.type = 'radio'; n.name = 'r_' + f.key; n.value = f.on; n.checked = S.formVals[f.key] === f.on;
      n.onchange = () => { if (n.checked) { S.formVals[f.key] = f.on; syncField(f.key, n); } };
    } else if (f.type === 'choice') {
      n = el('select', 'fld'); n.append(new Option('', ''));
      for (const o of f.options) n.append(new Option(o.l, o.v));
      n.value = S.formVals[f.key] ?? ''; n.style.fontSize = clamp(f.h * .6, 6, 13) * z + 'px';
      n.onchange = () => { S.formVals[f.key] = n.value; syncField(f.key, n); };
    }
    n.dataset.key = f.key; n.title = f.name; n.disabled = f.ro; n.setAttribute('aria-label', f.name.replace(/[_.]/g, ' '));
    n.style.left = f.x * z + 'px'; n.style.top = f.y * z + 'px'; n.style.width = f.w * z + 'px'; n.style.height = f.h * z + 'px';
    E.fl.append(n);
  }
}
function syncField(key, src) {
  for (const n of $$('.formlayer [data-key]')) {
    if (n === src || n.dataset.key !== key) continue;
    if (n.type === 'checkbox') n.checked = !!S.formVals[key];
    else if (n.type === 'radio') n.checked = n.value === S.formVals[key];
    else n.value = S.formVals[key];
  }
}

/* ---------- annotations ---------- */
function lineGeom(a) { const fx = a.flipX, fy = a.flipY; return { x1: fx ? a.w : 0, y1: fy ? a.h : 0, x2: fx ? 0 : a.w, y2: fy ? 0 : a.h }; }
function headSegs(x1, y1, x2, y2, sw) { const ang = Math.atan2(y2 - y1, x2 - x1), L = 5 + sw * 3; return [-1, 1].map(k => [x2, y2, x2 - L * Math.cos(ang + k * .45), y2 - L * Math.sin(ang + k * .45)]); }
function shapeSvg(a) {
  const w = Math.max(a.w, .1), h = Math.max(a.h, .1), sw = a.width, st = `fill="none" stroke="${a.color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"`; let g = '';
  if (a.kind === 'rect') g = `<rect x="${sw / 2}" y="${sw / 2}" width="${Math.max(w - sw, 0)}" height="${Math.max(h - sw, 0)}" ${st}/>`;
  else if (a.kind === 'ellipse') g = `<ellipse cx="${w / 2}" cy="${h / 2}" rx="${Math.max((w - sw) / 2, 0)}" ry="${Math.max((h - sw) / 2, 0)}" ${st}/>`;
  else { const { x1, y1, x2, y2 } = lineGeom(a); g = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${st}/>`; if (a.kind === 'arrow') g += headSegs(x1, y1, x2, y2, sw).map(q => `<line x1="${q[0]}" y1="${q[1]}" x2="${q[2]}" y2="${q[3]}" ${st}/>`).join(''); }
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="overflow:visible">${g}</svg>`;
}
function annotEl(a) {
  const z = S.zoom, d = el('div', 'annot t-' + a.type); d.dataset.id = a.id;
  d.style.left = a.x * z + 'px'; d.style.top = a.y * z + 'px';
  if (a.type !== 'text') { d.style.width = a.w * z + 'px'; d.style.height = a.h * z + 'px'; }
  switch (a.type) {
    case 'text':
      styleText(d, a); d.textContent = a.text; break;
    case 'white': case 'hl':
      d.style.background = a.color; d.style.opacity = a.opacity ?? 1; break;
    case 'image': {
      const i = el('img'); i.src = S.imgs[a.img]?.url || ''; i.alt = ''; i.draggable = false; d.style.opacity = a.opacity ?? 1; d.append(i); break; }
    case 'draw': {
      const pts = a.pts.map(q => q.join(',')).join(' ');
      d.innerHTML = `<svg viewBox="0 0 ${Math.max(a.w, .1)} ${Math.max(a.h, .1)}" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="${a.color}" stroke-width="${a.width}" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" style="stroke-width:${a.width * z}px"/></svg>`; break; }
    case 'shape': d.innerHTML = shapeSvg(a); break;
    case 'check':
      d.innerHTML = `<svg viewBox="0 0 24 24">${a.mark === 'dot' ? `<circle cx="12" cy="12" r="6" fill="${a.color}"/>` : `<path d="${a.mark === 'cross' ? 'M5 5l14 14M19 5L5 19' : 'M4 12.5l5 5L20 6.5'}" fill="none" stroke="${a.color}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`}</svg>`; break;
    case 'field': fieldEl(d, a); break;
  }
  return d;
}
function styleText(d, a) {
  const z = S.zoom; d.style.fontSize = a.size * z + 'px'; d.style.fontFamily = FONT_CSS[a.font]; d.style.fontWeight = a.bold ? '700' : '400'; d.style.color = a.color; d.style.background = a.bg || '';
}
function renderAnnots(p) {
  const E = pageEls.get(p.id); if (!E) return;
  E.al.innerHTML = '';
  for (const a of p.annots) E.al.append(annotEl(a));
  if (S.sel && S.sel.page === p.id) drawSelBox();
}
const annotDom = id => stage.querySelector(`.annot[data-id="${id}"]`);
function drawSelBox() {
  $$('.selbox').forEach(n => n.remove());
  if (!S.sel) return;
  const p = pageById(S.sel.page), d = annotDom(S.sel.id), E = p && pageEls.get(p.id); if (!d || !E) return;
  const b = el('div', 'selbox');
  b.style.left = d.offsetLeft + 'px'; b.style.top = d.offsetTop + 'px'; b.style.width = d.offsetWidth + 'px'; b.style.height = d.offsetHeight + 'px';
  b.innerHTML = `<div class="hdl" title="Resize"></div><button class="adel" title="Delete (Del)">${svg('trash', 2.2).replace('<svg', '<svg style="width:13px;height:13px"')}Delete</button>`;
  E.al.append(b);
}
function getSel() { if (!S.sel) return null; const p = pageById(S.sel.page); const a = p && p.annots.find(x => x.id === S.sel.id); return a ? { p, a } : null; }
function select(p, a) {
  if (S.editing && (!a || S.editing !== a.id)) commitEdit();
  S.sel = a ? { page: p.id, id: a.id } : null;
  drawSelBox(); renderInspector();
}
function addAnnot(p, a, sel = true) { a.id = nid(); p.annots.push(a); renderAnnots(p); if (sel) select(p, a); return a; }
function deleteAnnot(p, id) { checkpoint(); p.annots = p.annots.filter(a => a.id !== id); S.sel = null; S.editing = null; renderAnnots(p); renderInspector(); }
function startEdit(p, a) {
  S.editing = a.id; S.sel = { page: p.id, id: a.id };
  const d = annotDom(a.id); if (!d) return;
  $$('.selbox').forEach(n => n.remove());
  d.contentEditable = 'true'; d.focus();
  const r = document.createRange(); r.selectNodeContents(d); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  renderInspector();
}
function commitEdit() {
  if (!S.editing) return;
  const id = S.editing; S.editing = null;
  for (const p of S.pages) {
    const a = p.annots.find(x => x.id === id); if (!a) continue;
    const d = annotDom(id);
    if (d) a.text = d.innerText.replace(/\n$/, '');
    if (!a.text.trim()) { p.annots = p.annots.filter(x => x.id !== id); if (S.sel && S.sel.id === id) S.sel = null; }
    renderAnnots(p); renderInspector(); return;
  }
}

function ptFromEvent(p, e) {
  const E = pageEls.get(p.id), r = E.wrap.getBoundingClientRect();
  const cx = e.clientX - (r.left + r.width / 2), cy = e.clientY - (r.top + r.height / 2);
  const t = -dispRot(p) * Math.PI / 180, z = S.zoom;
  const x = cx * Math.cos(t) - cy * Math.sin(t), y = cx * Math.sin(t) + cy * Math.cos(t);
  return { x: (x + p.w * z / 2) / z, y: (y + p.h * z / 2) / z };
}

let drag = null;
stage.addEventListener('pointerdown', e => {
  if (e.button > 0) return;
  const wrap = e.target.closest('.pagewrap');
  if (!wrap) { if (S.sel) select(null); return; }
  const p = pageById(wrap.dataset.id); if (!p) return;
  S.cur = S.pages.indexOf(p); markCurThumb();
  if (e.target.closest('.adel')) { e.preventDefault(); deleteAnnot(p, S.sel.id); return; }
  if (e.target.closest('.hdl')) { const g = getSel(); if (g) startDrag(e, p, g.a, 'resize'); return; }
  const ad = e.target.closest('.annot');
  if (ad) {
    const a = p.annots.find(x => x.id === ad.dataset.id); if (!a) return;
    if (S.editing === a.id) return;
    if (a.type === 'field' && S.tool !== 'form') { if (S.sel) select(null); return; }
    if (a.type === 'text' && ['text', 'edit', 'date'].includes(S.tool)) { e.preventDefault(); checkpoint(); select(p, a); startEdit(p, a); return; }
    if (S.tool === 'select' || S.tool === 'edit' || S.tool === 'form' || !e.target.closest('.annotlayer')) { e.preventDefault(); select(p, a); startDrag(e, p, a, 'move'); return; }
  }
  if (S.tool === 'edit' && e.target.tagName === 'SPAN' && e.target.parentElement.classList.contains('textlayer')) { e.preventDefault(); editExisting(p, +e.target.dataset.i); return; }
  if (!e.target.closest('.annotlayer')) { if (S.sel && !e.target.closest('.fld')) select(null); return; }
  const pt = ptFromEvent(p, e);
  e.preventDefault();
  switch (S.tool) {
    case 'text': { checkpoint(); const a = addAnnot(p, { type: 'text', x: pt.x, y: pt.y - S.tdef.size * .6, text: '', font: S.tdef.font, size: S.tdef.size, color: S.tdef.color, bold: S.tdef.bold }); startEdit(p, a); break; }
    case 'date': { checkpoint(); const t = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }); addAnnot(p, { type: 'text', x: pt.x, y: pt.y - S.tdef.size * .6, text: t, font: S.tdef.font, size: S.tdef.size, color: S.tdef.color, bold: false }); setTool('select'); break; }
    case 'check': { checkpoint(); const s = S.checkSize; addAnnot(p, { type: 'check', x: pt.x - s / 2, y: pt.y - s / 2, w: s, h: s, mark: S.checkMark, color: S.checkColor }); break; }
    case 'place': {
      if (!S.pending) { setTool('select'); break; }
      checkpoint(); const im = S.imgs[S.pending.img];
      const w = Math.min(S.pending.sig ? 150 : 200, p.w * .5), h = w * im.h / im.w;
      addAnnot(p, { type: 'image', img: S.pending.img, x: pt.x - w / 2, y: pt.y - h / 2, w, h, opacity: 1 });
      S.pending = null; setTool('select'); break; }
    case 'form': {
      const before = snap();
      const a = Object.assign({ type: 'field', x: pt.x, y: pt.y, w: 0, h: 0 }, fieldDefaults(S.fieldType));
      addAnnot(p, a, false);
      drag = { kind: 'rect', p, a, x0: pt.x, y0: pt.y, before, id: e.pointerId }; stage.setPointerCapture(e.pointerId); break; }
    case 'white': case 'hl': case 'redact': {
      const before = snap();
      const a = { type: S.tool === 'redact' ? 'white' : S.tool, x: pt.x, y: pt.y, w: 0, h: 0, color: S.tool === 'hl' ? S.hl : S.tool === 'redact' ? '#000000' : sampleBg(p, pt.x, pt.y), opacity: S.tool === 'hl' ? .45 : 1, ...(S.tool === 'redact' ? { redact: true } : {}) };
      addAnnot(p, a, false);
      drag = { kind: 'rect', p, a, x0: pt.x, y0: pt.y, before, id: e.pointerId }; stage.setPointerCapture(e.pointerId); break; }
    case 'shape': {
      const before = snap();
      const a = { type: 'shape', kind: S.shape, x: pt.x, y: pt.y, w: 0, h: 0, color: S.ink, width: S.inkW };
      addAnnot(p, a, false);
      drag = { kind: 'rect', p, a, x0: pt.x, y0: pt.y, before, id: e.pointerId }; stage.setPointerCapture(e.pointerId); break; }
    case 'stamp': { checkpoint(); const [t, c] = STAMPS[S.stamp] || STAMPS[0]; addAnnot(p, { type: 'text', text: t, x: pt.x - 50, y: pt.y - 14, font: 'Arial', size: 26, bold: true, color: c }); setTool('select'); break; }
    case 'draw': {
      const before = snap();
      const a = { type: 'draw', x: pt.x, y: pt.y, w: 0, h: 0, pts: [[pt.x, pt.y]], color: S.ink, width: S.inkW };
      drag = { kind: 'draw', p, a, before, abs: [[pt.x, pt.y]], id: e.pointerId };
      const E = pageEls.get(p.id); const ns = 'http://www.w3.org/2000/svg';
      const sv = document.createElementNS(ns, 'svg'); sv.setAttribute('style', 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible');
      sv.setAttribute('viewBox', `0 0 ${p.w} ${p.h}`);
      const pl = document.createElementNS(ns, 'polyline'); pl.setAttribute('fill', 'none'); pl.setAttribute('stroke', a.color); pl.setAttribute('stroke-width', a.width); pl.setAttribute('stroke-linecap', 'round'); pl.setAttribute('stroke-linejoin', 'round');
      sv.append(pl); E.al.append(sv); drag.sv = sv; drag.pl = pl;
      stage.setPointerCapture(e.pointerId); break; }
  }
});
function startDrag(e, p, a, mode) {
  const pt = ptFromEvent(p, e);
  drag = { kind: mode, p, a, start: pt, orig: JSON.parse(JSON.stringify(a)), before: snap(), moved: false, id: e.pointerId };
  if (mode === 'resize' && a.type === 'text') { const d = annotDom(a.id); drag.ow = d.offsetWidth / S.zoom; }
  stage.setPointerCapture(e.pointerId);
}
stage.addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.id) return;
  const { p, a } = drag, pt = ptFromEvent(p, e);
  if (drag.kind === 'move') {
    const dx = pt.x - drag.start.x, dy = pt.y - drag.start.y;
    if (!drag.moved && Math.hypot(dx, dy) * S.zoom < 3) return;
    drag.moved = true; a.x = drag.orig.x + dx; a.y = drag.orig.y + dy;
    const d = annotDom(a.id); d.style.left = a.x * S.zoom + 'px'; d.style.top = a.y * S.zoom + 'px'; drawSelBox();
  } else if (drag.kind === 'resize') {
    drag.moved = true; const o = drag.orig;
    if (a.type === 'text') { const nw = Math.max(4, drag.ow + (pt.x - drag.start.x)); a.size = clamp(r1(o.size * nw / drag.ow), 4, 144); }
    else {
      let w = Math.max(4, o.w + pt.x - drag.start.x), h = Math.max(4, o.h + pt.y - drag.start.y);
      if (a.type === 'image' || a.type === 'check' || (a.type === 'field' && (a.ftype === 'check' || a.ftype === 'radio'))) { const k = Math.max(w / o.w, h / o.h); w = o.w * k; h = o.h * k; }
      a.w = w; a.h = h;
      if (a.type === 'draw') { const sx = w / Math.max(o.w, .1), sy = h / Math.max(o.h, .1); a.pts = o.pts.map(([x, y]) => [x * sx, y * sy]); }
    }
    renderAnnots(p);
  } else if (drag.kind === 'rect') {
    a.x = Math.min(pt.x, drag.x0); a.y = Math.min(pt.y, drag.y0); a.w = Math.abs(pt.x - drag.x0); a.h = Math.abs(pt.y - drag.y0); a.flipX = pt.x < drag.x0; a.flipY = pt.y < drag.y0;
    const d = annotDom(a.id); Object.assign(d.style, { left: a.x * S.zoom + 'px', top: a.y * S.zoom + 'px', width: a.w * S.zoom + 'px', height: a.h * S.zoom + 'px' });
    if (a.type === 'shape') d.innerHTML = shapeSvg(a);
  } else if (drag.kind === 'draw') {
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of evs) { const q = ptFromEvent(p, ev); drag.abs.push([q.x, q.y]); }
    drag.pl.setAttribute('points', drag.abs.map(q => q.join(',')).join(' '));
  }
});
function endDrag(e) {
  if (!drag || e.pointerId !== drag.id) return;
  const d = drag; drag = null;
  try { stage.releasePointerCapture(e.pointerId); } catch (_) {}
  if (d.kind === 'move' || d.kind === 'resize') {
    if (d.moved) { S.undo.push(d.before); S.redo = []; syncUndo(); renderInspector(); }
  } else if (d.kind === 'rect' && d.a.type === 'field') {
    const a = d.a, sq = a.ftype === 'check' || a.ftype === 'radio';
    if (a.w < 6 || a.h < 6) { const [w, h] = FIELD_SIZE[a.ftype]; a.w = w; a.h = h; a.x = sq ? d.x0 - w / 2 : d.x0; a.y = d.y0 - h / 2; }
    else if (sq) a.w = a.h = Math.max(a.w, a.h);
    S.undo.push(d.before); S.redo = []; syncUndo(); renderAnnots(d.p); select(d.p, a);
  } else if (d.kind === 'rect') {
    if (d.a.type === 'shape' && (d.a.kind === 'line' || d.a.kind === 'arrow') ? Math.hypot(d.a.w, d.a.h) < 4 : (d.a.w < 3 || d.a.h < 3)) { d.p.annots = d.p.annots.filter(x => x !== d.a); renderAnnots(d.p); }
    else { S.undo.push(d.before); S.redo = []; syncUndo(); select(d.p, d.a); }
  } else if (d.kind === 'draw') {
    d.sv.remove();
    const pts = simplify(d.abs, .6);
    if (pts.length < 2) { const [x, y] = pts[0]; pts.push([x + .5, y + .5]); }
    const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]);
    const x0 = Math.min(...xs), y0 = Math.min(...ys);
    Object.assign(d.a, { x: x0, y: y0, w: Math.max(...xs) - x0 || 1, h: Math.max(...ys) - y0 || 1, pts: pts.map(([x, y]) => [x - x0, y - y0]) });
    S.undo.push(d.before); S.redo = []; syncUndo();
    addAnnot(d.p, d.a, false);
  }
}
stage.addEventListener('pointerup', endDrag);
stage.addEventListener('pointercancel', endDrag);
stage.addEventListener('dblclick', e => {
  const ad = e.target.closest('.annot.t-text'); if (!ad) return;
  const p = pageById(ad.closest('.pagewrap').dataset.id), a = p.annots.find(x => x.id === ad.dataset.id);
  if (a && S.editing !== a.id) { checkpoint(); startEdit(p, a); }
});
stage.addEventListener('focusout', e => { if (e.target.classList && e.target.classList.contains('t-text') && S.editing === e.target.dataset.id) commitEdit(); });
stage.addEventListener('paste', e => {
  if (!e.target.closest || !e.target.closest('.annot.t-text')) return;
  e.preventDefault(); document.execCommand('insertText', false, (e.clipboardData || window.clipboardData).getData('text/plain'));
});
stage.addEventListener('input', e => { if (e.target.classList && e.target.classList.contains('t-text')) { const ta = $('#iText'); if (ta) ta.value = e.target.innerText; } });

function simplify(pts, tol) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) { const l = out[out.length - 1]; if (Math.hypot(pts[i][0] - l[0], pts[i][1] - l[1]) >= tol) out.push(pts[i]); }
  if (out.length > 1 && out[out.length - 1] !== pts[pts.length - 1]) out.push(pts[pts.length - 1]);
  return out.map(([x, y]) => [r1(x), r1(y)]);
}
function sampleBg(p, x, y) {
  try {
    const E = pageEls.get(p.id), c = E.canvas, k = c.width / p.w;
    const px = c.getContext('2d').getImageData(clamp(Math.round((x - 2) * k), 0, c.width - 1), clamp(Math.round(y * k), 0, c.height - 1), 1, 1).data;
    return '#' + [px[0], px[1], px[2]].map(v => v.toString(16).padStart(2, '0')).join('');
  } catch (e) { return '#ffffff'; }
}
function sampleInk(p, it, bg) {
  try {
    const c = pageEls.get(p.id).canvas, k = c.width / p.w;
    const x = Math.max(0, Math.floor(it.x * k)), y = Math.max(0, Math.floor((it.base - it.size * .75) * k));
    const w = Math.max(1, Math.min(c.width - x, Math.ceil(it.w * k))), h = Math.max(1, Math.min(c.height - y, Math.ceil(it.size * .8 * k)));
    const d = c.getContext('2d').getImageData(x, y, w, h).data, n = parseInt(bg.slice(1), 16), br = n >> 16 & 255, bgc = n >> 8 & 255, bb = n & 255;
    let best = 0, col = null;
    for (let i = 0; i < d.length; i += 4) { const dist = Math.abs(d[i] - br) + Math.abs(d[i + 1] - bgc) + Math.abs(d[i + 2] - bb); if (dist > best) { best = dist; col = [d[i], d[i + 1], d[i + 2]]; } }
    return best > 90 ? '#' + col.map(v => v.toString(16).padStart(2, '0')).join('') : '#111111';
  } catch (e) { return '#111111'; }
}
function editExisting(p, i) {
  const E = pageEls.get(p.id), it = E.items && E.items[i]; if (!it) return;
  checkpoint();
  const pad = it.size * .12;
  const top = it.base - it.size * .82;
  p.annots.push({ id: nid(), type: 'white', x: it.x - pad, y: top - pad, w: it.w + pad * 2, h: it.size * 1.05 + pad * 2, color: sampleBg(p, it.x, it.base - it.size * .4), opacity: 1 });
  const font = /mono|courier/i.test(it.family) ? 'Courier' : (/serif|times/i.test(it.family) && !/sans/i.test(it.family)) ? 'Times' : 'Helvetica';
  const a = { id: nid(), type: 'text', x: it.x, y: it.base - it.size * .94, text: it.str, font, size: r1(it.size), color: sampleInk(p, it, p.annots[p.annots.length - 1].color), bold: false };
  p.annots.push(a); renderAnnots(p); startEdit(p, a);
}

/* ---------- keyboard ---------- */
document.addEventListener('keydown', e => {
  const inField = e.target.closest && e.target.closest('input,textarea,select,[contenteditable="true"]');
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 'z' && !inField) { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if (mod && e.key.toLowerCase() === 'y' && !inField) { e.preventDefault(); redo(); return; }
  if (e.key === 'Escape' && !fieldMenu.hidden) { fieldMenu.hidden = true; return; }
  if (e.key === 'Escape') { if (!$('#sigModal').hidden || !$('#expModal').hidden) { closeModals(); return; } if (S.editing) { commitEdit(); return; } select(null); setTool('select'); return; }
  if (inField) return;
  if (!mod && !e.altKey && KEYTOOLS[e.key.toLowerCase()] && $('#sigModal').hidden && $('#expModal').hidden) { setTool(KEYTOOLS[e.key.toLowerCase()]); return; }
  const g = getSel(); if (!g) return;
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteAnnot(g.p, g.a.id); }
  else if (e.key.startsWith('Arrow')) {
    e.preventDefault(); const st = e.shiftKey ? 10 : 1; checkpoint();
    if (e.key === 'ArrowLeft') g.a.x -= st; if (e.key === 'ArrowRight') g.a.x += st; if (e.key === 'ArrowUp') g.a.y -= st; if (e.key === 'ArrowDown') g.a.y += st;
    renderAnnots(g.p);
  }
});

/* ---------- tools ---------- */
const KEYTOOLS = { v: 'select', e: 'edit', t: 'text', w: 'white', h: 'hl', d: 'draw', c: 'check', k: 'date', r: 'redact', s: 'shape', m: 'stamp' };
const TOOLKEY = Object.fromEntries(Object.entries(KEYTOOLS).map(([k, t]) => [t, k.toUpperCase()]));
const TOOLS = [
  ['select', 'Select', 'Select, move and fill form fields'],
  ['edit', 'Edit text', 'Click any existing text to replace it'],
  ['text', 'Add text', 'Click on the page to type'],
  ['form', 'Form field', 'Add fillable text boxes, checkboxes and more'],
  ['sign', 'Sign', 'Draw, type or upload a signature'],
  ['image', 'Image', 'Place a PNG or JPG on the page'],
  ['white', 'Whiteout', 'Drag to cover content'],
  ['redact', 'Redact', 'Drag to permanently remove content'],
  ['hl', 'Highlight', 'Drag to highlight'],
  ['draw', 'Draw', 'Freehand pen'],
  ['shape', 'Shape', 'Rectangle, ellipse, line or arrow'],
  ['stamp', 'Stamp', 'Approved, Draft, Paid and other stamps'],
  ['check', 'Check', 'Click to place a check mark'],
  ['date', 'Date', 'Click to stamp today\'s date']
];
$('#tools').innerHTML = TOOLS.map(([k, l, t]) => `<button class="tool" data-tool="${k}" title="${t}${TOOLKEY[k] ? ' (' + TOOLKEY[k] + ')' : ''}" aria-pressed="false">${svg(k === 'edit' ? 'edit' : k)}<span>${l}</span></button>`).join('');
$('#tools').addEventListener('click', e => {
  const b = e.target.closest('.tool'); if (!b) return;
  const t = b.dataset.tool;
  if (t === 'form') { toggleFieldMenu(b); return; }
  if (t === 'sign') { openSig(); return; }
  if (t === 'image') { $('#fStamp').click(); return; }
  setTool(t);
});
function setTool(t) {
  if (S.editing) commitEdit();
  S.tool = t; stage.dataset.tool = t;
  $$('.tool').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tool === t || (t === 'place' && b.dataset.tool === (S.pending && S.pending.sig ? 'sign' : 'image')))));
  if (t !== 'select' && t !== 'edit' && S.sel) { S.sel = null; drawSelBox(); }
  if (t === 'edit') toast('Click any text on the page to change it');
  if (t === 'place') toast('Click on the page to place it');
  if (t === 'form') toast((S.fieldType === 'check' || S.fieldType === 'radio') ? 'Click on the page to place it' : 'Drag on the page to draw the field, or click to drop one');
  renderInspector();
}
$('#fStamp').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try { S.pending = { img: await fileToImg(f) }; setTool('place'); } catch (err) { toast(err.message, 'err'); }
};

/* ---------- form fields ---------- */
const FT = [['text', 'Text field', 'ftext'], ['multi', 'Multi-line text', 'fmulti'], ['check', 'Checkbox', 'fcheck'], ['radio', 'Radio button', 'fradio'], ['choice', 'Dropdown', 'fchoice']];
const FIELD_SIZE = { text: [160, 20], multi: [240, 60], check: [14, 14], radio: [14, 14], choice: [160, 20] };
const FBASE = { text: 'text', multi: 'notes', check: 'checkbox', choice: 'dropdown' };
const fieldMenu = $('#fieldMenu');
fieldMenu.innerHTML = FT.map(([k, l, i]) => `<button role="menuitem" data-ft="${k}">${svg(i)}<span>${l}</span></button>`).join('');
function toggleFieldMenu(btn) {
  if (!fieldMenu.hidden) { fieldMenu.hidden = true; return; }
  const r = btn.getBoundingClientRect(); fieldMenu.hidden = false;
  fieldMenu.style.left = clamp(r.left, 8, window.innerWidth - fieldMenu.offsetWidth - 8) + 'px';
  fieldMenu.style.top = (r.bottom + 4) + 'px';
  fieldMenu.querySelector('button').focus();
}
fieldMenu.onclick = e => { const b = e.target.closest('[data-ft]'); if (!b) return; fieldMenu.hidden = true; S.fieldType = b.dataset.ft; setTool('form'); };
document.addEventListener('pointerdown', e => { if (!fieldMenu.hidden && !e.target.closest('#fieldMenu,.tool[data-tool="form"]')) fieldMenu.hidden = true; }, true);
function allFieldNames() { const s = new Set(); for (const p of S.pages) { for (const f of p.fields) s.add(f.name); for (const a of p.annots) if (a.type === 'field') s.add(a.name); } return s; }
function uniqueName(base) { const s = allFieldNames(); let i = 1; while (s.has(`${base}_${i}`)) i++; return `${base}_${i}`; }
function radioCount(name) { let n = 0; for (const p of S.pages) for (const a of p.annots) if (a.type === 'field' && a.ftype === 'radio' && a.name === name) n++; return n; }
const fieldCount = () => S.pages.reduce((n, q) => n + q.fields.length + q.annots.filter(a => a.type === 'field').length, 0);
function fieldDefaults(ft) {
  const o = { ftype: ft, value: (ft === 'check' || ft === 'radio') ? false : '', fs: 0, max: 0, required: false, border: true };
  if (ft === 'radio') { if (!S.radioGroup) S.radioGroup = uniqueName('choice'); o.name = S.radioGroup; o.opt = 'Option ' + (radioCount(o.name) + 1); }
  else o.name = uniqueName(FBASE[ft]);
  if (ft === 'choice') o.options = ['Option 1', 'Option 2', 'Option 3'];
  return o;
}
function fieldEl(d, a) {
  const z = S.zoom; let n;
  if (a.ftype === 'text' || a.ftype === 'multi') {
    n = el(a.ftype === 'multi' ? 'textarea' : 'input', 'fld'); if (n.tagName === 'INPUT') n.type = 'text';
    n.value = a.value || ''; if (a.max) n.maxLength = a.max;
    n.style.fontSize = (a.fs || (a.ftype === 'multi' ? 10 : clamp(a.h * .62, 6, 14))) * z + 'px';
    n.oninput = () => { a.value = n.value; };
  } else if (a.ftype === 'check') {
    n = el('input', 'fld'); n.type = 'checkbox'; n.checked = !!a.value; n.onchange = () => { a.value = n.checked; };
  } else if (a.ftype === 'radio') {
    n = el('input', 'fld'); n.type = 'radio'; n.name = 'nr_' + a.name; n.checked = !!a.value;
    n.onchange = () => { if (!n.checked) return; for (const q of S.pages) for (const o of q.annots) if (o.type === 'field' && o.ftype === 'radio' && o.name === a.name) o.value = o === a; };
  } else {
    n = el('select', 'fld'); n.append(new Option('', ''));
    for (const o of a.options || []) n.append(new Option(o, o));
    n.value = a.value || ''; n.style.fontSize = (a.fs || clamp(a.h * .6, 6, 13)) * z + 'px';
    n.onchange = () => { a.value = n.value; };
  }
  n.setAttribute('aria-label', a.name); n.title = a.name + (a.required ? ' (required)' : '');
  if (a.border === false) d.classList.add('noborder');
  if (a.ftype === 'check' || a.ftype === 'radio') d.classList.add('fsq');
  const tag = el('span', 'fname'); tag.textContent = a.ftype === 'radio' ? `${a.name} · ${a.opt}` : a.name;
  d.append(n, tag);
}

/* ---------- signature dialog ---------- */
const pad = $('#padCanvas'); let padCtx, padInk = '#111111', padDirty = false, sigTab = 'draw', typedFont = 0;
const SIG_FONTS = ['"Caveat", cursive', '"Allura", cursive'];
function openSig() {
  $('#sigModal').hidden = false; renderSavedSigs();
  const r = pad.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  pad.width = r.width * dpr; pad.height = r.height * dpr; padCtx = pad.getContext('2d'); padCtx.scale(dpr, dpr);
  padCtx.lineCap = 'round'; padCtx.lineJoin = 'round'; padDirty = false;
  $('#padInk').innerHTML = ['#111111', '#1d3fa6'].map(c => `<button class="sw" style="background:${c}" data-c="${c}" aria-pressed="${c === padInk}" title="${c === '#111111' ? 'Black' : 'Blue'} ink"></button>`).join('');
  renderTyped();
}
$('#padInk').onclick = e => { const b = e.target.closest('.sw'); if (!b) return; padInk = b.dataset.c; $$('#padInk .sw').forEach(x => x.setAttribute('aria-pressed', String(x === b))); renderTyped(); };
let padLast = null;
pad.addEventListener('pointerdown', e => { pad.setPointerCapture(e.pointerId); const r = pad.getBoundingClientRect(); padLast = { x: e.clientX - r.left, y: e.clientY - r.top, t: e.timeStamp }; padCtx.fillStyle = padInk; padCtx.beginPath(); padCtx.arc(padLast.x, padLast.y, 1.2, 0, 7); padCtx.fill(); padDirty = true; });
pad.addEventListener('pointermove', e => {
  if (!padLast) return; const r = pad.getBoundingClientRect();
  for (const ev of (e.getCoalescedEvents ? e.getCoalescedEvents() : [e])) {
    const x = ev.clientX - r.left, y = ev.clientY - r.top, dist = Math.hypot(x - padLast.x, y - padLast.y), dt = Math.max(1, ev.timeStamp - padLast.t);
    const w = clamp(3.2 - (dist / dt) * 1.4, 1.2, 3.2);
    padCtx.strokeStyle = padInk; padCtx.lineWidth = w; padCtx.beginPath(); padCtx.moveTo(padLast.x, padLast.y); padCtx.lineTo(x, y); padCtx.stroke();
    padLast = { x, y, t: ev.timeStamp };
  }
});
pad.addEventListener('pointerup', () => padLast = null);
$('#padClear').onclick = () => { padCtx.clearRect(0, 0, pad.width, pad.height); padDirty = false; };
function renderTyped() {
  $('#typedStyles').innerHTML = SIG_FONTS.map((f, i) => `<button data-i="${i}" aria-pressed="${i === typedFont}" style="font-family:${f};color:${padInk}"></button>`).join('');
  $$('#typedStyles button').forEach(b => b.textContent = $('#typedName').value || 'Your name');
}
$('#typedName').oninput = renderTyped;
$('#typedStyles').onclick = e => { const b = e.target.closest('button'); if (!b) return; typedFont = +b.dataset.i; renderTyped(); };
$$('#sigModal [role=tab]').forEach(b => b.onclick = () => {
  sigTab = b.dataset.tab; $$('#sigModal [role=tab]').forEach(x => x.setAttribute('aria-selected', String(x === b)));
  $$('#sigModal [data-pane]').forEach(p => p.hidden = p.dataset.pane !== sigTab);
  $('#sigUse').hidden = sigTab === 'upload';
});
$('#sigUpload').onclick = () => $('#fSig').click();
$('#fSig').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try { const id = await fileToImg(f, !/png/i.test(f.type)); await finishSig(id); } catch (err) { toast(err.message, 'err'); }
};
function trimCanvas(c) {
  const x = c.getContext('2d'), { width: w, height: h } = c, d = x.getImageData(0, 0, w, h).data;
  let t = h, l = w, r = 0, b = 0;
  for (let y = 0; y < h; y++) for (let i = 0; i < w; i++) if (d[(y * w + i) * 4 + 3] > 8) { if (y < t) t = y; if (y > b) b = y; if (i < l) l = i; if (i > r) r = i; }
  if (r < l) return null;
  const m = 6, o = document.createElement('canvas'); o.width = r - l + 1 + m * 2; o.height = b - t + 1 + m * 2;
  o.getContext('2d').drawImage(c, l - m, t - m, o.width, o.height, 0, 0, o.width, o.height); return o;
}
$('#sigUse').onclick = async () => {
  let src;
  if (sigTab === 'draw') { if (!padDirty) { toast('Draw your signature in the box first', 'err'); return; } src = pad; }
  else {
    const name = $('#typedName').value.trim(); if (!name) { toast('Type your name first', 'err'); return; }
    await document.fonts.load(`80px ${SIG_FONTS[typedFont]}`).catch(() => {});
    src = document.createElement('canvas'); src.width = 1400; src.height = 260; const x = src.getContext('2d');
    x.font = `130px ${SIG_FONTS[typedFont]}`; x.fillStyle = padInk; x.textBaseline = 'middle'; x.fillText(name, 30, 135);
  }
  const t = trimCanvas(src); if (!t) { toast('Nothing to use yet', 'err'); return; }
  const blob = await canvasBlob(t);
  await finishSig(addImg(new Uint8Array(await blob.arrayBuffer()), 'png', t.width, t.height));
};
async function finishSig(id) {
  if ($('#sigRemember').checked) {
    S.sigs.unshift(id); S.sigs = S.sigs.slice(0, 6);
    await persistSigs();
  }
  closeModals(); S.pending = { img: id, sig: true }; setTool('place');
}
const blobToDataUrl = b => new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); });
async function persistSigs() {
  try {
    const all = []; for (const id of S.sigs) { const im = S.imgs[id]; all.push(await blobToDataUrl(new Blob([im.bytes], { type: 'image/png' }))); }
    localStorage.setItem('pagewright.sigs', JSON.stringify(all));
  } catch (e) {}
}
function renderSavedSigs() {
  const w = $('#savedSigs'); $('#savedSigsWrap').hidden = !S.sigs.length; w.innerHTML = '';
  S.sigs.forEach(id => {
    const im = S.imgs[id], b = el('div', 'ssig');
    b.innerHTML = `<button class="use" title="Use this signature"><img alt="Saved signature" src="${im.url}"></button><button class="del" title="Delete this saved signature" aria-label="Delete saved signature">\u2715</button>`;
    b.querySelector('.use').onclick = () => { closeModals(); S.pending = { img: id, sig: true }; setTool('place'); };
    b.querySelector('.del').onclick = async () => { S.sigs = S.sigs.filter(x => x !== id); await persistSigs(); renderSavedSigs(); };
    w.append(b);
  });
}
async function loadSavedSigs() {
  try {
    const arr = JSON.parse(localStorage.getItem('pagewright.sigs') || localStorage.getItem('inkwell.sigs') || '[]');
    for (const du of arr) { const bytes = dataUrlBytes(du); const im = await loadImg(du); S.sigs.push(addImg(bytes, 'png', im.naturalWidth, im.naturalHeight)); }
  } catch (e) {}
}
var lastBtn = null;
function closeModals() { $('#sigModal').hidden = true; $('#expModal').hidden = true; if (lastBtn && lastBtn.isConnected) lastBtn.focus(); }
$$('[data-close]').forEach(b => { b.innerHTML = b.innerHTML || svg('close'); b.onclick = closeModals; });
$$('.modal').forEach(m => m.addEventListener('pointerdown', e => { if (e.target === m) closeModals(); }));

/* ---------- inspector ---------- */
const PAPER = [['A4', 595.28, 841.89], ['Letter', 612, 792], ['Legal', 612, 1008], ['Long bond 8.5×13 in', 612, 936], ['A5', 419.53, 595.28], ['A3', 841.89, 1190.55]];
function paperName(w, h) { const a = Math.min(w, h), b = Math.max(w, h); const m = PAPER.find(([, x, y]) => Math.abs(x - a) < 3 && Math.abs(y - b) < 3); return m ? m[0] : 'Custom'; }
function swatchRow(list, cur, act) { return `<div class="swatches">${list.map(c => `<button class="sw" style="background:${c}" data-act="${act}" data-v="${c}" aria-pressed="${c.toLowerCase() === (cur || '').toLowerCase()}" title="${c}"></button>`).join('')}<input type="color" class="sw-in" data-act="${act}" value="${cur}" title="Custom colour"></div>`; }
function textControls(o, pre) {
  return `<div class="two"><div class="field"><label for="${pre}Font">Font</label><select class="inp" id="${pre}Font" data-act="font">${Object.keys(FONT_CSS).map(f => `<option ${f === o.font ? 'selected' : ''}>${f}</option>`).join('')}</select></div>
  <div class="field"><label for="${pre}Size">Size (pt)</label><input class="inp" id="${pre}Size" type="number" min="4" max="144" step="0.5" value="${o.size}" data-act="size"></div></div>
  <label class="tog"><input type="checkbox" data-act="bold" ${o.bold ? 'checked' : ''}> Bold</label>
  <div class="field"><span class="lbl">Colour</span>${swatchRow(INKS, o.color, 'color')}</div>`;
}
function renderInspector() {
  const box = $('#insp'), g = getSel(); let h = '', title = 'Document';
  if (g) {
    const { a } = g;
    const names = { text: 'Text', white: 'Whiteout', hl: 'Highlight', image: S.sigs.includes(a.img) ? 'Signature' : 'Image', draw: 'Drawing', check: 'Mark', field: 'Form field' };
    title = names[a.type] || 'Item';
    h += `<div class="card">`;
    if (a.type === 'text') h += `<div class="field"><label for="iText">Text</label><textarea class="inp" id="iText" data-act="text">${esc(a.text)}</textarea></div>${textControls(a, 'i')}
      <label class="tog"><input type="checkbox" data-act="bg" ${a.bg ? 'checked' : ''}> White background</label>`;
    if (a.type === 'white') h += `<div class="field"><span class="lbl">Fill</span>${swatchRow(['#ffffff', '#f5f5f0', '#111111'], a.color, 'color')}</div><p class="note">Whiteout hides content visually. The original text is still inside the file, so don't use it to redact sensitive data.</p>`;
    if (a.type === 'hl') h += `<div class="field"><span class="lbl">Colour</span>${swatchRow(HLS, a.color, 'color')}</div>`;
    if (a.type === 'draw') h += `<div class="field"><span class="lbl">Colour</span>${swatchRow(INKS, a.color, 'color')}</div><div class="field"><label for="iW">Line width (pt)</label><input class="inp" id="iW" type="number" min=".5" max="20" step=".5" value="${a.width}" data-act="width"></div>`;
    if (a.type === 'shape') h += `<div class="field"><span class="lbl">Colour</span>${swatchRow(INKS, a.color, 'color')}</div>`;
    if (a.type === 'image') h += `<div class="field"><label for="iOp">Opacity</label><input id="iOp" type="range" min="0.1" max="1" step="0.05" value="${a.opacity ?? 1}" data-act="opacity"></div>`;
    if (a.type === 'check') h += `<div class="field"><label for="iMark">Mark</label><select class="inp" id="iMark" data-act="mark"><option value="check" ${a.mark === 'check' ? 'selected' : ''}>✓ Check</option><option value="cross" ${a.mark === 'cross' ? 'selected' : ''}>✕ Cross</option><option value="dot" ${a.mark === 'dot' ? 'selected' : ''}>● Dot</option></select></div><div class="field"><span class="lbl">Colour</span>${swatchRow(INKS, a.color, 'color')}</div>`;
    if (a.type === 'field') {
      const ft = a.ftype;
      h += `<div class="field"><label for="iFt">Field type</label><select class="inp" id="iFt" data-act="ftype">${FT.map(([k, l]) => `<option value="${k}" ${k === ft ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="field"><label for="iFn">${ft === 'radio' ? 'Group name' : 'Field name'}</label><input class="inp" id="iFn" data-act="fname" value="${esc(a.name)}" spellcheck="false" autocomplete="off"></div>`;
      if (ft === 'radio') h += `<div class="field"><label for="iFo">Option value</label><input class="inp" id="iFo" data-act="fopt" value="${esc(a.opt)}" autocomplete="off"></div><p class="note">Radio buttons with the same group name work together: picking one clears the others.</p>`;
      if (ft === 'text' || ft === 'multi') h += `<div class="field"><label for="iFv">Default text</label><input class="inp" id="iFv" data-act="fval" value="${esc(a.value || '')}" autocomplete="off"></div>
        <div class="two"><div class="field"><label for="iFs">Font size</label><select class="inp" id="iFs" data-act="ffs">${[0, 8, 9, 10, 11, 12, 14, 16, 18].map(v => `<option value="${v}" ${v === (a.fs || 0) ? 'selected' : ''}>${v ? v + ' pt' : 'Auto'}</option>`).join('')}</select></div>
        <div class="field"><label for="iFm">Max characters</label><input class="inp" id="iFm" type="number" min="0" max="999" placeholder="No limit" value="${a.max || ''}" data-act="fmax"></div></div>`;
      if (ft === 'choice') h += `<div class="field"><label for="iFl">Choices, one per line</label><textarea class="inp" id="iFl" data-act="fopts" rows="4">${esc((a.options || []).join('\n'))}</textarea></div>`;
      if (ft === 'check') h += `<label class="tog"><input type="checkbox" data-act="fval" ${a.value ? 'checked' : ''}> Checked by default</label>`;
      h += `<label class="tog"><input type="checkbox" data-act="freq" ${a.required ? 'checked' : ''}> Required</label><label class="tog"><input type="checkbox" data-act="fborder" ${a.border !== false ? 'checked' : ''}> Show border</label>`;
    }
    const sz = a.type === 'text' ? `${a.size} pt` : `${Math.round(a.w)} × ${Math.round(a.h)} pt`;
    h += `<dl class="kv"><dt>Position</dt><dd>${Math.round(a.x)}, ${Math.round(a.y)} pt</dd><dt>Size</dt><dd>${sz}</dd></dl>
      <div class="btnrow"><button class="btn sm" data-act="dup">${svg('copy')}Duplicate</button><button class="btn sm danger" data-act="del">${svg('trash')}Delete</button></div>
      <p class="note">${a.type === 'field' ? 'Drag to move, drag the corner to resize. Switch to Select to fill it in.' : 'Drag to move, drag the corner to resize, arrow keys to nudge.'}</p></div>`;
  } else if (S.tool === 'text' || S.tool === 'date') {
    title = S.tool === 'text' ? 'Add text' : 'Date stamp';
    h += `<div class="card"><p class="note">${S.tool === 'text' ? 'Click anywhere on a page and start typing. Press Esc when done.' : 'Click on a page to stamp today\'s date.'}</p>${textControls(S.tdef, 'd')}</div>`;
  } else if (S.tool === 'draw') {
    title = 'Draw'; h += `<div class="card"><div class="field"><span class="lbl">Ink</span>${swatchRow(INKS, S.ink, 'ink')}</div><div class="field"><label for="dW">Line width (pt)</label><input class="inp" id="dW" type="number" min=".5" max="20" step=".5" value="${S.inkW}" data-act="inkW"></div></div>`;
  } else if (S.tool === 'hl') {
    title = 'Highlight'; h += `<div class="card"><p class="note">Drag across text to highlight it.</p><div class="field"><span class="lbl">Colour</span>${swatchRow(HLS, S.hl, 'hlc')}</div></div>`;
  } else if (S.tool === 'shape') {
    title = 'Shape'; h += `<div class="card"><div class="field"><label for="shK">Shape</label><select class="inp" id="shK" data-act="shapeKind">${[['rect', 'Rectangle'], ['ellipse', 'Ellipse'], ['line', 'Line'], ['arrow', 'Arrow']].map(([v, l]) => `<option value="${v}"${S.shape === v ? ' selected' : ''}>${l}</option>`).join('')}</select></div><div class="field"><span class="lbl">Colour</span>${swatchRow(INKS, S.ink, 'ink')}</div><div class="field"><label for="dW">Line width (pt)</label><input class="inp" id="dW" type="number" min=".5" max="20" step=".5" value="${S.inkW}" data-act="inkW"></div></div>`;
  } else if (S.tool === 'stamp') {
    title = 'Stamp'; h += `<div class="card"><p class="note">Pick a stamp, then click on the page. It is placed as bold text you can move, resize and recolour.</p><div class="field"><label for="stS">Stamp</label><select class="inp" id="stS" data-act="stampPick">${STAMPS.map(([t], i) => `<option value="${i}"${S.stamp === i ? ' selected' : ''}>${t}</option>`).join('')}</select></div></div>`;
  } else if (S.tool === 'redact') {
    title = 'Redact'; h += `<div class="card"><p class="note">Drag a box over anything that must be gone for good. When you export a PDF, each page with a redaction is converted to a flat image with the box burned in, so the text underneath is removed from the file. Those pages lose selectable text and form fields.</p></div>`;
  } else if (S.tool === 'white') {
    title = 'Whiteout'; h += `<div class="card"><p class="note">Drag a box over anything you want to cover. The fill matches the page colour where you start. Add new text on top with Add text. This only covers the content visually: the text underneath stays in the file. Use Redact to remove it.</p></div>`;
  } else if (S.tool === 'check') {
    title = 'Check mark'; h += `<div class="card"><div class="field"><label for="cMark">Mark</label><select class="inp" id="cMark" data-act="cmark"><option value="check">✓ Check</option><option value="cross">✕ Cross</option><option value="dot">● Dot</option></select></div><div class="field"><label for="cSize">Size (pt)</label><input class="inp" id="cSize" type="number" min="6" max="60" value="${S.checkSize}" data-act="csize"></div></div>`;
  } else if (S.tool === 'edit') {
    title = 'Edit text';
    h += `<div class="card"><p class="note">Text you can edit is highlighted when you point at it. Click a line to replace it: the original is covered and a matching text box opens.</p><p class="note">Scanned pages have no text to edit. Run text recognition on them first.</p></div>`;
  } else if (S.tool === 'form') {
    title = 'Form fields';
    h += `<div class="card"><div class="ftypes">${FT.map(([k, l, i]) => `<button data-act="ftool" data-v="${k}" aria-pressed="${k === S.fieldType}">${svg(i)}${l}</button>`).join('')}</div>
      <p class="note">${(S.fieldType === 'check' || S.fieldType === 'radio') ? 'Click on the page to place it.' : 'Drag on the page to draw the field, or click to drop one at a standard size.'} Click a field you added to rename it or change its options.</p>
      ${S.fieldType === 'radio' ? `<p class="note">New radio buttons join the group <b>${esc(S.radioGroup || 'choice')}</b>.</p><div class="btnrow"><button class="btn sm" data-act="newgroup">Start a new group</button></div>` : ''}
      <p class="note">To fill in fields, switch to Select. Exported PDFs keep these fields fillable in Acrobat, Preview and browsers.</p></div>`;
  } else if (S.tool === 'place') {
    title = 'Place'; h += `<div class="card"><p class="note">Click where it should go. You can move and resize it afterwards.</p><button class="btn sm" data-act="cancelPlace">Cancel</button></div>`;
  } else {
    const p = S.pages[S.cur], nf = fieldCount();
    if (p) {
      title = 'Document';
      h += `<div class="card"><dl class="kv"><dt>Pages</dt><dd>${S.pages.length}</dd><dt>Form fields</dt><dd>${nf}</dd></dl>
        ${nf ? `<label class="tog"><input type="checkbox" data-act="flatten" ${S.flatten ? 'checked' : ''}> Lock form fields on export</label><p class="note">Leave unticked to keep the form fillable in Acrobat, Preview and browsers.</p>` : ''}</div>
        <div class="card"><h3>Page ${S.cur + 1}</h3><dl class="kv"><dt>Paper</dt><dd>${paperName(p.w, p.h)}</dd><dt>Size</dt><dd>${Math.round(p.w)} × ${Math.round(p.h)} pt</dd><dt>Rotation</dt><dd>${dispRot(p)}°</dd></dl>
        <div class="btnrow"><button class="btn sm" data-act="rotl" title="Rotate left">${svg('rotl')}</button><button class="btn sm" data-act="rotr" title="Rotate right">${svg('rot')}</button><button class="btn sm" data-act="up" title="Move up" ${S.cur === 0 ? 'disabled' : ''}>${svg('up')}</button><button class="btn sm" data-act="down" title="Move down" ${S.cur >= S.pages.length - 1 ? 'disabled' : ''}>${svg('down')}</button><button class="btn sm" data-act="dupPage" title="Duplicate">${svg('copy')}</button><button class="btn sm danger" data-act="delPage" title="Delete page">${svg('trash')}</button></div>
        <button class="btn sm" data-act="ocr" title="Recognise text on scanned pages">${svg('ocr')}Make scanned text selectable</button></div>`;
    }
    h += `<div class="card"><h3>Quick start</h3><ol class="steps"><li><b>Fill forms</b> by clicking the blue fields.</li><li><b>Form fields</b>: add text boxes, checkboxes, radio buttons and dropdowns.</li><li><b>Sign</b>: draw, type or upload a PNG, then click to place.</li><li><b>Edit text</b>: click a line of existing text to retype it.</li><li><b>Pages</b>: drag thumbnails to reorder; add blanks, PDFs or photos.</li><li><b>Export</b> to PDF, Word, images, text or HTML.</li></ol><p class="note">Files are processed in your browser and never uploaded.</p></div>`;
  }
  $('#inspTitle').textContent = title; box.innerHTML = h;
  if (S.tool === 'check') $('#cMark').value = S.checkMark;
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let inspCk = null;
function inspHandler(e) {
  const t = e.target.closest('[data-act]'); if (!t) return;
  const act = t.dataset.act, isClick = e.type === 'click';
  if (isClick && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
  const val = t.dataset.v ?? (t.type === 'checkbox' ? t.checked : t.value);
  const g = getSel();
  // tool defaults
  const tdefActs = { font: 1, size: 1, bold: 1, color: 1 };
  if (!g && (S.tool === 'text' || S.tool === 'date') && tdefActs[act]) { S.tdef[act] = act === 'size' ? clamp(+val || 12, 4, 144) : val; if (isClick) renderInspector(); return; }
  if (act === 'shapeKind') { S.shape = val; return; }
  if (act === 'stampPick') { S.stamp = +val || 0; return; }
  if (act === 'ink') { S.ink = val; renderInspector(); return; }
  if (act === 'inkW') { S.inkW = clamp(+val || 2, .5, 20); return; }
  if (act === 'hlc') { S.hl = val; renderInspector(); return; }
  if (act === 'cmark') { S.checkMark = val; return; }
  if (act === 'csize') { S.checkSize = clamp(+val || 14, 6, 60); return; }
  if (act === 'cancelPlace') { S.pending = null; setTool('select'); return; }
  if (act === 'flatten') { S.flatten = !!val; return; }
  if (act === 'ftool') { S.fieldType = val; renderInspector(); return; }
  if (act === 'newgroup') { S.radioGroup = null; S.radioGroup = uniqueName('choice'); renderInspector(); toast('New radio buttons start the group ' + S.radioGroup); return; }
  const pageActs = { rotl: 1, rotr: 1, up: 1, down: 1, dupPage: 1, delPage: 1, ocr: 1 };
  if (pageActs[act]) { pageAction(act, S.cur); return; }
  if (!g) return;
  const { p, a } = g;
  if (act === 'del') { deleteAnnot(p, a.id); return; }
  if (act === 'dup') {
    checkpoint(); const c = JSON.parse(JSON.stringify(a)); c.x += 12; c.y += 12;
    if (c.type === 'field') { if (c.ftype === 'radio') { c.opt = 'Option ' + (radioCount(c.name) + 1); c.value = false; c.y += c.h + 6 - 12; c.x -= 12; } else c.name = uniqueName(FBASE[c.ftype]); }
    addAnnot(p, c); return;
  }
  // property edits: one undo step per field focus
  if (inspCk !== t) { checkpoint(); inspCk = t; }
  if (a.type === 'field') {
    if (act === 'ftype') {
      const was = a.ftype, sq = v => v === 'check' || v === 'radio';
      a.ftype = val; a.value = sq(val) ? false : '';
      if (sq(val) !== sq(was)) { const [w, h] = FIELD_SIZE[val]; a.w = w; a.h = h; }
      if (val === 'radio') { if (!S.radioGroup) S.radioGroup = uniqueName('choice'); a.name = S.radioGroup; a.opt = 'Option ' + radioCount(a.name); }
      else if (was === 'radio') a.name = uniqueName(FBASE[val]);
      if (val === 'choice' && !a.options) a.options = ['Option 1', 'Option 2', 'Option 3'];
      renderAnnots(p); inspCk = null; renderInspector(); return;
    }
    if (act === 'fname') { const nv = String(val).trim(); if (nv) { if (a.ftype === 'radio' && S.radioGroup === a.name) S.radioGroup = nv; a.name = nv; } }
    else if (act === 'fopt') a.opt = String(val).trim() || a.opt;
    else if (act === 'fval') a.value = val;
    else if (act === 'ffs') a.fs = +val;
    else if (act === 'fmax') a.max = Math.max(0, parseInt(val, 10) || 0);
    else if (act === 'fopts') a.options = String(val).split('\n').map(x => x.trim()).filter(Boolean);
    else if (act === 'freq') a.required = !!val;
    else if (act === 'fborder') a.border = !!val;
    renderAnnots(p); return;
  }
  if (act === 'text') { a.text = val; if (S.editing === a.id) { const d = annotDom(a.id); d.innerText = val; } else renderAnnots(p); return; }
  if (act === 'size' || act === 'width') a[act] = clamp(+val || 1, act === 'size' ? 4 : .5, act === 'size' ? 144 : 20);
  else if (act === 'opacity') a.opacity = +val;
  else if (act === 'bg') a.bg = val ? '#ffffff' : '';
  else a[act] = val;
  if (S.editing === a.id) styleText(annotDom(a.id), a); else renderAnnots(p);
  if (isClick || t.type === 'color' || t.tagName === 'SELECT') { inspCk = null; if (isClick) renderInspector(); }
}
$('#insp').addEventListener('click', inspHandler);
$('#insp').addEventListener('input', inspHandler);
$('#insp').addEventListener('focusout', () => { inspCk = null; });

/* ---------- pages ---------- */
const thumbCache = new Map();
function buildThumbs() {
  const list = $('#thumbs'); list.innerHTML = '';
  S.pages.forEach((p, i) => {
    const rot = dispRot(p), base = 118, s = base / Math.max(p.w, p.h) * (rot % 180 ? 1 : 1);
    const W = p.w * s, H = p.h * s;
    const t = el('div', 'thumb' + (i === S.cur ? ' cur' : '')); t.draggable = true; t.dataset.id = p.id;
    const box = el('div', 'tbox'); box.style.width = (rot % 180 ? H : W) + 'px'; box.style.height = (rot % 180 ? W : H) + 'px';
    let c = thumbCache.get(p.id);
    if (!c) { c = el('canvas'); thumbCache.set(p.id, c); paintThumb(p, c, s); }
    c.style.width = W + 'px'; c.style.height = H + 'px'; c.style.transform = `translate(-50%,-50%) rotate(${rot}deg)`;
    box.append(c);
    const cb = el('input', 'tsel'); cb.type = 'checkbox'; cb.checked = S.selPages.has(p.id); cb.title = 'Select page'; cb.setAttribute('aria-label', 'Select page ' + (i + 1));
    cb.onclick = e => { e.stopPropagation(); cb.checked ? S.selPages.add(p.id) : S.selPages.delete(p.id); syncSelbar(); };
    const meta = el('div', 'tmeta');
    meta.innerHTML = `<span class="tnum">${i + 1}</span><span class="tacts"><button data-a="rotr" title="Rotate">${svg('rot')}</button><button data-a="dupPage" title="Duplicate">${svg('copy')}</button><button data-a="delPage" title="Delete">${svg('trash')}</button></span>`;
    meta.onclick = e => { const b = e.target.closest('button'); if (b) { e.stopPropagation(); pageAction(b.dataset.a, S.pages.indexOf(p)); } };
    t.append(box, cb, meta);
    t.onclick = () => { scrollToPage(S.pages.indexOf(p)); closeDrawers(); };
    t.ondragstart = e => { e.dataTransfer.setData('text/x-page', p.id); e.dataTransfer.effectAllowed = 'move'; };
    t.ondragover = e => { if ([...e.dataTransfer.types].includes('text/x-page')) { e.preventDefault(); t.classList.add('dragover'); } };
    t.ondragleave = () => t.classList.remove('dragover');
    t.ondrop = e => {
      t.classList.remove('dragover'); const id = e.dataTransfer.getData('text/x-page'); if (!id || id === p.id) return; e.preventDefault(); e.stopPropagation();
      checkpoint(); const from = S.pages.findIndex(q => q.id === id); const [m] = S.pages.splice(from, 1); S.pages.splice(S.pages.indexOf(p), 0, m); S.cur = S.pages.indexOf(m); rebuild();
    };
    list.append(t);
  });
  $('#pageCount').textContent = S.pages.length + (S.pages.length === 1 ? ' page' : ' pages');
  syncSelbar();
}
let thumbQ = Promise.resolve();
function paintThumb(p, c, s) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  c.width = Math.round(p.w * s * dpr); c.height = Math.round(p.h * s * dpr);
  thumbQ = thumbQ.then(() => drawBase(p, c.getContext('2d'), s * dpr)).catch(() => {});
}
function syncSelbar() {
  for (const id of [...S.selPages]) if (!pageById(id)) S.selPages.delete(id);
  $('#selbar').hidden = !S.selPages.size; $('#selCount').textContent = S.selPages.size;
}
function markCurThumb() { $$('.thumb').forEach((t, i) => t.classList.toggle('cur', i === S.cur)); updatePageNo(); }
function updatePageNo() { const n = S.pages.length, i = $('#pageNo'); if (document.activeElement !== i) i.value = n ? S.cur + 1 : ''; i.disabled = !n; $('#pageTotal').textContent = n ? ' / ' + n : ''; }
function scrollToPage(i) { const p = S.pages[i]; const E = p && pageEls.get(p.id); if (!E) return; S.cur = i; markCurThumb(); E.holder.scrollIntoView({ block: 'start', behavior: 'smooth' }); renderInspector(); }
let scrollT;
stage.addEventListener('scroll', () => {
  clearTimeout(scrollT); scrollT = setTimeout(() => {
    const top = stage.getBoundingClientRect().top + stage.clientHeight * .35; let best = 0;
    S.pages.forEach((p, i) => { const E = pageEls.get(p.id); if (E && E.holder.getBoundingClientRect().top <= top) best = i; });
    if (best !== S.cur) { S.cur = best; markCurThumb(); if (!getSel() && S.tool === 'select') renderInspector(); }
  }, 80);
});
function pageAction(act, i) {
  const p = S.pages[i]; if (!p) return;
  if (act === 'ocr') { runOCR(); return; }
  checkpoint();
  if (act === 'rotr') p.rot = (p.rot + 90) % 360;
  else if (act === 'rotl') p.rot = (p.rot + 270) % 360;
  else if (act === 'up' && i > 0) { S.pages.splice(i - 1, 0, S.pages.splice(i, 1)[0]); S.cur = i - 1; }
  else if (act === 'down' && i < S.pages.length - 1) { S.pages.splice(i + 1, 0, S.pages.splice(i, 1)[0]); S.cur = i + 1; }
  else if (act === 'dupPage') { const c = JSON.parse(JSON.stringify(p)); c.id = nid(); c.annots.forEach(a => a.id = nid()); c.fields = []; S.pages.splice(i + 1, 0, c); S.cur = i + 1; if (thumbCache.has(p.id)) thumbCache.set(c.id, cloneCanvas(thumbCache.get(p.id))); }
  else if (act === 'delPage') { S.pages.splice(i, 1); S.cur = clamp(S.cur, 0, Math.max(0, S.pages.length - 1)); toast('Page deleted. Undo with Ctrl+Z.'); }
  if (S.sel && !pageById(S.sel.page)) S.sel = null;
  rebuild();
}
function cloneCanvas(c) { const n = el('canvas'); n.width = c.width; n.height = c.height; n.getContext('2d').drawImage(c, 0, 0); return n; }
$('#bAddBlank').onclick = () => {
  checkpoint(); const ref = S.pages[S.cur] || { w: A4[0], h: A4[1] };
  const w = ref.w, h = ref.h;
  const p = { id: nid(), kind: 'blank', rot: 0, baseRot: 0, w, h, view: [0, 0, w, h], annots: [], fields: [], ocr: null };
  S.pages.splice(S.pages.length ? S.cur + 1 : 0, 0, p); S.cur = S.pages.indexOf(p); rebuild(); scrollToPage(S.cur);
};
$('#bAddPdf').onclick = () => $('#fAddPdf').click();
$('#bAddImg').onclick = () => $('#fAddImg').click();
$('#fAddPdf').onchange = e => { const f = [...e.target.files]; e.target.value = ''; openFiles(f, S.pages.length ? 'append' : 'replace', S.cur + 1); };
$('#fAddImg').onchange = e => { const f = [...e.target.files]; e.target.value = ''; openFiles(f, S.pages.length ? 'append' : 'replace', S.cur + 1); };
$('#bSelClear').onclick = () => { S.selPages.clear(); buildThumbs(); };
$('#bSelDelete').onclick = () => { checkpoint(); S.pages = S.pages.filter(p => !S.selPages.has(p.id)); toast(`Deleted ${S.selPages.size} pages. Undo with Ctrl+Z.`); S.selPages.clear(); S.cur = 0; S.sel = null; rebuild(); };
$('#bSelRotate').onclick = () => { checkpoint(); S.pages.forEach(p => { if (S.selPages.has(p.id)) p.rot = (p.rot + 90) % 360; }); rebuild(); };
$('#bSelExtract').onclick = () => exportRun('pdf', { selectedOnly: true });

/* ---------- open / drop ---------- */
$('#bOpen').onclick = () => $('#fOpen').click();
$('#fOpen').onchange = e => { const f = [...e.target.files]; e.target.value = ''; openFiles(f, 'replace'); };
let dragDepth = 0;
document.addEventListener('dragenter', e => { if ([...e.dataTransfer.types].includes('Files')) { dragDepth++; stage.classList.add('dropping'); } });
document.addEventListener('dragleave', e => { if ([...e.dataTransfer.types].includes('Files') && --dragDepth <= 0) { dragDepth = 0; stage.classList.remove('dropping'); } });
document.addEventListener('dragover', e => { if ([...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
document.addEventListener('drop', e => {
  if (!e.dataTransfer.files.length) return; e.preventDefault(); dragDepth = 0; stage.classList.remove('dropping');
  const files = [...e.dataTransfer.files];
  openFiles(files, (S.isSample || !S.pages.length) ? 'replace' : 'append');
});

/* ---------- zoom ---------- */
function fitZoom() {
  const avail = Math.max(240, stage.clientWidth - 48);
  const maxW = Math.max(...S.pages.map(p => dispRot(p) % 180 ? p.h : p.w), 1);
  S.zoom = clamp(Math.floor(avail / maxW * 20) / 20, .25, 1.5);
}
function setZoom(z) { const ratio = stage.scrollTop / Math.max(1, stage.scrollHeight); S.zoom = clamp(Math.round(z * 100) / 100, .25, 4); buildStage(); stage.scrollTop = ratio * stage.scrollHeight; }
$('#bZoomIn').onclick = () => setZoom(S.zoom * 1.2);
$('#bZoomOut').onclick = () => setZoom(S.zoom / 1.2);
$('#bFit').onclick = () => { fitZoom(); buildStage(); };
$('#bUndo').onclick = undo; $('#bRedo').onclick = redo;

/* ---------- drawers (narrow screens) ---------- */
function closeDrawers() { $('#pagesPanel').classList.remove('open'); $('#inspPanel').classList.remove('open'); $('#scrim').classList.remove('on'); }
$('#bPagesPanel').onclick = () => { $('#pagesPanel').classList.add('open'); $('#scrim').classList.add('on'); };
$('#bInspPanel').onclick = () => { $('#inspPanel').classList.add('open'); $('#scrim').classList.add('on'); };
$('#bInspClose').onclick = closeDrawers; $('#scrim').onclick = closeDrawers;

/* ---------- OCR ---------- */
function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('blocked')); document.head.append(s); }); }
const withTimeout = (pr, ms) => Promise.race([pr, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
const absUrl = u => new URL(u, location.href).href;
async function runOCR() {
  const targets = [];
  for (const p of S.pages) { const tc = await getText(p); if (!tc.items.some(i => i.str && i.str.trim()) && !(p.ocr && p.ocr.length)) targets.push(p); }
  if (!targets.length) { toast('Every page already has selectable text.'); return; }
  busy('Loading text recognition…');
  let worker;
  try {
    if (!window.Tesseract) await loadScript('vendor/tesseract/tesseract.min.js');
    worker = await withTimeout(Tesseract.createWorker('eng', 1, { workerPath: absUrl('vendor/tesseract/worker.min.js'), corePath: absUrl('vendor/tesseract/core'), langPath: absUrl('vendor/tesseract/lang') }), 45000);
    checkpoint();
    for (let k = 0; k < targets.length; k++) {
      const p = targets[k]; busy(`Reading page ${S.pages.indexOf(p) + 1} (${k + 1} of ${targets.length})…`);
      const c = document.createElement('canvas'), sc = 2.5; c.width = p.w * sc; c.height = p.h * sc;
      await drawBase(p, c.getContext('2d'), sc);
      const { data } = await worker.recognize(c);
      p.ocr = (data.lines || []).filter(l => l.text.trim() && l.confidence > 30).map(l => ({ text: l.text.trim(), x: l.bbox.x0 / sc, y: l.bbox.y0 / sc, w: (l.bbox.x1 - l.bbox.x0) / sc, h: (l.bbox.y1 - l.bbox.y0) / sc }));
      renderTextLayer(p);
    }
    toast(`Recognised text on ${targets.length} page${targets.length > 1 ? 's' : ''}. It is selectable now and saved invisibly in exported PDFs.`);
  } catch (e) {
    toast('Text recognition needs to download its language data, which this viewer blocks. Download the HTML file and open it in your browser to use it.', 'err');
  } finally { busy(null); if (worker) worker.terminate().catch(() => {}); }
}

/* ---------- export: PDF ---------- */
const hexRgb = h => { const n = parseInt((h || '#000').slice(1), 16); return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255); };
const WIN_EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
const winSafe = s => [...s.replace(/\t/g, '    ')].map(ch => { const c = ch.codePointAt(0); return (c >= 32 && c <= 126) || (c >= 160 && c <= 255) || WIN_EXTRA.includes(ch) ? ch : '?'; }).join('');
function fillForm(lib, src) {
  let form; try { form = lib.getForm(); } catch (e) { return null; }
  for (const f of form.getFields()) {
    const key = src + ':' + f.getName(); if (!(key in S.formVals)) continue; const v = S.formVals[key];
    try {
      if (f instanceof PDFLib.PDFTextField) f.setText(v ? String(v) : '');
      else if (f instanceof PDFLib.PDFCheckBox) v ? f.check() : f.uncheck();
      else if (f instanceof PDFLib.PDFRadioGroup) { if (v) f.select(v); else f.clear(); }
      else if (f instanceof PDFLib.PDFDropdown || f instanceof PDFLib.PDFOptionList) { if (v) f.select(v); else f.clear(); }
    } catch (e) { console.warn('field', f.getName(), e); }
  }
  return form;
}
function addFormField(doc, page, a, x, y, fctx) {
  const form = doc.getForm();
  const uniq = nm => { nm = winSafe(String(nm || 'field')).replace(/\./g, '_').trim() || 'field'; let n = nm, i = 2; while (fctx.used.has(n) || form.getFieldMaybe(n)) n = nm + '_' + (i++); fctx.used.add(n); return n; };
  const o = { x, y, width: a.w, height: a.h, textColor: rgb(0, 0, 0), backgroundColor: undefined };
  if (a.border !== false) { o.borderColor = rgb(.55, .6, .7); o.borderWidth = 1; } else { o.borderColor = undefined; o.borderWidth = 0; }
  let f;
  if (a.ftype === 'text' || a.ftype === 'multi') {
    f = form.createTextField(uniq(a.name)); if (a.ftype === 'multi') f.enableMultiline();
    if (a.max) f.setMaxLength(a.max);
    f.addToPage(page, o);
    if (a.value) f.setText((a.max ? String(a.value).slice(0, a.max) : String(a.value)).split('\n').map(winSafe).join('\n'));
    const fsz = a.fs || (a.ftype === 'multi' ? 10 : 0); if (fsz) f.setFontSize(fsz);
  } else if (a.ftype === 'check') {
    f = form.createCheckBox(uniq(a.name)); f.addToPage(page, o); if (a.value) f.check();
  } else if (a.ftype === 'radio') {
    const gk = a.gkey || a.name; let g = fctx.radios[gk]; if (!g) { g = fctx.radios[gk] = form.createRadioGroup(uniq(a.name)); fctx.opts[gk] = new Set(); }
    const used = fctx.opts[gk]; const base = winSafe(String(a.opt || 'Option')).trim() || 'Option'; let v = base, i = 2; while (used.has(v)) v = base + ' ' + (i++); used.add(v);
    g.addOptionToPage(v, page, o); if (a.value) g.select(v); f = g;
  } else {
    f = form.createDropdown(uniq(a.name)); const opts = [...new Set((a.options || []).map(winSafe))]; if (opts.length) f.addOptions(opts);
    f.addToPage(page, o); if (a.value && opts.includes(winSafe(a.value))) f.select(winSafe(a.value)); if (a.fs) f.setFontSize(a.fs);
  }
  if (a.required) { try { f.enableRequired(); } catch (e) {} }
}
function fieldFromParsed(f) {
  const v = S.formVals[f.key];
  const o = { name: f.name, gkey: f.key, w: f.w, h: f.h, border: true, required: false, fs: 0, max: f.max || 0 };
  if (f.type === 'text') Object.assign(o, { ftype: f.multi ? 'multi' : 'text', value: v || '' });
  else if (f.type === 'check') Object.assign(o, { ftype: 'check', value: !!v });
  else if (f.type === 'radio') Object.assign(o, { ftype: 'radio', opt: f.on, value: v === f.on });
  else Object.assign(o, { ftype: 'choice', options: (f.options || []).map(x => x.v), value: v || '' });
  return o;
}
async function drawAnnots(doc, page, p, fonts, imgCache, fctx) {
  const v = p.view, top = v[3], X = x => v[0] + x;
  const font = async (name, bold) => {
    const k = name + (bold ? 'B' : ''); if (fonts[k]) return fonts[k];
    const HB = [StandardFonts.Helvetica, StandardFonts.HelveticaBold], TB = [StandardFonts.TimesRoman, StandardFonts.TimesRomanBold], CB = [StandardFonts.Courier, StandardFonts.CourierBold];
    const m = { Arial: HB, Helvetica: HB, 'Times New Roman': TB, Times: TB, 'Courier New': CB, Courier: CB }[name] || [StandardFonts.Helvetica, StandardFonts.HelveticaBold];
    return fonts[k] = await doc.embedFont(m[bold ? 1 : 0]);
  };
  if (fctx && fctx.recreate && p.kind === 'pdf') for (const f of p.fields) { try { addFormField(doc, page, fieldFromParsed(f), X(f.x), top - f.y - f.h, fctx); } catch (e) { console.warn('field', f.name, e); } }
  for (const l of p.ocr || []) {
    const f = await font('Helvetica'); const size = Math.max(2, l.h * .85); const t = winSafe(l.text);
    try { page.drawText(t, { x: X(l.x), y: top - l.y - l.h * .8, size, font: f, opacity: 0 }); } catch (e) {}
  }
  for (const a of p.annots) {
    try {
      if (a.type === 'field') {
        addFormField(doc, page, a, X(a.x), top - a.y - a.h, fctx);
      } else if (a.type === 'white' || a.type === 'hl') {
        page.drawRectangle({ x: X(a.x), y: top - a.y - a.h, width: a.w, height: a.h, color: hexRgb(a.color), opacity: a.opacity ?? 1, ...(a.type === 'hl' ? { blendMode: BlendMode.Multiply } : {}) });
      } else if (a.type === 'text') {
        const f = await font(a.font, a.bold);
        const lines = a.text.split('\n');
        if (a.bg) { const w = Math.max(...lines.map(l => f.widthOfTextAtSize(winSafe(l), a.size))); page.drawRectangle({ x: X(a.x), y: top - a.y - lines.length * a.size * 1.2, width: w, height: lines.length * a.size * 1.2, color: rgb(1, 1, 1) }); }
        lines.forEach((ln, i) => { if (!ln.trim()) return; page.drawText(winSafe(ln), { x: X(a.x), y: top - (a.y + i * a.size * 1.2 + a.size * .94), size: a.size, font: f, color: hexRgb(a.color) }); });
      } else if (a.type === 'image') {
        const im = S.imgs[a.img]; if (!im) continue;
        let e = imgCache[a.img]; if (!e) e = imgCache[a.img] = im.type === 'png' ? await doc.embedPng(im.bytes) : await doc.embedJpg(im.bytes);
        page.drawImage(e, { x: X(a.x), y: top - a.y - a.h, width: a.w, height: a.h, opacity: a.opacity ?? 1 });
      } else if (a.type === 'shape') {
        const col = hexRgb(a.color), seg = (x1, y1, x2, y2) => page.drawLine({ start: { x: X(a.x + x1), y: top - a.y - y1 }, end: { x: X(a.x + x2), y: top - a.y - y2 }, thickness: a.width, color: col, lineCap: LineCapStyle.Round });
        if (a.kind === 'rect') page.drawRectangle({ x: X(a.x), y: top - a.y - a.h, width: a.w, height: a.h, borderColor: col, borderWidth: a.width });
        else if (a.kind === 'ellipse') page.drawEllipse({ x: X(a.x + a.w / 2), y: top - a.y - a.h / 2, xScale: a.w / 2, yScale: a.h / 2, borderColor: col, borderWidth: a.width });
        else { const g = lineGeom(a); seg(g.x1, g.y1, g.x2, g.y2); if (a.kind === 'arrow') headSegs(g.x1, g.y1, g.x2, g.y2, a.width).forEach(q => seg(...q)); }
      } else if (a.type === 'draw') {
        for (let i = 1; i < a.pts.length; i++) {
          const [x1, y1] = a.pts[i - 1], [x2, y2] = a.pts[i];
          page.drawLine({ start: { x: X(a.x + x1), y: top - a.y - y1 }, end: { x: X(a.x + x2), y: top - a.y - y2 }, thickness: a.width, color: hexRgb(a.color), lineCap: LineCapStyle.Round });
        }
      } else if (a.type === 'check') {
        const k = a.w / 24, P = (x, y) => ({ x: X(a.x + x * k), y: top - a.y - y * k }), th = 2.6 * k, c = hexRgb(a.color);
        if (a.mark === 'dot') page.drawCircle({ x: X(a.x + a.w / 2), y: top - a.y - a.h / 2, size: 6 * k, color: c });
        else (a.mark === 'cross' ? [[5, 5, 19, 19], [19, 5, 5, 19]] : [[4, 12.5, 9, 17.5], [9, 17.5, 20, 6.5]]).forEach(([a1, b1, a2, b2]) => page.drawLine({ start: P(a1, b1), end: P(a2, b2), thickness: th, color: c, lineCap: LineCapStyle.Round }));
      }
    } catch (e) { console.warn('annot export', a.type, e); }
  }
}
async function rasterRedact(doc, p) {
  const scale = 2.5, c = document.createElement('canvas'); c.width = Math.round(p.w * scale); c.height = Math.round(p.h * scale);
  const ctx = c.getContext('2d'); await drawBase(p, ctx, scale);
  ctx.fillStyle = '#000'; for (const a of p.annots) if (a.redact) ctx.fillRect(a.x * scale, a.y * scale, a.w * scale, a.h * scale);
  const blob = await canvasBlob(c, 'image/jpeg', .9), img = await doc.embedJpg(new Uint8Array(await blob.arrayBuffer()));
  const page = doc.addPage([p.w, p.h]); page.drawImage(img, { x: 0, y: 0, width: p.w, height: p.h }); c.width = c.height = 0; return page;
}
async function buildPdf(list, { flatten }) {
  const fonts = {}, imgCache = {}, fctx = { radios: {}, opts: {}, used: new Set() };
  const s0 = S.sources[0];
  const inPlace = s0 && list === S.pages && !list.some(p => p.annots.some(a => a.redact)) && list.length === s0.pdf.numPages && list.every((p, i) => p.kind === 'pdf' && p.src === 0 && p.idx === i);
  let doc;
  if (inPlace) {
    doc = await PDFDocument.load(s0.bytes, { ignoreEncryption: true });
    fillForm(doc, 0);
    const pages = doc.getPages();
    for (let i = 0; i < list.length; i++) { const p = list[i]; pages[i].setRotation(degrees(dispRot(p))); await drawAnnots(doc, pages[i], p, fonts, imgCache, fctx); }
  } else {
    doc = await PDFDocument.create();
    const libs = {};
    for (const p of list) {
      let page;
      if (p.annots.some(a => a.redact)) { page = await rasterRedact(doc, p); }
      else if (p.kind === 'pdf') {
        if (!libs[p.src]) {
          const lib = await PDFDocument.load(S.sources[p.src].bytes, { ignoreEncryption: true });
          const form = fillForm(lib, p.src);
          if (form) {
            if (flatten) { try { form.flatten(); } catch (e) { console.warn(e); } }
            else { fctx.recreate = true; for (const fld of form.getFields()) { try { form.removeField(fld); } catch (e) { try { form.flatten(); } catch (_) {} break; } } }
          }
          libs[p.src] = lib;
        }
        const [cp] = await doc.copyPages(libs[p.src], [p.idx]); page = doc.addPage(cp);
      } else {
        page = doc.addPage([p.w, p.h]);
        if (p.kind === 'image') {
          const im = S.imgs[p.img]; let e = imgCache[p.img]; if (!e) e = imgCache[p.img] = im.type === 'png' ? await doc.embedPng(im.bytes) : await doc.embedJpg(im.bytes);
          page.drawImage(e, { x: p.box.x, y: p.h - p.box.y - p.box.h, width: p.box.w, height: p.box.h });
        }
      }
      page.setRotation(degrees(dispRot(p)));
      await drawAnnots(doc, page, p, fonts, imgCache, fctx);
    }
  }
  if (flatten) { try { doc.getForm().flatten(); } catch (e) { console.warn(e); } }
  if (S.mark && (S.mark.wm || S.mark.nums)) await stampDoc(doc, S.mark);
  doc.setProducer('Pagewright'); doc.setModificationDate(new Date());
  return await doc.save();
}

async function stampDoc(doc, m) {
  const f = await doc.embedFont(StandardFonts.HelveticaBold), r = await doc.embedFont(StandardFonts.Helvetica), pgs = doc.getPages();
  const t = m.wm ? winSafe(m.wm) : '', w100 = t ? f.widthOfTextAtSize(t, 100) || 1 : 1;
  pgs.forEach((pg, i) => {
    const { x: X0, y: Y0, width: W, height: H } = pg.getMediaBox();
    if (t) { const size = Math.min(140, 100 * 0.85 * Math.min(W, H) * 1.2 / w100), w = f.widthOfTextAtSize(t, size), c = Math.SQRT1_2; pg.drawText(t, { x: X0 + W / 2 - w / 2 * c + size * .3 * c, y: Y0 + H / 2 - w / 2 * c - size * .3 * c, size, font: f, color: rgb(.5, .5, .5), opacity: .2, rotate: degrees(45) }); }
    if (m.nums) { const s = `${i + 1} / ${pgs.length}`; pg.drawText(s, { x: X0 + W / 2 - r.widthOfTextAtSize(s, 9) / 2, y: Y0 + 18, size: 9, font: r, color: rgb(.35, .35, .35) }); }
  });
}
/* ---------- export: text, word, images ---------- */
async function pageParas(doc, i, sp) {
  const pg = await doc.getPage(i + 1), tc = await pg.getTextContent(), v = pg.view;
  const covers = (sp ? sp.annots : []).filter(a => a.type === 'white');
  const items = [];
  for (const it of tc.items) {
    if (!it.str) continue;
    const [a, b, c, d, e, f] = it.transform; const size = Math.hypot(c, d) || Math.hypot(a, b) || 10;
    const x = e - v[0], y = v[3] - f, cx = x + it.width / 2, cy = y - size / 3;
    if (covers.some(r => cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h)) continue;
    if (!it.str.trim() && !items.length) continue;
    items.push({ s: it.str, x, y, w: it.width, size });
  }
  items.sort((p, q) => p.y - q.y || p.x - q.x);
  const lines = [];
  for (const it of items) {
    const L = lines[lines.length - 1];
    if (L && Math.abs(L.y - it.y) < Math.max(2, Math.min(L.size, it.size) * .5)) { L.items.push(it); L.size = Math.max(L.size, it.size); }
    else lines.push({ y: it.y, size: it.size, items: [it] });
  }
  for (const L of lines) {
    L.items.sort((p, q) => p.x - q.x); let t = '', prev = null;
    for (const it of L.items) { if (prev) { const gap = it.x - (prev.x + prev.w); if (gap > prev.size * .2 && !/\s$/.test(t) && !/^\s/.test(it.s)) t += gap > prev.size * 2.5 ? '\t' : ' '; } t += it.s; prev = it; }
    L.text = t.replace(/\s+$/, '');
  }
  const sizes = lines.map(l => l.size).sort((a, b) => a - b), med = sizes[Math.floor(sizes.length / 2)] || 11;
  const paras = []; let P = null, prevL = null;
  for (const L of lines) {
    if (!L.text.trim()) continue;
    const gap = prevL ? L.y - prevL.y : 0;
    if (!P || gap > Math.max(L.size, prevL.size) * 1.75 || Math.abs(L.size - prevL.size) > 1.2) { P = { lines: [], size: L.size }; paras.push(P); }
    P.lines.push(L.text); prevL = L;
  }
  paras.forEach(p => { p.text = p.lines.join(' ').replace(/-\s(?=[a-z])/g, '-').replace(/ {2,}/g, ' '); p.heading = p.size >= med * 1.3 ? (p.size >= med * 1.8 ? 1 : 2) : 0; });
  return { paras, hasText: paras.length > 0, w: v[2] - v[0], h: v[3] - v[1] };
}
async function renderPageImage(doc, i, scale, type = 'image/png', q) {
  const pg = await doc.getPage(i + 1), vp = pg.getViewport({ scale });
  const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
  const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
  await pg.render({ canvasContext: x, viewport: vp }).promise;
  return { blob: await canvasBlob(c, type, q), w: c.width, h: c.height, pw: vp.width / scale, ph: vp.height / scale };
}
const xmlEsc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '');
async function buildDocx(doc, list, mode) {
  const zip = new JSZip(); const rels = []; let body = ''; let imgN = 0;
  const first = (await doc.getPage(1)).getViewport({ scale: 1 });
  const pw = first.width, ph = first.height;
  const margin = mode === 'image' ? 0 : 72;
  const run = (t, sz, b) => `<w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>${b ? '<w:b/>' : ''}<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr>${t.split('\t').map((s, k) => (k ? '<w:tab/>' : '') + `<w:t xml:space="preserve">${xmlEsc(s)}</w:t>`).join('')}</w:r>`;
  const picture = async (i, maxW, maxH, brk) => {
    const r = await renderPageImage(doc, i, mode === 'image' ? 2 : 1.6, 'image/jpeg', .88);
    imgN++; const name = `page${imgN}.jpeg`, rid = 'rIdImg' + imgN;
    zip.file('word/media/' + name, await r.blob.arrayBuffer());
    rels.push(`<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${name}"/>`);
    const k = Math.min(maxW / r.pw, maxH / r.ph) * .995;
    const cx = Math.round(r.pw * k * 12700), cy = Math.round(r.ph * k * 12700);
    return `<w:p><w:pPr>${brk ? '<w:pageBreakBefore/>' : ''}<w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="center"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${imgN}" name="Page ${i + 1}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${imgN}" name="${name}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
  };
  for (let i = 0; i < doc.numPages; i++) {
    busy(`Converting page ${i + 1} of ${doc.numPages}…`);
    if (mode === 'image') { body += await picture(i, pw, ph - 1, i > 0); continue; }
    const pp = await pageParas(doc, i, list[i]);
    if (!pp.hasText) { body += await picture(i, pw - 2 * margin, ph - 2 * margin, i > 0); continue; }
    pp.paras.forEach((p, k) => {
      const sz = Math.round(clamp(p.size, 6, 72) * 2);
      body += `<w:p><w:pPr>${i > 0 && k === 0 ? '<w:pageBreakBefore/>' : ''}${p.heading ? `<w:keepNext/><w:outlineLvl w:val="${p.heading - 1}"/>` : ''}<w:spacing w:before="0" w:after="${p.heading ? 120 : 160}"/></w:pPr>${run(p.text, sz, !!p.heading)}</w:p>`;
    });
  }
  const tw = v => Math.round(v * 20);
  const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><w:body>${body}<w:sectPr><w:pgSz w:w="${tw(pw)}" w:h="${tw(ph)}"${pw > ph ? ' w:orient="landscape"' : ''}/><w:pgMar w:top="${tw(margin)}" w:right="${tw(margin)}" w:bottom="${tw(margin)}" w:left="${tw(margin)}" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`);
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`);
  zip.file('docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xmlEsc(S.docName)}</dc:title><dc:creator>Pagewright</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().slice(0, 19)}Z</dcterms:created></cp:coreProperties>`);
  zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join('')}</Relationships>`);
  zip.file('word/document.xml', docXml);
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', compression: 'DEFLATE' });
}

/* ---------- export dialog ---------- */
function expOptsHtml(fmt) {
  const nf = fieldCount();
  if (fmt === 'pdf') return (nf ? `<label class="tog"><input type="checkbox" id="oFlatten" ${S.flatten ? 'checked' : ''}> Lock form fields (flatten)</label>` : '') + `<div class="field"><label for="oWm">Watermark text</label><input class="inp" id="oWm" maxlength="40" placeholder="e.g. DRAFT or CONFIDENTIAL"></div><label class="tog"><input type="checkbox" id="oNums"> Add page numbers</label>`;
  if (fmt === 'docx') return `<div class="field"><span class="lbl">Layout</span>
    <label class="tog"><input type="radio" name="dmode" value="text" checked> Editable text: reflowed paragraphs you can edit in Word</label>
    <label class="tog"><input type="radio" name="dmode" value="image"> Exact look: each page as a full-page picture</label></div>
    <p class="note">Scanned pages without text are placed as pictures in both modes.</p>`;
  if (fmt === 'png' || fmt === 'jpg') return `<div class="field"><label for="oDpi">Resolution</label><select class="inp" id="oDpi"><option value="1.5">108 dpi · screen</option><option value="2.0833" selected>150 dpi · standard</option><option value="4.1667">300 dpi · print</option></select></div>`;
  return '';
}
$('#bExport').onclick = () => {
  if (!S.pages.length) { toast('There are no pages to export.', 'err'); return; }
  commitEdit();
  $('#expModal').hidden = false;
  const fmt = $('input[name=fmt]:checked').value; $('#expOpts').innerHTML = expOptsHtml(fmt);
  $('#expSelWrap').hidden = !S.selPages.size; $('#expSelN').textContent = S.selPages.size; $('#expSel').checked = false;
};
$('#fmts').onchange = () => { $('#expOpts').innerHTML = expOptsHtml($('input[name=fmt]:checked').value); };
$('#expGo').onclick = () => {
  const fmt = $('input[name=fmt]:checked').value;
  const opts = { selectedOnly: $('#expSel').checked };
  S.mark = { wm: $('#oWm') ? $('#oWm').value.trim() : '', nums: !!($('#oNums') && $('#oNums').checked) };
  if ($('#oFlatten')) { S.flatten = $('#oFlatten').checked; }
  const dm = $('input[name=dmode]:checked'); if (dm) opts.docMode = dm.value;
  if ($('#oDpi')) opts.scale = +$('#oDpi').value;
  closeModals(); exportRun(fmt, opts);
};
async function exportRun(fmt, opts = {}) {
  commitEdit();
  const list = opts.selectedOnly ? S.pages.filter(p => S.selPages.has(p.id)) : S.pages;
  if (!list.length) { toast('Select at least one page first.', 'err'); return; }
  const base = (S.docName || 'document').replace(/[\\/:*?"<>|]+/g, '-') + (opts.selectedOnly ? '-extract' : '');
  busy('Preparing your file…'); await tick();
  try {
    if (fmt === 'pdf') {
      const bytes = await buildPdf(list, { flatten: S.flatten });
      busy(null); await saveFile(base + '.pdf', new Blob([bytes], { type: 'application/pdf' })); return;
    }
    const bytes = await buildPdf(list, { flatten: true });
    const doc = await pdfjsLib.getDocument({ data: bytes.slice(0), isEvalSupported: false }).promise;
    let blob, name;
    if (fmt === 'png' || fmt === 'jpg') {
      const type = fmt === 'png' ? 'image/png' : 'image/jpeg', sc = opts.scale || 2.0833;
      if (doc.numPages === 1) { blob = (await renderPageImage(doc, 0, sc, type, .9)).blob; name = `${base}.${fmt}`; }
      else {
        const zip = new JSZip();
        for (let i = 0; i < doc.numPages; i++) { busy(`Rendering page ${i + 1} of ${doc.numPages}…`); zip.file(`${base}-page-${String(i + 1).padStart(2, '0')}.${fmt}`, await (await renderPageImage(doc, i, sc, type, .9)).blob.arrayBuffer()); }
        busy('Zipping…'); blob = await zip.generateAsync({ type: 'blob' }); name = `${base}-${fmt}.zip`;
      }
    } else if (fmt === 'docx') {
      blob = await buildDocx(doc, list, opts.docMode || 'text'); name = base + '.docx';
    } else if (fmt === 'txt') {
      let out = '';
      for (let i = 0; i < doc.numPages; i++) { const pp = await pageParas(doc, i, list[i]); out += (i ? '\n\n' : '') + `--- Page ${i + 1} ---\n\n` + (pp.hasText ? pp.paras.map(p => p.text).join('\n\n') : '[No text on this page]'); }
      blob = new Blob([out], { type: 'text/plain;charset=utf-8' }); name = base + '.txt';
    } else if (fmt === 'html') {
      let body = '';
      for (let i = 0; i < doc.numPages; i++) {
        busy(`Converting page ${i + 1} of ${doc.numPages}…`);
        const pp = await pageParas(doc, i, list[i]);
        body += `<section class="pg"><p class="pn">Page ${i + 1}</p>`;
        if (pp.hasText) body += pp.paras.map(p => p.heading ? `<h${p.heading}>${esc(p.text)}</h${p.heading}>` : `<p>${esc(p.text)}</p>`).join('\n');
        else { const r = await renderPageImage(doc, i, 1.5, 'image/jpeg', .85); body += `<img src="${await blobToDataUrl(r.blob)}" alt="Page ${i + 1}">`; }
        body += '</section>\n';
      }
      const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(S.docName)}</title><style>body{font:16px/1.6 Georgia,serif;max-width:46rem;margin:2rem auto;padding:0 1rem;color:#1a1a1a}h1,h2{font-family:Helvetica,Arial,sans-serif;line-height:1.25}.pg{border-top:1px solid #ddd;padding-top:1rem;margin-top:2rem}.pn{font:12px Helvetica,Arial,sans-serif;color:#888;text-transform:uppercase;letter-spacing:.08em}img{max-width:100%;border:1px solid #ddd}</style></head><body>${body}</body></html>`;
      blob = new Blob([html], { type: 'text/html' }); name = base + '.html';
    }
    doc.destroy(); busy(null);
    await saveFile(name, blob);
  } catch (e) { console.error(e); busy(null); toast('Export failed: ' + (e.message || e), 'err'); }
}

/* ---------- header ---------- */
function updateHeader() {
  const has = S.pages.length > 0;
  $('#docName').textContent = has || S.sources.length ? S.docName + '.pdf' : 'No document open';
  $('#sampleChip').hidden = !S.isSample || !has;
  $('#bExport').disabled = !has;
}

/* ---------- sample document ---------- */
async function makeSample() {
  const doc = await PDFDocument.create(); doc.setTitle('Supplier Accreditation Form (sample)');
  const H = await doc.embedFont(StandardFonts.Helvetica), HB = await doc.embedFont(StandardFonts.HelveticaBold), T = await doc.embedFont(StandardFonts.TimesRoman);
  const form = doc.getForm();
  const ink = rgb(.08, .1, .14), mute = rgb(.4, .43, .5), line = rgb(.74, .77, .82), band = rgb(.137, .259, .768);
  const W = 595.28, Hh = 841.89;
  const wrap = (text, font, size, width) => { const out = []; let cur = ''; for (const w of text.split(' ')) { const t = cur ? cur + ' ' + w : w; if (font.widthOfTextAtSize(t, size) > width && cur) { out.push(cur); cur = w; } else cur = t; } if (cur) out.push(cur); return out; };
  const para = (pg, text, x, y, width, size = 10, font = T, lh = 1.45) => { for (const l of wrap(text, font, size, width)) { pg.drawText(l, { x, y, size, font, color: ink }); y -= size * lh; } return y; };
  const p1 = doc.addPage([W, Hh]);
  p1.drawRectangle({ x: 0, y: Hh - 92, width: W, height: 92, color: band });
  p1.drawText('NORTHWIND TRADING CO.', { x: 48, y: Hh - 38, size: 9.5, font: HB, color: rgb(1, 1, 1) });
  p1.drawText('Supplier Accreditation Form', { x: 48, y: Hh - 66, size: 22, font: HB, color: rgb(1, 1, 1) });
  p1.drawText('Form SA-01  ·  Rev. 3', { x: W - 160, y: Hh - 38, size: 9, font: H, color: rgb(.85, .88, 1) });
  let y = Hh - 128;
  p1.drawText('1   BUSINESS DETAILS', { x: 48, y, size: 9.5, font: HB, color: band }); y -= 10;
  p1.drawLine({ start: { x: 48, y }, end: { x: W - 48, y }, thickness: .6, color: line }); y -= 22;
  const label = (t, x, yy) => p1.drawText(t, { x, y: yy, size: 8, font: HB, color: mute });
  const tf = (name, x, yy, w, h = 20, val = '', multi = false) => { const f = form.createTextField(name); if (multi) f.enableMultiline(); if (val) f.setText(val); f.addToPage(p1, { x, y: yy, width: w, height: h, font: H, borderColor: line, borderWidth: .8, backgroundColor: rgb(1, 1, 1) }); f.setFontSize(multi ? 10 : 10.5); return f; };
  label('REGISTERED BUSINESS NAME', 48, y); label('TIN', 380, y); y -= 24;
  tf('business_name', 48, y, 316, 20, 'Santos Hardware & Construction Supply'); tf('tin', 380, y, 167, 20, '000-123-456-000'); y -= 22;
  label('BUSINESS ADDRESS', 48, y); y -= 24; tf('address', 48, y, 499); y -= 22;
  label('BUSINESS TYPE', 48, y); label('YEARS IN OPERATION', 250, y); label('MOBILE NUMBER', 380, y); y -= 24;
  const dd = form.createDropdown('business_type'); dd.addOptions(['Sole proprietorship', 'Partnership', 'Corporation', 'Cooperative']); dd.select('Sole proprietorship');
  dd.addToPage(p1, { x: 48, y, width: 186, height: 20, font: H, borderColor: line, borderWidth: .8, backgroundColor: rgb(1, 1, 1) }); dd.setFontSize(10.5);
  tf('years', 250, y, 114); tf('mobile', 380, y, 167); y -= 36;
  p1.drawText('2   CONTACT AND COMPLIANCE', { x: 48, y, size: 9.5, font: HB, color: band }); y -= 10;
  p1.drawLine({ start: { x: 48, y }, end: { x: W - 48, y }, thickness: .6, color: line }); y -= 22;
  label('CONTACT PERSON', 48, y); label('EMAIL', 300, y); y -= 24; tf('contact_person', 48, y, 236); tf('email', 300, y, 247); y -= 30;
  const cb = (name, text, x, yy, on) => { const c = form.createCheckBox(name); c.addToPage(p1, { x, y: yy, width: 12, height: 12, borderColor: line, borderWidth: .8, backgroundColor: rgb(1, 1, 1) }); if (on) c.check(); p1.drawText(text, { x: x + 19, y: yy + 2.5, size: 9.5, font: H, color: ink }); };
  cb('vat_registered', 'VAT-registered', 48, y, true); cb('has_2303', 'Certificate of Registration (BIR 2303) attached', 180, y, false); y -= 20;
  cb('accepts_terms', 'Accepts 30-day payment terms', 48, y, false); cb('has_permit', "Mayor's permit valid for 2026", 260, y, false); y -= 30;
  label('PRODUCTS OR SERVICES OFFERED', 48, y); y -= 62; tf('offerings', 48, y, 499, 56, '', true); y -= 34;
  p1.drawText('3   DECLARATION', { x: 48, y, size: 9.5, font: HB, color: band }); y -= 10;
  p1.drawLine({ start: { x: 48, y }, end: { x: W - 48, y }, thickness: .6, color: line }); y -= 18;
  y = para(p1, 'I certify that the information in this form is true and complete. I understand that Northwind Trading Co. may verify these details with the issuing agencies, and that false statements are grounds for removal from the accredited supplier list.', 48, y, 499, 10.5);
  y -= 50;
  p1.drawLine({ start: { x: 48, y }, end: { x: 290, y }, thickness: .8, color: ink });
  p1.drawLine({ start: { x: 340, y }, end: { x: W - 48, y }, thickness: .8, color: ink });
  p1.drawText('Signature over printed name', { x: 48, y: y - 13, size: 8.5, font: H, color: mute });
  p1.drawText('Date signed', { x: 340, y: y - 13, size: 8.5, font: H, color: mute });
  p1.drawText('Sample document created by Pagewright for demonstration. Open your own PDF to start.', { x: 48, y: 36, size: 8, font: H, color: mute });
  p1.drawText('Page 1 of 2', { x: W - 96, y: 36, size: 8, font: H, color: mute });
  const p2 = doc.addPage([W, Hh]); y = Hh - 72;
  p2.drawText('Terms of Accreditation', { x: 48, y, size: 18, font: HB, color: ink }); y -= 30;
  const terms = [
    'Accreditation is valid for twelve months from the date of approval and must be renewed with updated permits.',
    'Suppliers must issue official receipts or sales invoices registered with the BIR for every delivery.',
    'Deliveries are accepted Monday to Saturday, 8:00 AM to 5:00 PM, at the receiving dock unless otherwise agreed in writing.',
    'Payment is released within thirty days of receiving a complete invoice, delivery receipt and purchase order reference.',
    'Price changes require fifteen days’ written notice and apply only to purchase orders issued after the notice period.',
    'Northwind may suspend accreditation for repeated late deliveries, quality defects or incomplete documents.'
  ];
  terms.forEach((t, i) => { p2.drawText(`${i + 1}.`, { x: 48, y, size: 11, font: HB, color: band }); y = para(p2, t, 70, y, 477, 11) - 12; });
  p2.drawText('Sample document created by Pagewright for demonstration.', { x: 48, y: 36, size: 8, font: H, color: mute });
  p2.drawText('Page 2 of 2', { x: W - 96, y: 36, size: 8, font: H, color: mute });
  return await doc.save();
}

/* ---------- boot ---------- */
IC.sun = 'M12 8a4 4 0 100 8 4 4 0 000-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4';
IC.moon = 'M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z';
const mqDark = matchMedia('(prefers-color-scheme: dark)');
const isDark = () => { const t = document.documentElement.dataset.theme; return t ? t === 'dark' : mqDark.matches; };
IC.system = 'M3 5h18v11H3zM8 20h8M12 16v4';
const themeMode = () => document.documentElement.dataset.theme || 'system';
const THEME_NEXT = { system: 'light', light: 'dark', dark: 'system' };
function paintTheme() { const m = themeMode(), b = $('#bTheme'), l = 'Theme: ' + m + '. Click for ' + THEME_NEXT[m] + '.'; b.innerHTML = svg(m === 'system' ? 'system' : isDark() ? 'moon' : 'sun'); b.title = l; b.setAttribute('aria-label', l); }
$('#bTheme').onclick = () => { const n = THEME_NEXT[themeMode()]; if (n === 'system') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = n; try { if (n === 'system') localStorage.removeItem('pagewright.theme'); else localStorage.setItem('pagewright.theme', n); } catch (e) {} paintTheme(); };
/* page jump, rename, zoom, safety, dialogs */
const pn = $('#pageNo'); pn.onfocus = () => pn.select();
pn.onkeydown = e => { if (e.key === 'Enter') { const n = S.pages.length; if (n) scrollToPage(clamp((parseInt(pn.value, 10) || 1) - 1, 0, n - 1)); pn.blur(); } else if (e.key === 'Escape') pn.blur(); };
pn.onblur = updatePageNo;
const dn = $('#docName');
dn.onclick = () => { if (!S.pages.length) return; dn.contentEditable = 'true'; dn.focus(); getSelection().selectAllChildren(dn); };
dn.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); dn.blur(); } else if (e.key === 'Escape') { dn.textContent = ''; dn.blur(); } };
dn.onblur = () => { dn.contentEditable = 'false'; const v = dn.textContent.replace(/\.pdf$/i, '').replace(/[\\/:*?"<>|]/g, '').trim(); if (v) S.docName = v; updateHeader(); };
stage.addEventListener('wheel', e => { if (!e.ctrlKey || !S.pages.length) return; e.preventDefault(); setZoom(S.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08)); }, { passive: false });
window.addEventListener('beforeunload', e => { if (S.undo.length || Object.keys(S.formVals).length) { e.preventDefault(); e.returnValue = ''; } });
document.addEventListener('click', e => { const b = e.target.closest('button'); if (b && !b.closest('.modal')) lastBtn = b; }, true);
$$('.modal').forEach(m => { m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); });
document.addEventListener('keydown', e => {
  if (e.key !== 'Tab') return; const m = [...$$('.modal')].find(x => !x.hidden); if (!m) return;
  const f = [...m.querySelectorAll('button,input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter(x => !x.disabled && x.offsetParent); if (!f.length) return;
  const a = f[0], z = f[f.length - 1], c = document.activeElement;
  if (!m.contains(c)) { e.preventDefault(); a.focus(); } else if (e.shiftKey && c === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && c === z) { e.preventDefault(); a.focus(); }
});
if (mqDark.addEventListener) mqDark.addEventListener('change', paintTheme);
paintTheme();
$('#bUndo').innerHTML = svg('undo'); $('#bRedo').innerHTML = svg('redo');
$('#bZoomIn').innerHTML = svg('plus'); $('#bZoomOut').innerHTML = svg('minus'); $('#bFit').innerHTML = svg('fit');
$('#bPagesPanel').innerHTML = svg('pages'); $('#bInspPanel').innerHTML = svg('sliders'); $('#bInspClose').innerHTML = svg('close');
async function loadSample() {
  busy('Loading sample form…');
  try {
    const bytes = await makeSample();
    S.sources = []; tcCache.clear(); thumbCache.clear(); S.formVals = {}; S.undo = []; S.redo = []; S.selPages.clear(); S.sel = null; S.editing = null;
    S.docName = 'sample-form'; S.isSample = true;
    S.pages = await addPdfSource(bytes, 'sample-form.pdf'); S.cur = 0;
    fitZoom(); setTool('select'); rebuild();
  } catch (e) { console.error(e); toast('Could not load the sample: ' + e.message, 'err'); }
  finally { busy(null); }
}
/* autosave to IndexedDB */
const DB = {
  open: () => new Promise((res, rej) => { const r = indexedDB.open('pagewright', 1); r.onupgradeneeded = () => r.result.createObjectStore('s'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }),
  async get() { const db = await DB.open(); return new Promise(res => { const q = db.transaction('s').objectStore('s').get('last'); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); }); },
  async put(v) { const db = await DB.open(); return new Promise(res => { const t = db.transaction('s', 'readwrite'); if (v == null) t.objectStore('s').delete('last'); else t.objectStore('s').put(v, 'last'); t.oncomplete = () => res(true); t.onerror = () => res(false); }); }
};
var lastSession = null, savedKey = '';
async function autosave() {
  try {
    if (!S.pages.length) { if (savedKey) { savedKey = ''; await DB.put(null); } return; }
    if (!S.undo.length && !Object.keys(S.formVals).length) return;
    const sn = snap(), key = sn + '|' + S.docName + '|' + S.sources.length; if (key === savedKey) return; savedKey = key;
    await DB.put({ t: Date.now(), docName: S.docName, isSample: S.isSample, pages: JSON.parse(sn).pages, formVals: S.formVals, sources: S.sources.map(x => ({ name: x.name, bytes: x.bytes })), imgs: Object.fromEntries(Object.entries(S.imgs).map(([k, v]) => [k, { bytes: v.bytes, type: v.type, w: v.w, h: v.h }])) });
  } catch (e) { console.warn('autosave failed', e); }
}
setInterval(autosave, 4000);
async function restoreSession() {
  const r = lastSession; if (!r) return; busy('Restoring your last session…');
  try {
    S.sources = []; tcCache.clear(); thumbCache.clear();
    for (const x of r.sources) { const pdf = await pdfjsLib.getDocument({ data: x.bytes.slice(0), isEvalSupported: false }).promise; S.sources.push({ name: x.name, bytes: x.bytes, pdf }); }
    for (const [k, v] of Object.entries(r.imgs || {})) S.imgs[k] = { ...v, url: URL.createObjectURL(new Blob([v.bytes], { type: v.type === 'png' ? 'image/png' : 'image/jpeg' })) };
    S.pages = r.pages; S.formVals = r.formVals || {}; S.docName = r.docName; S.isSample = !!r.isSample; S.undo = []; S.redo = []; S.sel = null; S.editing = null; S.cur = 0;
    fitZoom(); setTool('select'); rebuild();
  } catch (e) { console.error(e); toast('Could not restore the last session.', 'err'); }
  finally { busy(null); }
}
async function boot() {
  try { await loadSavedSigs(); } catch (e) { console.error(e); }
  try { lastSession = await DB.get(); } catch (e) { lastSession = null; }
  S.isSample = false; S.docName = ''; setTool('select'); rebuild();
}
/* find, copy/paste */
var fm = [], fk = 0, fTimer = null, clip = null;
const fb = $('#findBar'), fi = $('#findIn');
function paintFind() {
  $$('.fhit').forEach(n => n.remove());
  fm.forEach((m, i) => { const E = pageEls.get(S.pages[m.pi] && S.pages[m.pi].id); if (!E) return; const z = S.zoom, d = el('div', 'fhit' + (i === fk ? ' cur' : '')); d.style.cssText = `left:${m.x * z}px;top:${m.y * z}px;width:${m.w * z}px;height:${m.h * z}px`; E.inner.append(d); });
  $('#findCt').textContent = fm.length ? `${fk + 1} / ${fm.length}` : (fi.value.trim().length > 1 ? 'No matches' : '');
}
function showHit(i) {
  if (!fm.length) { paintFind(); return; }
  fk = (i + fm.length) % fm.length; S.cur = fm[fk].pi; paintFind(); updatePageNo();
  const h = stage.querySelector('.fhit.cur'); if (h) h.scrollIntoView({ block: 'center', behavior: 'smooth' });
}
async function runFind() {
  const q = fi.value.trim().toLowerCase(); fm = []; fk = 0;
  if (q.length < 2) { paintFind(); return; }
  for (let pi = 0; pi < S.pages.length; pi++) {
    const p = S.pages[pi], items = textItems(p, await getText(p));
    for (const it of items) { const s = it.str.toLowerCase(), cw = it.w / Math.max(1, it.str.length); let k = s.indexOf(q); while (k >= 0) { fm.push({ pi, x: it.x + cw * k, y: it.base - it.size * .85, w: Math.max(cw * q.length, 4), h: it.size * 1.05 }); k = s.indexOf(q, k + q.length); } }
  }
  showHit(0);
}
function closeFind() { fb.hidden = true; fm = []; paintFind(); }
fi.oninput = () => { clearTimeout(fTimer); fTimer = setTimeout(runFind, 200); };
fi.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); showHit(fk + (e.shiftKey ? -1 : 1)); } else if (e.key === 'Escape') closeFind(); };
$('#findNext').onclick = () => showHit(fk + 1); $('#findPrev').onclick = () => showHit(fk - 1); $('#findX').onclick = closeFind;
document.addEventListener('keydown', e => {
  const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
  if (mod && k === 'f' && S.pages.length) { e.preventDefault(); fb.hidden = false; fi.focus(); fi.select(); return; }
  const t = e.target; if (!mod || (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)))) return;
  const g = getSel();
  if (k === 'c' && g && !/^(draw|field)$/.test(g.a.type)) { clip = JSON.stringify(g.a); toast('Copied. Paste with Ctrl+V.'); e.preventDefault(); }
  else if (k === 'v' && clip && S.pages.length) { e.preventDefault(); const p = g ? g.p : S.pages[S.cur], a = JSON.parse(clip); delete a.id; a.x += 14; a.y += 14; clip = JSON.stringify(a); checkpoint(); addAnnot(p, a); }
});
$$('.ib').forEach(b => { if (!b.getAttribute('aria-label') && b.title) b.setAttribute('aria-label', b.title); });
let rzT; window.addEventListener('resize', () => { clearTimeout(rzT); rzT = setTimeout(() => { if (window.innerWidth > 960) closeDrawers(); }, 150); });
boot();
})();
