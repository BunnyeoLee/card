import { CONFIG } from './config.js';
import { store, LOGIN_RE, cardUrl } from './store.js';
import { SAMPLE_CARD, mountCard, esc } from './render.js';
import { $, $$, toast, renderHeader, confirmDialog, shareDialog, fmtDate } from './ui.js';

$('#kicker').textContent = CONFIG.programName;
mountCard($('#heroFront'), SAMPLE_CARD, 'front');
mountCard($('#heroBack'), { ...SAMPLE_CARD, template: 'split', color: '#1b2a5c' }, 'back');

let user = null;

store.onAuth((u) => {
  user = u;
  renderHeader(u);
  renderAuthBox();
  if (u) loadMine(); else $('#mine').hidden = true;
});

function renderAuthBox() {
  const box = $('#authBox');
  if (user) {
    box.innerHTML = `<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
      <a class="btn primary lg" href="edit.html">＋ 미래 명함 만들기</a>
      <a class="btn lg" href="#mine">내 명함 보기</a>
      ${user.isAdmin ? '<a class="btn lg" href="admin.html">전체 명함 관리</a>' : ''}</div>`;
    return;
  }
  box.innerHTML = `<div class="panel auth" id="login">
    <div class="tabs" role="tablist">
      <button type="button" class="on" data-tab="in" role="tab">로그인</button>
      <button type="button" data-tab="up" role="tab">처음이에요 (가입)</button>
    </div>
    <form id="authForm" novalidate>
      <label class="field" data-up hidden><span>이름 <span class="req">*</span></span>
        <input type="text" name="name" maxlength="20" autocomplete="name" placeholder="예) 김미래"></label>
      <label class="field"><span>아이디 <span class="req">*</span></span>
        <input type="text" name="loginId" maxlength="20" autocomplete="username" autocapitalize="off" spellcheck="false" placeholder="영문 소문자·숫자 3~20자 (예: 30215kim)">
        <small data-up hidden>선생님이 정해 주신 규칙(예: 학번+이름)이 있으면 그대로 써 주세요.</small></label>
      <label class="field"><span>비밀번호 <span class="req">*</span></span>
        <input type="password" name="pw" autocomplete="current-password" placeholder="6자 이상"></label>
      <label class="field" data-up hidden><span>비밀번호 확인 <span class="req">*</span></span>
        <input type="password" name="pw2" autocomplete="new-password"></label>
      <div class="err-msg" id="authErr" role="alert"></div>
      <button class="btn primary block lg" id="authSubmit">로그인</button>
    </form>
    <p class="hint" style="margin:14px 0 0;text-align:center">선생님이신가요? <a href="admin.html">관리자 로그인 →</a></p>
  </div>`;
  let mode = 'in';
  const form = $('#authForm');
  $$('[data-tab]').forEach((b) => b.onclick = () => {
    mode = b.dataset.tab;
    $$('[data-tab]').forEach((x) => x.classList.toggle('on', x === b));
    $$('[data-up]', form).forEach((el) => (el.hidden = mode !== 'up'));
    $('#authSubmit').textContent = mode === 'up' ? '가입하고 시작하기' : '로그인';
    form.pw.autocomplete = mode === 'up' ? 'new-password' : 'current-password';
    $('#authErr').textContent = '';
  });
  form.onsubmit = async (e) => {
    e.preventDefault();
    const err = $('#authErr');
    const loginId = form.loginId.value.trim().toLowerCase();
    const pw = form.pw.value;
    err.textContent = '';
    if (!LOGIN_RE.test(loginId)) return (err.textContent = '아이디는 영문 소문자와 숫자로 3~20자로 정해 주세요. (한글·대문자·띄어쓰기는 안 돼요)');
    if (pw.length < 6) return (err.textContent = '비밀번호는 6자 이상이에요.');
    const btn = $('#authSubmit');
    btn.disabled = true;
    try {
      if (mode === 'up') {
        const name = form.name.value.trim();
        if (!name) { err.textContent = '이름을 입력해 주세요.'; return; }
        if (pw !== form.pw2.value) { err.textContent = '비밀번호 확인이 달라요.'; return; }
        await store.signUp(loginId, pw, name);
        toast(`${name}님, 환영해요!`);
      } else {
        await store.signIn(loginId, pw);
        toast('로그인했어요.');
      }
    } catch (ex) { err.textContent = ex.message; }
    finally { btn.disabled = false; }
  };
}

async function loadMine() {
  const sec = $('#mine'), grid = $('#mineGrid');
  sec.hidden = false;
  grid.innerHTML = '<div class="empty">불러오는 중…</div>';
  try {
    const cards = await store.listMine(user);
    $('#mineCount').textContent = cards.length ? `${cards.length}장` : '';
    if (!cards.length) {
      grid.innerHTML = `<div class="panel empty" style="grid-column:1/-1"><div class="big">🪪</div>
        <p>아직 만든 명함이 없어요.<br>나의 10년 뒤를 상상하며 첫 명함을 만들어 볼까요?</p>
        <a class="btn primary" href="edit.html">＋ 미래 명함 만들기</a></div>`;
      return;
    }
    grid.innerHTML = '';
    cards.forEach((c) => grid.appendChild(cardItem(c)));
    if (location.hash === '#mine') sec.scrollIntoView({ behavior: 'smooth' });
  } catch (e) { grid.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}

function cardItem(c) {
  const el = document.createElement('article');
  el.className = 'panel c-item';
  el.innerHTML = `
    <a class="bc-frame" href="${esc(cardUrl(c.id))}" target="_blank" rel="noopener" aria-label="${esc(c.name)} 명함 열기"></a>
    <div class="meta"><span class="t">${esc(c.name || '(이름 없음)')}</span><span class="s">${esc(c.title)}</span>
      <span class="pill ${c.visibility}">${c.visibility === 'public' ? '공개' : '비공개'}</span></div>
    <div class="s hint">수정: ${fmtDate(c.updatedAt)}</div>
    <div class="acts">
      <label class="switch" title="다른 사람이 볼 수 있게 할까요?"><input type="checkbox" ${c.visibility === 'public' ? 'checked' : ''}><span class="track"></span><span class="lbl">${c.visibility === 'public' ? '공개' : '비공개'}</span></label>
      <button class="btn sm" data-a="share">NFC·QR</button>
      <a class="btn sm" href="edit.html?id=${encodeURIComponent(c.id)}">수정</a>
      <button class="btn sm danger" data-a="del">삭제</button>
    </div>`;
  mountCard($('.bc-frame', el), c, 'front');
  $('[data-a=share]', el).onclick = () => shareDialog(c);
  $('[data-a=del]', el).onclick = async () => {
    if (!await confirmDialog('명함을 삭제할까요?', `'${c.name}' 명함을 지우면 되돌릴 수 없고, NFC 태그로 열어도 보이지 않아요.`, '삭제', true)) return;
    try { await store.deleteCard(c.id); toast('삭제했어요.'); el.remove(); loadMine(); } catch (e) { toast(e.message, true); }
  };
  const sw = $('.switch input', el);
  sw.onchange = async () => {
    const v = sw.checked ? 'public' : 'private';
    try {
      await store.setVisibility(c.id, v);
      c.visibility = v;
      $('.lbl', el).textContent = $('.pill', el).textContent = v === 'public' ? '공개' : '비공개';
      $('.pill', el).className = `pill ${v}`;
      toast(v === 'public' ? '이제 누구나 볼 수 있어요.' : '이제 나와 선생님만 볼 수 있어요.');
    } catch (e) { sw.checked = !sw.checked; toast(e.message, true); }
  };
  return el;
}
