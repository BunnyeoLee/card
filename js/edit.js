import { store, validId } from './store.js';
import { EMPTY_CARD, SAMPLE_CARD, PALETTE, LIMITS, sanitizeCard, mountCard, exportPNG, processImage, esc } from './render.js';
import { $, $$, toast, renderHeader, confirmDialog, shareDialog } from './ui.js';

const form = $('#form');
const params = new URLSearchParams(location.search);
let editId = validId(params.get('id')) ? params.get('id') : null;
let state = structuredClone(EMPTY_CARD);
let loadedCard = null;
let user = null;
let started = false;
const DRAFT_KEY = 'fc_draft';


/* ---------- 시작: 새 명함 / 기존 명함 불러오기 ---------- */
async function start() {
  buildSwatches();
  if (editId) {
    try {
      loadedCard = await store.getCard(editId);
      if (!(user.isAdmin || loadedCard.owner === user.uid)) throw new Error('내 명함만 고칠 수 있어요.');
      state = sanitizeCard(loadedCard);
      document.title = `${state.name || '명함'} 수정 · 미래 명함`;
      if (user.isAdmin && loadedCard.owner !== user.uid) {
        $('#editWho').hidden = false;
        $('#editWho').textContent = `관리자 권한으로 ${loadedCard.ownerName || ''}(${loadedCard.ownerId || '?'}) 학생의 명함을 수정하고 있어요.`;
      }
    } catch (e) {
      toast(e.message, true);
      editId = null;
      history.replaceState(null, '', 'edit.html');
    }
  } else {
    try { const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); if (d) state = sanitizeCard(d); } catch {}
  }
  fillForm();
  updateMode();
  render();
}

function updateMode() {
  $('#btnSave').textContent = editId ? '변경 내용 저장' : '등록하기';
  $('#btnShare').hidden = $('#btnDelete').hidden = !editId;
  $('#btnReset').hidden = !!editId;
}

/* ---------- 폼 <-> 데이터 ---------- */
function buildSwatches() {
  const box = $('#swatches');
  box.innerHTML = PALETTE.map(([c, n]) => `<button type="button" class="swatch" data-c="${c}" style="background:${c}" title="${n}" aria-label="${n}"></button>`).join('')
    + '<input type="color" id="customColor" title="직접 고르기" aria-label="색상 직접 고르기">';
  box.addEventListener('click', (e) => { const b = e.target.closest('.swatch'); if (b) { state.color = b.dataset.c; syncSwatch(); render(); } });
  $('#customColor').addEventListener('input', (e) => { state.color = e.target.value; syncSwatch(); render(); });
}
function syncSwatch() {
  $$('.swatch').forEach((b) => b.classList.toggle('on', b.dataset.c.toLowerCase() === state.color.toLowerCase()));
  $('#customColor').value = state.color;
}

function fillForm() {
  for (const k of Object.keys(LIMITS)) if (form.elements[k]) form.elements[k].value = state[k] || '';
  $$('input[name=bullet]', form).forEach((el, i) => (el.value = state.bullets[i] || ''));
  for (const k of ['template', 'quoteType', 'visibility']) {
    const r = form.querySelector(`input[name=${k}][value="${state[k]}"]`); if (r) r.checked = true;
  }
  syncSwatch();
  syncThumbs();
}

function readForm() {
  for (const k of Object.keys(LIMITS)) if (form.elements[k]) state[k] = form.elements[k].value;
  state.bullets = $$('input[name=bullet]', form).map((el) => el.value);
  for (const k of ['template', 'quoteType', 'visibility']) state[k] = form.querySelector(`input[name=${k}]:checked`)?.value || state[k];
}

let draftT;
function render() {
  mountCard($('#pvFront'), state, 'front', { ph: true });
  mountCard($('#pvBack'), state, 'back', { ph: true });
  $('#qCount').textContent = `${(state.quote || '').length}/120`;
  if (!editId) {
    clearTimeout(draftT);
    draftT = setTimeout(() => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(state)); } catch {} }, 400);
  }
}

form.addEventListener('input', (e) => { if (e.target.type !== 'file' && e.target.type !== 'color') { readForm(); render(); } });
form.addEventListener('change', (e) => { if (e.target.type === 'radio') { readForm(); render(); } });

/* ---------- 이미지 ---------- */
function syncThumbs() {
  for (const k of ['logo', 'photo']) {
    const t = $(`#${k}Thumb`);
    t.style.backgroundImage = state[k] ? `url('${state[k]}')` : '';
    t.textContent = state[k] ? '' : (k === 'logo' ? '🏢' : '🙂');
    $(`#${k}Del`).hidden = !state[k];
  }
}
for (const k of ['logo', 'photo']) {
  $(`#${k}File`).addEventListener('change', async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try { state[k] = await processImage(f, k); syncThumbs(); render(); toast(k === 'logo' ? '로고를 넣었어요.' : '사진을 넣었어요.'); }
    catch (err) { toast(err.message || '이미지를 읽지 못했어요.', true); }
  });
  $(`#${k}Del`).addEventListener('click', () => { state[k] = ''; syncThumbs(); render(); });
}

/* ---------- 버튼 ---------- */
$('#btnSample').onclick = () => {
  const keep = { logo: state.logo, photo: state.photo, visibility: state.visibility };
  state = { ...structuredClone(SAMPLE_CARD), ...keep };
  fillForm(); render();
};
$('#btnReset').onclick = async () => {
  if (!await confirmDialog('처음부터 다시 쓸까요?', '입력한 내용과 올린 이미지가 모두 지워져요.', '비우기', true)) return;
  state = structuredClone(EMPTY_CARD); fillForm(); render();
};
$('#pngFront').onclick = () => savePng('front');
$('#pngBack').onclick = () => savePng('back');
async function savePng(side) {
  try { await exportPNG(state, side, `미래명함_${state.name || 'card'}_${side === 'front' ? '앞면' : '뒷면'}.png`); }
  catch (e) { toast(e.message, true); }
}
$('#btnShare').onclick = () => shareDialog({ ...state, id: editId });
$('#btnDelete').onclick = async () => {
  if (!await confirmDialog('명함을 삭제할까요?', '삭제하면 되돌릴 수 없고, NFC 태그로 열어도 보이지 않아요.', '삭제', true)) return;
  try { await store.deleteCard(editId); toast('삭제했어요.'); setTimeout(() => (location.href = (user.isAdmin && loadedCard?.owner !== user.uid) ? 'admin.html' : './#mine'), 600); }
  catch (e) { toast(e.message, true); }
};

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  readForm();
  const err = $('#formErr');
  err.textContent = '';
  const missing = [['company', '회사 이름'], ['name', '이름'], ['title', '직업·직함']].filter(([k]) => !state[k].trim());
  if (missing.length) {
    err.textContent = `${missing.map((m) => m[1]).join(', ')}을(를) 입력해 주세요.`;
    form.elements[missing[0][0]].focus();
    return;
  }
  const btn = $('#btnSave');
  btn.disabled = true;
  try {
    const isNew = !editId;
    editId = await store.saveCard(user, editId, state);
    if (isNew) {
      try { localStorage.removeItem(DRAFT_KEY); } catch {}
      history.replaceState(null, '', `edit.html?id=${encodeURIComponent(editId)}`);
      updateMode();
      shareDialog({ ...state, id: editId }, { title: '명함이 등록되었어요! 🎉', sub: '이 주소를 NFC 태그에 쓰면 휴대폰을 댔을 때 명함이 열려요. 언제든 다시 고칠 수 있고, 고쳐도 주소는 그대로예요.' });
    } else {
      toast('저장했어요. NFC 태그는 다시 쓰지 않아도 돼요.');
    }
  } catch (ex) {
    err.textContent = ex.message;
  } finally { btn.disabled = false; }
});

// 로그인 상태가 정해지면 편집기를 시작합니다(파일 맨 끝에 두어야 위 변수들이 준비된 뒤 실행돼요)
store.onAuth(async (u) => {
  user = u;
  renderHeader(u);
  $('#gate').hidden = !!u;
  $('#editor').hidden = !u;
  $('#fab').hidden = !u;
  if (u && !started) { started = true; await start(); }
});
