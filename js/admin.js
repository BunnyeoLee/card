import { MODE, store, cardUrl } from './store.js';
import { mountCard, esc } from './render.js';
import { $, toast, renderHeader, confirmDialog, shareDialog, fmtDate } from './ui.js';

let user = null;
let cards = [];

if (MODE === 'demo') $('#btnAdminLogin').textContent = '체험용 관리자로 들어가기';

store.onAuth((u) => {
  user = u;
  renderHeader(u);
  const ok = !!u?.isAdmin;
  $('#gate').hidden = ok;
  $('#adminApp').hidden = !ok;
  if (u && !ok) $('#gateMsg').textContent = `지금은 학생 계정(${u.loginId})으로 로그인되어 있어요. 관리자 Google 계정으로 다시 로그인해 주세요.`;
  if (ok) load();
});

$('#btnAdminLogin').onclick = async () => {
  $('#gateErr').textContent = '';
  try { await store.signInAdmin(); toast('관리자로 로그인했어요.'); }
  catch (e) { $('#gateErr').textContent = e.message; }
};
$('#btnReload').onclick = () => load();
['q', 'fVis', 'fSort'].forEach((k) => $('#' + k).addEventListener('input', draw));

async function load() {
  $('#grid').innerHTML = '<div class="empty" style="grid-column:1/-1">불러오는 중…</div>';
  try { cards = await store.listAll(); draw(); }
  catch (e) { $('#grid').innerHTML = `<div class="empty" style="grid-column:1/-1">${esc(e.message)}</div>`; }
}

function draw() {
  const pub = cards.filter((c) => c.visibility === 'public').length;
  $('#stAll').textContent = cards.length;
  $('#stPub').textContent = pub;
  $('#stPri').textContent = cards.length - pub;
  const q = $('#q').value.trim().toLowerCase();
  const vis = $('#fVis').value;
  const sort = $('#fSort').value;
  let list = cards.filter((c) => (!vis || c.visibility === vis)
    && (!q || [c.name, c.ownerId, c.ownerName, c.company, c.title].join(' ').toLowerCase().includes(q)));
  list = list.sort(sort === 'name' ? (a, b) => a.name.localeCompare(b.name, 'ko')
    : sort === 'owner' ? (a, b) => (a.ownerId || '').localeCompare(b.ownerId || '')
    : (a, b) => b.updatedAt - a.updatedAt);
  $('#shown').textContent = `${list.length}장 표시`;
  const grid = $('#grid');
  grid.innerHTML = list.length ? '' : '<div class="empty" style="grid-column:1/-1"><div class="big">🗂️</div>조건에 맞는 명함이 없어요.</div>';
  list.forEach((c) => grid.appendChild(item(c)));
}

function item(c) {
  const el = document.createElement('article');
  el.className = 'panel c-item';
  const pubTxt = (v) => (v === 'public' ? '공개' : '비공개');
  el.innerHTML = `
    <a class="bc-frame" href="${esc(cardUrl(c.id))}" target="_blank" rel="noopener" aria-label="${esc(c.name)} 명함 열기"></a>
    <div class="meta"><span class="t">${esc(c.name || '(이름 없음)')}</span><span class="s">${esc(c.ownerName || '')} · ${esc(c.ownerId || '?')}</span>
      <span class="pill ${c.visibility}">${pubTxt(c.visibility)}</span></div>
    <div class="hint">${esc(c.title)} · 수정 ${fmtDate(c.updatedAt)} · ID ${esc(c.id)}</div>
    <div class="acts">
      <label class="switch"><input type="checkbox" ${c.visibility === 'public' ? 'checked' : ''}><span class="track"></span><span class="lbl">${pubTxt(c.visibility)}</span></label>
      <button class="btn sm" data-a="share">NFC·QR</button>
      <a class="btn sm" href="edit.html?id=${encodeURIComponent(c.id)}">수정</a>
      <button class="btn sm danger" data-a="del">삭제</button>
    </div>`;
  mountCard(el.querySelector('.bc-frame'), c, 'front');
  el.querySelector('[data-a=share]').onclick = () => shareDialog(c);
  el.querySelector('[data-a=del]').onclick = async () => {
    if (!await confirmDialog('명함을 삭제할까요?', `${c.ownerName || c.ownerId} 학생의 '${c.name}' 명함을 영구 삭제해요. 되돌릴 수 없어요.`, '삭제', true)) return;
    try { await store.deleteCard(c.id); cards = cards.filter((x) => x.id !== c.id); draw(); toast('삭제했어요.'); }
    catch (e) { toast(e.message, true); }
  };
  const sw = el.querySelector('.switch input');
  sw.onchange = async () => {
    const v = sw.checked ? 'public' : 'private';
    try { await store.setVisibility(c.id, v); c.visibility = v; draw(); toast(`${c.name} 명함을 ${pubTxt(v)}로 바꿨어요.`); }
    catch (e) { sw.checked = !sw.checked; toast(e.message, true); }
  };
  return el;
}

$('#btnCsv').onclick = () => {
  const q = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const rows = [['아이디', '학생 이름', '명함 이름', '직업', '회사', '공개', '명함 주소', '마지막 수정']]
    .concat(cards.map((c) => [c.ownerId, c.ownerName, c.name, c.title, c.company, c.visibility === 'public' ? '공개' : '비공개', cardUrl(c.id), c.updatedAt ? new Date(c.updatedAt).toLocaleString('ko-KR') : '']));
  const blob = new Blob(['﻿' + rows.map((r) => r.map(q).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `미래명함_명단_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
};
