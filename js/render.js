// 명함 그리기(앞면/뒷면). 명함은 900x500px 기준으로 그리고 화면 크기에 맞춰 축소합니다.

export const PALETTE = [
  ['#1f6fde', '블루'], ['#1b2a5c', '네이비'], ['#0f8b6c', '그린'],
  ['#e0574a', '코랄'], ['#6a4bd1', '퍼플'], ['#2b2f36', '차콜'],
];

export const TEMPLATES = { photo: '클래식 포토', split: '모던 스플릿' };

export const QUOTE_TYPES = {
  slogan: '나의 슬로건', motto: '나의 좌우명', famous: '마음에 새긴 명언', phrase: '좋아하는 글귀',
};

export const LIMITS = {
  company: 30, tagline: 40, dept: 30, title: 30, name: 20, nameEn: 40, cert: 50,
  phone: 20, tel: 20, email: 60, web: 60, address: 80, quote: 120, quoteBy: 30,
};

export const EMPTY_CARD = {
  template: 'photo', color: '#1f6fde',
  company: '', tagline: '', dept: '', title: '', name: '', nameEn: '', cert: '',
  phone: '', tel: '', email: '', web: '', address: '',
  bullets: ['', '', ''], quoteType: 'motto', quote: '', quoteBy: '',
  logo: '', photo: '', visibility: 'public',
};

export const SAMPLE_CARD = {
  ...EMPTY_CARD,
  company: '그린웨이브 랩', tagline: '바다를 지키는 기술 연구소', dept: '해양로봇연구팀',
  title: '해양환경 로봇 엔지니어', name: '김미래', nameEn: 'KIM MIRAE',
  cert: '국제 해양로봇 기술사 제2036-0815호',
  phone: '010-0000-1234', tel: '02-000-1234', email: 'mirae@greenwave.lab', web: 'www.greenwave.lab',
  address: '부산시 해운대구 미래로 100, 그린웨이브 타워 12층',
  bullets: ['바다 쓰레기를 줍는 로봇을 만듭니다', '데이터로 바다의 건강을 지켜요', '함께 일하면 즐거운 동료'],
  quoteType: 'famous', quote: '미래를 예측하는 가장 좋은 방법은\n미래를 창조하는 것이다.', quoteBy: '피터 드러커',
  color: '#0f8b6c',
};

// 입력이 비었을 때 미리보기에만 흐리게 보이는 예시
const PH = {
  company: '미래컴퍼니', tagline: '세상을 바꾸는 기술', dept: '연구개발팀', title: '나의 미래 직업',
  name: '홍길동', nameEn: 'HONG GIL DONG', cert: '', phone: '010-0000-0000', tel: '02-000-0000',
  email: 'name@future.com', web: 'www.future.com', address: '서울시 미래구 꿈길 100',
  quote: '꿈을 꾸는 것만으로는 부족하다.\n행동하라.', quoteBy: '',
  bullets: ['내가 잘하는 일을 적어요', '내가 하는 일을 소개해요', '나만의 강점을 자랑해요'],
};

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const IMG_RE = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/;

export function sanitizeCard(src = {}) {
  const d = structuredClone(EMPTY_CARD);
  for (const k of Object.keys(LIMITS)) d[k] = String(src[k] ?? '').slice(0, LIMITS[k]);
  d.template = src.template in TEMPLATES ? src.template : 'photo';
  d.color = /^#[0-9a-fA-F]{6}$/.test(src.color || '') ? src.color : '#1f6fde';
  d.quoteType = src.quoteType in QUOTE_TYPES ? src.quoteType : 'motto';
  d.visibility = src.visibility === 'private' ? 'private' : 'public';
  d.bullets = (Array.isArray(src.bullets) ? src.bullets : []).slice(0, 3).map((s) => String(s ?? '').slice(0, 40));
  while (d.bullets.length < 3) d.bullets.push('');
  for (const k of ['logo', 'photo']) d[k] = typeof src[k] === 'string' && IMG_RE.test(src[k]) ? src[k] : '';
  return d;
}

function rgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
export function mix(a, b, t) {
  const A = rgb(a), B = rgb(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
export function colorVars(c) {
  return `--c:${c};--c-dark:${mix(c, '#000000', 0.22)};--c-soft:${mix(c, '#ffffff', 0.88)};--c-soft2:${mix(c, '#ffffff', 0.62)}`;
}

function quoteSize(len, base = 1) {
  const s = len <= 18 ? 34 : len <= 36 ? 29 : len <= 60 ? 24 : len <= 90 ? 21 : 18;
  return Math.round(s * base);
}

const ICON_CHECK = '<svg width="12" height="12" viewBox="0 0 12 12"><path d="M2.5 6.3l2.3 2.2 4.7-5" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const SILHOUETTE = '<svg viewBox="0 0 120 150" width="100%" height="100%" preserveAspectRatio="xMidYMax meet"><circle cx="60" cy="58" r="28" fill="#c9d1e0"/><path d="M12 150c0-30 21-50 48-50s48 20 48 50z" fill="#c9d1e0"/></svg>';

/**
 * @param {object} d 명함 데이터
 * @param {'front'|'back'} side
 * @param {{ph?:boolean}} opt ph=true면 빈 칸에 흐린 예시를 보여줌(편집 미리보기용)
 */
export function renderFace(d, side, opt = {}) {
  const ph = !!opt.ph;
  const raw = (k) => String(d[k] ?? '').trim();
  const has = (k) => !!raw(k) || (ph && !!PH[k]);
  const v = (k) => raw(k) ? esc(raw(k)) : (ph && PH[k] ? `<span class="is-ph">${esc(PH[k])}</span>` : '');
  const nameTxt = raw('name') || (ph ? PH.name : '');
  const nameSpacing = nameTxt.length <= 4 && /[가-힣]/.test(nameTxt) ? '.16em' : '.01em';
  const initial = (raw('company')[0] || (ph ? 'F' : '★'));
  const logo = (cls = '') => d.logo
    ? `<img class="logo ${cls}" src="${d.logo}" alt="">`
    : `<div class="mark ${cls}${ph && !raw('company') ? ' is-ph' : ''}">${esc(initial)}</div>`;
  const photo = (cls) => d.photo
    ? `<div class="${cls}" style="background-image:url('${d.photo}')"></div>`
    : (ph ? `<div class="${cls} empty">${SILHOUETTE}</div>` : '');
  const bulletsSrc = (d.bullets || []).map((s) => String(s || '').trim());
  const bullets = bulletsSrc.some(Boolean)
    ? bulletsSrc.filter(Boolean).map((t) => esc(t))
    : (ph ? PH.bullets.map((t) => `<span class="is-ph">${esc(t)}</span>`) : []);
  const qRaw = raw('quote');
  const qText = qRaw ? esc(qRaw) : (ph ? `<span class="is-ph">${esc(PH.quote)}</span>` : '');
  const qLen = (qRaw || (ph ? PH.quote : '')).length;
  const qType = QUOTE_TYPES[d.quoteType] || QUOTE_TYPES.motto;
  const vars = colorVars(d.color || '#1f6fde');
  const tpl = d.template === 'split' ? 'split' : 'photo';
  const cls = `bc t-${tpl} ${side}`;

  if (tpl === 'photo' && side === 'front') {
    const contacts = [['M', 'phone'], ['T', 'tel'], ['E', 'email', 1], ['W', 'web', 1]].filter(([, k]) => has(k))
      .map(([l, k, w]) => `<div class="${w ? 'wide' : ''}"><b>${l}.</b>${v(k)}</div>`).join('');
    return `<div class="${cls}" style="${vars}">
      <div class="ph-circle"></div>
      ${photo('photo')}
      <div class="top-logo">${logo()}<div class="co">${v('company')}</div></div>
      <div class="left${d.photo || ph ? '' : ' full'}">
        <div class="role">${v('title')}${has('dept') ? `<span class="dept">${v('dept')}</span>` : ''}</div>
        <div class="name" style="letter-spacing:${nameSpacing}">${v('name')}</div>
        ${has('nameEn') ? `<div class="name-en">${v('nameEn')}</div>` : ''}
        ${raw('cert') ? `<div class="cert">${esc(raw('cert'))}</div>` : ''}
        <div class="contacts">${contacts}</div>
        ${bullets.length ? `<ul class="bullets">${bullets.map((b) => `<li><span class="dot"></span>${b}</li>`).join('')}</ul>` : ''}
      </div>
      <div class="band"><span>${v('address')}</span><span>${v('tagline')}</span></div>
    </div>`;
  }
  if (tpl === 'photo' && side === 'back') {
    return `<div class="${cls}" style="${vars}">
      <div class="arc"></div>
      <div class="brand">${logo()}<div class="co">${v('company')}</div>${has('tagline') ? `<div class="tag">${v('tagline')}</div>` : ''}</div>
      <div class="quote-wrap">
        <div class="q-badge"><span class="chk">${ICON_CHECK}</span>${esc(qType)}</div>
        <div class="q-text" style="font-size:${quoteSize(qLen)}px">${qText}</div>
        ${raw('quoteBy') ? `<div class="q-by">— ${esc(raw('quoteBy'))}</div>` : ''}
      </div>
    </div>`;
  }
  if (tpl === 'split' && side === 'front') {
    const rows = [['M', 'phone'], ['T', 'tel'], ['E', 'email'], ['W', 'web']].filter(([, k]) => has(k))
      .map(([l, k]) => `<b>${l}.</b><span>${v(k)}</span>`).join('');
    const ph2 = d.photo || ph;
    return `<div class="${cls}" style="${vars}">
      <div class="lp">${logo('big')}<div class="co">${v('company')}</div>${has('tagline') ? `<div class="tag">${v('tagline')}</div>` : ''}</div>
      <div class="lp-bar"></div>
      <div class="divider"></div>
      ${photo('photo-sm')}
      <div class="rp">
        <div class="rp-head${ph2 ? ' with-photo' : ''}">
          <div class="role">${v('title')}${has('dept') ? ` · ${v('dept')}` : ''}</div>
          <div class="name" style="letter-spacing:${nameSpacing}">${v('name')}</div>
          ${raw('cert') ? `<div class="cert">${esc(raw('cert'))}</div>` : (has('nameEn') ? `<div class="cert en">${v('nameEn')}</div>` : '')}
        </div>
        <div class="contacts">${rows}</div>
        ${has('address') ? `<div class="addr">${v('address')}</div>` : ''}
      </div>
    </div>`;
  }
  // split back
  return `<div class="${cls}" style="${vars}">
    <div class="glow"></div>
    <div class="center">
      <div class="logo-circle">${logo()}</div>
      <div class="co">${v('company')}</div>
      ${has('tagline') ? `<div class="tag">${v('tagline')}</div>` : ''}
      <div class="line"></div>
      <div class="q-label">${esc(qType)}</div>
      <div class="q-text" style="font-size:${quoteSize(qLen, 0.82)}px">${qText}</div>
      ${raw('quoteBy') ? `<div class="q-by">— ${esc(raw('quoteBy'))}</div>` : ''}
    </div>
  </div>`;
}

/** .bc-frame 안의 900x500 명함을 프레임 너비에 맞게 축소 */
export function attachScaler(frame) {
  const set = () => frame.style.setProperty('--s', (frame.clientWidth || 900) / 900);
  set();
  new ResizeObserver(set).observe(frame);
}

export function mountCard(frame, d, side, opt) {
  frame.innerHTML = renderFace(d, side, opt);
  if (!frame.dataset.scaled) { attachScaler(frame); frame.dataset.scaled = '1'; }
}

/** 고해상도 PNG(1800x1000)로 저장 */
export async function exportPNG(d, side, filename) {
  if (!window.html2canvas) throw new Error('이미지 저장 도구를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.');
  if (document.fonts?.ready) await document.fonts.ready;
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-12000px;top:0;width:900px;height:500px;';
  host.innerHTML = renderFace(d, side);
  document.body.appendChild(host);
  try {
    const canvas = await window.html2canvas(host.firstElementChild, { scale: 2, backgroundColor: null, logging: false });
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = filename;
    a.click();
  } finally { host.remove(); }
}

/** 업로드 이미지 줄이기. kind: 'photo'(3:4로 자르기) | 'logo'(비율 유지) */
export async function processImage(file, kind) {
  if (!file || !file.type.startsWith('image/')) throw new Error('이미지 파일만 올릴 수 있어요.');
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const c = document.createElement('canvas');
    const g = c.getContext('2d');
    if (kind === 'photo') {
      const W = 360, H = 480, r = W / H;
      let sw = img.naturalWidth, sh = img.naturalHeight;
      let sx = 0, sy = 0;
      if (sw / sh > r) { const nw = sh * r; sx = (sw - nw) / 2; sw = nw; } else { const nh = sw / r; sy = Math.max(0, (sh - nh) * 0.3); sh = nh; }
      c.width = W; c.height = H;
      g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
      g.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
      return c.toDataURL('image/jpeg', 0.85);
    }
    let max = 420;
    const isJpg = file.type === 'image/jpeg';
    for (let i = 0; i < 4; i++) {
      const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      c.width = Math.max(1, Math.round(img.naturalWidth * s));
      c.height = Math.max(1, Math.round(img.naturalHeight * s));
      g.clearRect(0, 0, c.width, c.height);
      if (isJpg) { g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); }
      g.drawImage(img, 0, 0, c.width, c.height);
      const out = isJpg ? c.toDataURL('image/jpeg', 0.9) : c.toDataURL('image/png');
      if (out.length < 300000) return out;
      max = Math.round(max * 0.75);
    }
    return c.toDataURL('image/jpeg', 0.85);
  } finally { URL.revokeObjectURL(url); }
}
