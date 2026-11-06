// NFC 태그 / QR로 열리는 명함 보기 화면 (card.html?id=...)
import { store, validId } from './store.js';
import { mountCard, exportPNG, esc, mix } from './render.js';
import { $, toast } from './ui.js';

const app = $('#app');
const id = new URLSearchParams(location.search).get('id');
let first = true;

store.onAuth((u) => { if (first) { first = false; load(u); } });

function message(icon, title, text) {
  app.innerHTML = `<div class="panel msg"><div class="big">${icon}</div><h2>${esc(title)}</h2><p class="hint">${esc(text)}</p>
    <a class="btn primary" href="./">나도 미래 명함 만들기</a></div>`;
}

async function load(user) {
  if (!validId(id)) return message('🤔', '명함 주소가 올바르지 않아요', 'NFC 태그나 QR코드에 쓴 주소를 다시 확인해 주세요.');
  let c;
  try { c = await store.getCard(id); }
  catch (e) {
    if (e.code === 'private') return message('🔒', '볼 수 없는 명함이에요', '주인이 비공개로 바꿨거나 삭제한 명함이에요. 명함 주인이라면 로그인한 뒤 다시 열어 주세요.');
    if (e.code === 'not-found') return message('🫥', '명함을 찾을 수 없어요', '삭제되었거나 아직 등록되지 않은 명함이에요.');
    return message('📡', '명함을 불러오지 못했어요', e.message);
  }
  document.title = `${c.name}의 미래 명함`;
  document.body.style.setProperty('--bgc', mix(c.color, '#ffffff', 0.72));
  const canEdit = user && (user.isAdmin || user.uid === c.owner);

  app.innerHTML = `
    <div class="v-top"><div class="k">FUTURE BUSINESS CARD</div><h1>${esc(c.name)}의 미래 명함</h1></div>
    <div class="seg" role="tablist"><button class="on" data-s="0">앞면</button><button data-s="1">뒷면</button></div>
    <div class="flip peek" id="flip" role="button" tabindex="0" aria-label="눌러서 명함 뒤집기">
      <div class="flip-in"><div class="face"><div class="bc-frame" id="fF"></div></div><div class="face back"><div class="bc-frame" id="fB"></div></div></div>
    </div>
    <p class="flip-hint">명함을 누르면 뒤집혀요</p>
    <div class="v-actions">
      <button class="btn" id="vcf">📇 연락처에 저장</button>
      <button class="btn" id="png">🖼️ 이미지 저장</button>
    </div>
    ${canEdit ? `<div class="owner-bar">
      ${c.visibility === 'private' ? '<span class="pill private">🔒 비공개 · 나와 선생님만 보여요</span>' : '<span class="pill public">공개 중</span>'}
      <a class="btn sm" href="edit.html?id=${encodeURIComponent(c.id)}">수정하기</a></div>` : ''}
    <div class="v-foot">나도 만들어 볼까? <a href="./">미래 명함 만들기 →</a></div>`;

  mountCard($('#fF'), c, 'front');
  mountCard($('#fB'), c, 'back');
  const flip = $('#flip');
  const segs = [...app.querySelectorAll('.seg button')];
  const set = (on) => { flip.classList.remove('peek'); flip.classList.toggle('on', on); segs.forEach((b, i) => b.classList.toggle('on', i === (on ? 1 : 0))); };
  flip.onclick = () => set(!flip.classList.contains('on'));
  flip.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip.click(); } };
  segs.forEach((b, i) => (b.onclick = () => set(i === 1)));

  $('#png').onclick = async () => {
    try {
      const side = flip.classList.contains('on') ? 'back' : 'front';
      await exportPNG(c, side, `미래명함_${c.name}_${side === 'front' ? '앞면' : '뒷면'}.png`);
    } catch (e) { toast(e.message, true); }
  };
  $('#vcf').onclick = () => downloadVcf(c);
}

function downloadVcf(c) {
  const e = (s) => String(s || '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
  const lines = ['BEGIN:VCARD', 'VERSION:3.0', `N:${e(c.name)};;;;`, `FN:${e(c.name)}`];
  if (c.company || c.dept) lines.push(`ORG:${e(c.company)}${c.dept ? ';' + e(c.dept) : ''}`);
  if (c.title) lines.push(`TITLE:${e(c.title)}`);
  if (c.phone) lines.push(`TEL;TYPE=CELL:${e(c.phone)}`);
  if (c.tel) lines.push(`TEL;TYPE=WORK:${e(c.tel)}`);
  if (c.email) lines.push(`EMAIL:${e(c.email)}`);
  if (c.web) lines.push(`URL:${e(c.web)}`);
  if (c.address) lines.push(`ADR;TYPE=WORK:;;${e(c.address)};;;;`);
  if (c.quote) lines.push(`NOTE:${e(c.quote)}${c.quoteBy ? ' - ' + e(c.quoteBy) : ''}`);
  if (c.photo && c.photo.startsWith('data:image/jpeg;base64,')) lines.push(`PHOTO;ENCODING=b;TYPE=JPEG:${c.photo.split(',')[1]}`);
  lines.push('END:VCARD');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/vcard' }));
  a.download = `${c.name || 'card'}.vcf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
