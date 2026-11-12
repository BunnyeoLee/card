// 여러 페이지가 같이 쓰는 화면 도구: 상단 메뉴, 알림, 확인창, 공유(QR·NFC) 창
import { CONFIG } from './config.js';
import { MODE, store, cardUrl } from './store.js';
import { esc } from './render.js';

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];

let toastT;
export function toast(msg, isErr = false) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.textContent = msg;
  t.className = 'show' + (isErr ? ' err' : '');
  clearTimeout(toastT);
  toastT = setTimeout(() => (t.className = isErr ? 'err' : ''), isErr ? 4200 : 2400);
}

export const fmtDate = (ms) => (ms ? new Date(ms).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

/** 상단 메뉴. 로그인 상태가 바뀔 때마다 다시 그립니다. */
export function renderHeader(user) {
  const h = $('#header');
  if (!h) return;
  h.innerHTML = `
    ${MODE === 'demo' ? '<div class="demo-bar">체험 모드예요. 지금 만든 명함은 이 브라우저에만 저장됩니다. 실제 수업 전에는 README의 Firebase 연결을 완료해 주세요.</div>' : ''}
    <div class="top-in">
      <a class="brand" href="./"><span class="brand-mark">✦</span>${esc(CONFIG.siteTitle)}</a>
      <nav>
        ${user ? `
          ${user.isAdmin ? '<a class="admin-link" href="admin.html">관리자</a>' : ''}
          <a href="./#mine">내 명함</a>
          <a href="gallery.html"${/gallery\.html$/.test(location.pathname) ? ' class="on" aria-current="page"' : ''}>갤러리2</a>
          <span class="who" title="${esc(user.loginId)}">${esc(user.name)}님</span>
          <button type="button" id="btnLogout">로그아웃</button>`
        : `<a href="./#login">로그인</a>`}
      </nav>
    </div>`;
  $('#btnLogout', h)?.addEventListener('click', async () => {
    await store.signOut();
    toast('로그아웃했어요.');
    if (!/index\.html$|\/$/.test(location.pathname)) location.href = './';
  });
}

export function confirmDialog(title, message, okText = '확인', danger = false) {
  return new Promise((resolve) => {
    const d = document.createElement('dialog');
    d.innerHTML = `<form method="dialog" class="dlg"><h2>${esc(title)}</h2><p>${esc(message)}</p>
      <div class="dlg-actions"><button class="btn" value="no">취소</button>
      <button class="btn ${danger ? 'danger fill' : 'primary'}" value="ok">${esc(okText)}</button></div></form>`;
    document.body.appendChild(d);
    d.addEventListener('close', () => { resolve(d.returnValue === 'ok'); d.remove(); });
    d.showModal();
  });
}

/** 등록 후 / 목록에서 여는 공유 창: 주소, QR, NFC 쓰기 */
export function shareDialog(card, opts = {}) {
  const url = cardUrl(card.id);
  const d = document.createElement('dialog');
  const nfcOk = 'NDEFReader' in window;
  d.innerHTML = `<div class="dlg">
    <h2>${esc(opts.title || 'NFC 태그에 넣을 주소')}</h2>
    <p>${esc(opts.sub || '아래 주소를 NFC 태그에 쓰면, 휴대폰을 태그에 댔을 때 이 명함이 열려요.')}</p>
    <div class="share-url"><input type="text" readonly value="${esc(url)}" aria-label="명함 주소"><button class="btn" type="button" data-copy>복사</button></div>
    ${card.visibility === 'private' ? '<div class="warn">지금은 <b>비공개</b>예요. 태그를 읽어도 다른 사람에게는 명함이 보이지 않아요. 공개로 바꾸면 보여요.</div>' : ''}
    <div class="share-grid">
      <div class="qr-box" data-qr></div>
      <div class="nfc-box">
        ${nfcOk ? `<b>이 휴대폰으로 바로 쓰기</b>
          <button class="btn primary block" type="button" data-nfc>NFC 태그에 쓰기</button>
          <div class="nfc-status" data-st aria-live="polite"></div>`
        : `<b>NFC 태그에 쓰는 방법</b>
          <ol><li>안드로이드: 크롬으로 이 페이지를 열면 '바로 쓰기' 버튼이 생겨요.</li>
          <li>아이폰/기타: <b>NFC Tools</b> 앱 → 쓰기 → 기록 추가 → URL → 주소 붙여넣기 → 쓰기</li></ol>`}
        <div class="hint" style="margin-top:8px">QR코드를 찍어도 같은 명함이 열려요.</div>
      </div>
    </div>
    <div class="dlg-actions">
      <a class="btn" href="${esc(url)}" target="_blank" rel="noopener">명함 열어보기</a>
      <button class="btn primary" type="button" data-close>닫기</button>
    </div></div>`;
  document.body.appendChild(d);
  d.addEventListener('close', () => d.remove());
  d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
  $('[data-close]', d).onclick = () => d.close();
  $('[data-copy]', d).onclick = async () => {
    try { await navigator.clipboard.writeText(url); toast('주소를 복사했어요.'); }
    catch { $('input', d).select(); document.execCommand('copy'); toast('주소를 복사했어요.'); }
  };
  try {
    if (window.QRCode) new window.QRCode($('[data-qr]', d), { text: url, width: 320, height: 320, correctLevel: window.QRCode.CorrectLevel.M });
    else $('[data-qr]', d).textContent = 'QR을 불러오지 못했어요.';
  } catch { /* QR 실패해도 주소는 사용 가능 */ }
  const nfcBtn = $('[data-nfc]', d);
  if (nfcBtn) nfcBtn.onclick = async () => {
    const st = $('[data-st]', d);
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 30000);
    nfcBtn.disabled = true;
    st.style.color = ''; st.textContent = '휴대폰 뒷면을 NFC 태그에 대 주세요…';
    try {
      const ndef = new window.NDEFReader();
      await ndef.write({ records: [{ recordType: 'url', data: url }] }, { signal: ctrl.signal });
      st.style.color = 'var(--ok)'; st.textContent = '완료! 태그에 명함 주소를 썼어요.';
    } catch (e) {
      st.style.color = 'var(--danger)';
      st.textContent = e.name === 'AbortError' ? '시간이 지났어요. 다시 눌러 주세요.'
        : e.name === 'NotAllowedError' ? 'NFC 권한이 필요해요. 휴대폰 NFC를 켜고 허용해 주세요.'
        : '쓰기에 실패했어요: ' + e.message;
    } finally { clearTimeout(t); nfcBtn.disabled = false; }
  };
  d.showModal();
}
