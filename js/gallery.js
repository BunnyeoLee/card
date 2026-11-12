// 갤러리2: 이미지(AI 이미지·사진·로고) 올리기 → 골라서 5 × 4.5cm 격자로 인쇄
import { store, IMG_MAX } from './store.js';
import { esc } from './render.js';
import { $, $$, toast, renderHeader, confirmDialog, fmtDate } from './ui.js';

/* 인쇄 크기(mm) — 필요하면 여기 숫자만 바꾸세요 */
const CELL_W = 50, CELL_H = 45;
const PAGE_W = 210, PAGE_H = 297, PAGE_MIN_MARGIN = 8; // A4 세로, 가장자리 최소 여백

let user = null;
let images = [];
const selected = new Set();
const opts = { fit: 'cover', copies: 1, gap: 2, cut: true };

store.onAuth((u) => {
  user = u;
  renderHeader(u);
  $('#gate').hidden = !!u;
  $('#gal').hidden = !u;
  $('#adminFilters').hidden = !u?.isAdmin;
  if (u) load();
});

/* ---------- 목록 ---------- */
async function load() {
  const grid = $('#grid');
  grid.innerHTML = '<div class="empty">불러오는 중…</div>';
  try {
    images = await store.listImages(user);
    for (const id of [...selected]) if (!images.some((x) => x.id === id)) selected.delete(id);
    renderGrid();
  } catch (e) { grid.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}

function visible() {
  const q = ($('#q').value || '').trim().toLowerCase();
  if (!q) return images;
  return images.filter((x) => [x.title, x.ownerName, x.ownerId].some((s) => (s || '').toLowerCase().includes(q)));
}

function renderGrid() {
  const grid = $('#grid');
  const list = visible();
  if (!images.length) {
    grid.innerHTML = `<div class="panel empty" style="grid-column:1/-1"><div class="big">🖼️</div>
      <p>아직 올린 이미지가 없어요.<br>위의 <b>이미지 올리기</b>로 AI 이미지, 사진, 로고를 올려 보세요.</p></div>`;
  } else if (!list.length) {
    grid.innerHTML = '<div class="empty" style="grid-column:1/-1">검색 결과가 없어요.</div>';
  } else {
    grid.innerHTML = list.map((x) => `
      <article class="g-item${selected.has(x.id) ? ' on' : ''}" data-id="${esc(x.id)}">
        <button type="button" class="g-pick" aria-pressed="${selected.has(x.id)}" aria-label="${esc(x.title || '이미지')} 선택">
          <span class="g-img"><img src="${x.data}" alt="${esc(x.title)}" loading="lazy"></span>
          <span class="g-chk" aria-hidden="true">✓</span>
        </button>
        <div class="g-meta">
          <span class="g-t" title="${esc(x.title)}">${esc(x.title || '(제목 없음)')}</span>
          <button type="button" class="g-x" data-del title="삭제" aria-label="${esc(x.title)} 삭제">🗑</button>
          <span class="g-s">${user.isAdmin ? `${esc(x.ownerName)} · ${esc(x.ownerId)} · ` : ''}${esc(fmtDate(x.createdAt))}${x.w ? ` · ${x.w}×${x.h}` : ''}</span>
        </div>
      </article>`).join('');
  }
  syncBar();
}

function syncBar() {
  const list = visible();
  const n = selected.size;
  $('#selN').textContent = `${n}개 선택`;
  $('#btnPrint').disabled = $('#btnDel').disabled = !n;
  const all = $('#chkAll');
  const onCount = list.filter((x) => selected.has(x.id)).length;
  all.checked = !!list.length && onCount === list.length;
  all.indeterminate = onCount > 0 && onCount < list.length;
  all.disabled = !list.length;
}

$('#grid').addEventListener('click', async (e) => {
  const item = e.target.closest('.g-item');
  if (!item) return;
  const id = item.dataset.id;
  if (e.target.closest('[data-del]')) {
    const x = images.find((i) => i.id === id);
    if (!(await confirmDialog('이미지를 삭제할까요?', `"${x?.title || '이미지'}"을(를) 지우면 되돌릴 수 없어요.`, '삭제', true))) return;
    try { await store.deleteImage(id); selected.delete(id); images = images.filter((i) => i.id !== id); renderGrid(); toast('삭제했어요.'); }
    catch (ex) { toast(ex.message, true); }
    return;
  }
  if (e.target.closest('.g-pick')) {
    selected.has(id) ? selected.delete(id) : selected.add(id);
    const on = selected.has(id);
    item.classList.toggle('on', on);
    $('.g-pick', item).setAttribute('aria-pressed', on);
    syncBar();
  }
});

$('#chkAll').addEventListener('change', (e) => {
  visible().forEach((x) => (e.target.checked ? selected.add(x.id) : selected.delete(x.id)));
  renderGrid();
});
$('#q').addEventListener('input', renderGrid);

$('#btnDel').onclick = async () => {
  const ids = [...selected];
  if (!(await confirmDialog(`선택한 ${ids.length}개를 삭제할까요?`, '지운 이미지는 되돌릴 수 없어요.', '모두 삭제', true))) return;
  let fail = 0;
  for (const id of ids) {
    try { await store.deleteImage(id); selected.delete(id); } catch { fail++; }
  }
  toast(fail ? `${fail}개는 지우지 못했어요.` : '삭제했어요.', !!fail);
  load();
};

/* ---------- 올리기 ---------- */
$('#file').addEventListener('change', (e) => { upload([...e.target.files]); e.target.value = ''; });
const drop = $('#drop');
['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, () => drop.classList.remove('over')));
drop.addEventListener('drop', (e) => { e.preventDefault(); upload([...(e.dataTransfer?.files || [])]); });

let busy = false;
async function upload(files) {
  files = files.filter((f) => f.type.startsWith('image/'));
  if (!files.length) return toast('이미지 파일만 올릴 수 있어요.', true);
  if (busy) return toast('올리는 중이에요. 잠시만 기다려 주세요.');
  busy = true;
  const st = $('#upSt');
  let ok = 0, lastErr = '';
  for (let i = 0; i < files.length; i++) {
    st.textContent = `올리는 중… ${i + 1} / ${files.length}`;
    try {
      const img = await prepareImage(files[i]);
      const id = await store.addImage(user, img);
      selected.add(id);
      ok++;
    } catch (e) { lastErr = e.message; }
  }
  st.textContent = '';
  busy = false;
  if (ok) toast(`${ok}개를 올렸어요.${ok < files.length ? ` (${files.length - ok}개 실패: ${lastErr})` : ''}`, ok < files.length);
  else toast('올리지 못했어요: ' + lastErr, true);
  load();
}

/** 인쇄용으로 이미지 줄이기: 긴 변 최대 1200px(5cm 인쇄 시 약 600dpi), 투명 배경 있으면 PNG 유지 */
async function prepareImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    try { await img.decode(); } catch { throw new Error('이미지를 열 수 없어요. (HEIC 사진은 JPG로 바꿔 올려 주세요)'); }
    const c = document.createElement('canvas');
    const g = c.getContext('2d');
    const draw = (max, white) => {
      const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      c.width = Math.max(1, Math.round(img.naturalWidth * s));
      c.height = Math.max(1, Math.round(img.naturalHeight * s));
      g.clearRect(0, 0, c.width, c.height);
      if (white) { g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); }
      g.drawImage(img, 0, 0, c.width, c.height);
    };
    let max = 1200;
    draw(max, false);
    const alpha = file.type !== 'image/jpeg' && hasAlpha(g, c.width, c.height);
    let data = '';
    for (let i = 0; i < 6; i++) {
      if (i) draw(max, !alpha);
      else if (!alpha) draw(max, true);
      data = alpha ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.9);
      if (alpha && data.length > IMG_MAX) {
        const w = c.toDataURL('image/webp', 0.92);
        if (w.startsWith('data:image/webp') && w.length <= IMG_MAX) data = w;
      }
      if (data.length <= IMG_MAX * 0.9) break;
      max = Math.round(max * 0.8);
    }
    if (data.length > IMG_MAX) throw new Error('이미지가 너무 커요.');
    return { title: file.name.replace(/\.[^.]+$/, '').slice(0, 40), data, w: c.width, h: c.height };
  } finally { URL.revokeObjectURL(url); }
}
function hasAlpha(g, w, h) {
  const d = g.getImageData(0, 0, w, h).data;
  for (let i = 3; i < d.length; i += 4) if (d[i] < 250) return true;
  return false;
}

/* ---------- 인쇄 ---------- */
function layout() {
  const gap = opts.gap;
  const cols = Math.max(1, Math.floor((PAGE_W - 2 * PAGE_MIN_MARGIN + gap) / (CELL_W + gap)));
  const rows = Math.max(1, Math.floor((PAGE_H - 2 * PAGE_MIN_MARGIN + gap) / (CELL_H + gap)));
  const gridW = cols * CELL_W + (cols - 1) * gap;
  const gridH = rows * CELL_H + (rows - 1) * gap;
  return { cols, rows, per: cols * rows, padX: (PAGE_W - gridW) / 2, padY: (PAGE_H - gridH) / 2 };
}

function printItems() {
  const list = images.filter((x) => selected.has(x.id));
  const out = [];
  list.forEach((x) => { for (let i = 0; i < opts.copies; i++) out.push(x); });
  return out;
}

function sheetsHTML() {
  const L = layout();
  const items = printItems();
  const pages = [];
  for (let i = 0; i < items.length; i += L.per) pages.push(items.slice(i, i + L.per));
  const style = `--cw:${CELL_W}mm;--ch:${CELL_H}mm;--gap:${opts.gap}mm;--cols:${L.cols};--px:${L.padX}mm;--py:${L.padY}mm;--pw:${PAGE_W}mm;--ph:${PAGE_H}mm`;
  return {
    L, count: items.length, pages: pages.length,
    html: pages.map((p) => `<div class="sheet fit-${opts.fit}${opts.cut ? ' cut' : ''}" style="${style}">${
      p.map((x) => `<div class="cell"><img src="${x.data}" alt=""></div>`).join('')}</div>`).join(''),
  };
}

$('#btnPrint').onclick = () => {
  const d = document.createElement('dialog');
  d.className = 'print-dlg';
  d.innerHTML = `<div class="dlg">
    <h2>인쇄 미리보기</h2>
    <p>선택한 이미지를 <b>가로 ${CELL_W / 10}cm × 세로 ${CELL_H / 10}cm</b> 크기로 A4 용지에 격자로 배치해요.</p>
    <div class="p-wrap">
      <div class="p-opts">
        <div class="field"><span>이미지 맞춤</span>
          <div class="seg2">
            <label><input type="radio" name="fit" value="cover"><span>꽉 채우기<small>칸에 맞게 가장자리 잘림</small></span></label>
            <label><input type="radio" name="fit" value="contain"><span>전체 보이기<small>잘리지 않고 여백 생김</small></span></label>
          </div></div>
        <label class="field"><span>이미지마다 인쇄할 개수</span>
          <input type="number" name="copies" min="1" max="60" inputmode="numeric"></label>
        <label class="field"><span>칸 사이 간격</span>
          <select name="gap"><option value="0">0mm (붙여서)</option><option value="2">2mm</option><option value="4">4mm</option></select></label>
        <label class="switch"><input type="checkbox" name="cut"><span class="track"></span>자르는 선 표시</label>
        <div class="p-sum" data-sum></div>
        <div class="notice">인쇄 창에서 <b>배율 100%(실제 크기)</b>, 용지 <b>A4</b>로 설정해야 정확히 ${CELL_W / 10}×${CELL_H / 10}cm로 나와요. ‘페이지에 맞춤’은 꺼 주세요.</div>
      </div>
      <div class="p-prev" data-prev></div>
    </div>
    <div class="dlg-actions">
      <button class="btn" type="button" data-close>닫기</button>
      <button class="btn primary" type="button" data-go>🖨️ 인쇄하기</button>
    </div></div>`;
  document.body.appendChild(d);
  d.querySelector(`input[name=fit][value=${opts.fit}]`).checked = true;
  d.querySelector('[name=copies]').value = opts.copies;
  d.querySelector('[name=gap]').value = String(opts.gap);
  d.querySelector('[name=cut]').checked = opts.cut;

  const refresh = () => {
    opts.fit = d.querySelector('input[name=fit]:checked').value;
    opts.copies = Math.min(60, Math.max(1, parseInt(d.querySelector('[name=copies]').value, 10) || 1));
    opts.gap = +d.querySelector('[name=gap]').value;
    opts.cut = d.querySelector('[name=cut]').checked;
    const s = sheetsHTML();
    $('[data-prev]', d).innerHTML = s.html;
    $('[data-sum]', d).innerHTML = `총 <b>${s.count}개</b> · A4 <b>${s.pages}장</b><br><small>한 장에 ${s.L.cols}열 × ${s.L.rows}줄 = 최대 ${s.L.per}개</small>`;
    return s;
  };
  d.addEventListener('input', refresh);
  d.addEventListener('change', refresh);
  refresh();

  d.addEventListener('close', () => { d.remove(); $('#printRoot').innerHTML = ''; });
  d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
  $('[data-close]', d).onclick = () => d.close();
  $('[data-go]', d).onclick = async () => {
    const root = $('#printRoot');
    root.innerHTML = refresh().html;
    await Promise.all($$('img', root).map((im) => im.decode().catch(() => {})));
    window.print();
  };
  d.showModal();
};
