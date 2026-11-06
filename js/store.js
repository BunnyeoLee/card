// 로그인과 명함 저장을 담당합니다.
// - Firebase 설정이 있으면 Firebase(인증 + Firestore)를 사용
// - 없으면 '체험 모드': 이 브라우저(localStorage)에만 저장
import { CONFIG, useFirebase } from './config.js';
import { sanitizeCard } from './render.js';

export const MODE = useFirebase ? 'firebase' : 'demo';
const FB_VER = '10.12.2';
const ID_RE = /^[A-Za-z0-9_-]{3,40}$/;
export const LOGIN_RE = /^[a-z0-9][a-z0-9_.-]{2,19}$/;

export class AppError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

export function newId() {
  const a = 'abcdefghjkmnpqrstuvwxyz23456789';
  return [...crypto.getRandomValues(new Uint8Array(8))].map((x) => a[x % a.length]).join('');
}
export const validId = (id) => ID_RE.test(id || '');
export const cardUrl = (id) => new URL(`card.html?id=${encodeURIComponent(id)}`, location.href).href;

/* ---------------------------------------------------------- Firebase */
let fbP = null;
function fb() {
  if (!fbP) {
    fbP = (async () => {
      const base = `https://www.gstatic.com/firebasejs/${FB_VER}`;
      const [appM, authM, fsM] = await Promise.all([
        import(`${base}/firebase-app.js`), import(`${base}/firebase-auth.js`), import(`${base}/firebase-firestore.js`),
      ]);
      const app = appM.initializeApp(CONFIG.firebase);
      return { auth: authM.getAuth(app), db: fsM.getFirestore(app), A: authM, F: fsM };
    })();
  }
  return fbP;
}

const adminList = () => (CONFIG.adminEmails || []).map((e) => e.toLowerCase().trim());
function fbUser(u) {
  if (!u) return null;
  const email = (u.email || '').toLowerCase();
  const isStudent = email.endsWith('@' + CONFIG.loginDomain);
  return {
    uid: u.uid,
    email,
    loginId: isStudent ? email.split('@')[0] : email,
    name: u.displayName || (isStudent ? email.split('@')[0] : email),
    isAdmin: !isStudent && u.emailVerified && adminList().includes(email),
  };
}
const toMs = (t) => (t && typeof t.toMillis === 'function' ? t.toMillis() : (typeof t === 'number' ? t : 0));
function fromDoc(id, data) {
  return { ...sanitizeCard(data), id, owner: data.owner, ownerId: data.ownerId || '', ownerName: data.ownerName || '',
    createdAt: toMs(data.createdAt), updatedAt: toMs(data.updatedAt) };
}
function mapFbError(e) {
  const c = e?.code || '';
  const msg = {
    'auth/email-already-in-use': '이미 사용 중인 아이디예요. 다른 아이디를 골라 주세요.',
    'auth/invalid-credential': '아이디 또는 비밀번호가 맞지 않아요.',
    'auth/wrong-password': '아이디 또는 비밀번호가 맞지 않아요.',
    'auth/user-not-found': '아이디 또는 비밀번호가 맞지 않아요.',
    'auth/weak-password': '비밀번호는 6자 이상으로 정해 주세요.',
    'auth/too-many-requests': '시도가 너무 많아요. 잠시 후 다시 해 주세요.',
    'auth/popup-closed-by-user': '로그인 창이 닫혔어요.',
    'auth/unauthorized-domain': '이 사이트 주소가 Firebase 승인 도메인에 등록되지 않았어요. (README 참고)',
    'auth/operation-not-allowed': 'Firebase에서 이 로그인 방식이 켜져 있지 않아요. (README 참고)',
    'permission-denied': '이 작업을 할 권한이 없어요.',
    'unavailable': '서버에 연결할 수 없어요. 인터넷 연결을 확인해 주세요.',
  }[c];
  return new AppError(c || 'error', msg || e?.message || '알 수 없는 오류가 났어요.');
}
const wrap = (fn) => async (...a) => { try { return await fn(...a); } catch (e) { throw e instanceof AppError ? e : mapFbError(e); } };

const firebaseBackend = {
  onAuth: (cb) => { fb().then(({ auth, A }) => A.onAuthStateChanged(auth, (u) => cb(fbUser(u)))).catch(() => cb(null)); },
  signUp: wrap(async (loginId, pw, name) => {
    const { auth, A } = await fb();
    const cred = await A.createUserWithEmailAndPassword(auth, `${loginId}@${CONFIG.loginDomain}`, pw);
    await A.updateProfile(cred.user, { displayName: name });
    return fbUser({ ...cred.user, displayName: name });
  }),
  signIn: wrap(async (loginId, pw) => {
    const { auth, A } = await fb();
    const cred = await A.signInWithEmailAndPassword(auth, `${loginId}@${CONFIG.loginDomain}`, pw);
    return fbUser(cred.user);
  }),
  signInAdmin: wrap(async () => {
    const { auth, A } = await fb();
    const cred = await A.signInWithPopup(auth, new A.GoogleAuthProvider());
    const u = fbUser(cred.user);
    if (!u.isAdmin) { await A.signOut(auth); throw new AppError('not-admin', `${u.email} 계정은 관리자로 등록되어 있지 않아요.`); }
    return u;
  }),
  signOut: wrap(async () => { const { auth, A } = await fb(); await A.signOut(auth); }),
  getCard: wrap(async (id) => {
    const { db, F } = await fb();
    try {
      const s = await F.getDoc(F.doc(db, 'cards', id));
      if (!s.exists()) throw new AppError('not-found', '명함을 찾을 수 없어요.');
      return fromDoc(id, s.data());
    } catch (e) {
      if (e.code === 'permission-denied') throw new AppError('private', '비공개로 설정되었거나 삭제된 명함이에요.');
      throw e;
    }
  }),
  saveCard: wrap(async (user, id, data) => {
    const { db, F } = await fb();
    const clean = sanitizeCard(data);
    const ref = F.doc(db, 'cards', id || newId());
    if (id) {
      await F.updateDoc(ref, { ...clean, updatedAt: F.serverTimestamp() });
    } else {
      await F.setDoc(ref, { ...clean, owner: user.uid, ownerId: user.loginId, ownerName: user.name,
        createdAt: F.serverTimestamp(), updatedAt: F.serverTimestamp() });
    }
    return ref.id;
  }),
  setVisibility: wrap(async (id, visibility) => {
    const { db, F } = await fb();
    await F.updateDoc(F.doc(db, 'cards', id), { visibility, updatedAt: F.serverTimestamp() });
  }),
  deleteCard: wrap(async (id) => { const { db, F } = await fb(); await F.deleteDoc(F.doc(db, 'cards', id)); }),
  listMine: wrap(async (user) => {
    const { db, F } = await fb();
    const snap = await F.getDocs(F.query(F.collection(db, 'cards'), F.where('owner', '==', user.uid)));
    return snap.docs.map((s) => fromDoc(s.id, s.data())).sort((a, b) => b.updatedAt - a.updatedAt);
  }),
  listAll: wrap(async () => {
    const { db, F } = await fb();
    const snap = await F.getDocs(F.collection(db, 'cards'));
    return snap.docs.map((s) => fromDoc(s.id, s.data())).sort((a, b) => b.updatedAt - a.updatedAt);
  }),
};

/* ---------------------------------------------------------- 체험 모드 */
const LS = {
  get(k, def) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch { return def; } },
  set(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); }
    catch { throw new AppError('quota', '브라우저 저장 공간이 가득 찼어요. (체험 모드) 사진 크기를 줄이거나 다른 명함을 지워 주세요.'); }
  },
};
const listeners = new Set();
const session = () => LS.get('fc_session', null);
const emit = () => listeners.forEach((cb) => cb(session()));
async function hash(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('fc:' + s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
const cardsLS = () => LS.get('fc_cards', {});
function canSee(c, u) { return c.visibility === 'public' || (u && (u.isAdmin || u.uid === c.owner)); }
function canEdit(c, u) { return u && (u.isAdmin || u.uid === c.owner); }

const demoBackend = {
  onAuth: (cb) => { listeners.add(cb); cb(session()); },
  async signUp(loginId, pw, name) {
    const users = LS.get('fc_users', {});
    if (users[loginId]) throw new AppError('exists', '이미 사용 중인 아이디예요. 다른 아이디를 골라 주세요.');
    if (pw.length < 6) throw new AppError('weak', '비밀번호는 6자 이상으로 정해 주세요.');
    users[loginId] = { uid: 'u_' + newId(), name, pw: await hash(pw) };
    LS.set('fc_users', users);
    const u = { uid: users[loginId].uid, loginId, name, isAdmin: false };
    LS.set('fc_session', u); emit(); return u;
  },
  async signIn(loginId, pw) {
    const r = LS.get('fc_users', {})[loginId];
    if (!r || r.pw !== await hash(pw)) throw new AppError('cred', '아이디 또는 비밀번호가 맞지 않아요.');
    const u = { uid: r.uid, loginId, name: r.name, isAdmin: false };
    LS.set('fc_session', u); emit(); return u;
  },
  async signInAdmin() {
    const u = { uid: 'admin', loginId: 'admin', name: '관리자(체험)', isAdmin: true, email: 'demo-admin' };
    LS.set('fc_session', u); emit(); return u;
  },
  async signOut() { try { localStorage.removeItem('fc_session'); } catch {} emit(); },
  async getCard(id) {
    const c = cardsLS()[id];
    if (!c) throw new AppError('not-found', '명함을 찾을 수 없어요.');
    if (!canSee(c, session())) throw new AppError('private', '비공개로 설정되었거나 삭제된 명함이에요.');
    return { ...sanitizeCard(c), id, owner: c.owner, ownerId: c.ownerId, ownerName: c.ownerName, createdAt: c.createdAt, updatedAt: c.updatedAt };
  },
  async saveCard(user, id, data) {
    const all = cardsLS();
    const now = Date.now();
    if (id) {
      const c = all[id];
      if (!c || !canEdit(c, session())) throw new AppError('permission-denied', '이 작업을 할 권한이 없어요.');
      all[id] = { ...c, ...sanitizeCard(data), updatedAt: now };
    } else {
      id = newId();
      all[id] = { ...sanitizeCard(data), owner: user.uid, ownerId: user.loginId, ownerName: user.name, createdAt: now, updatedAt: now };
    }
    LS.set('fc_cards', all);
    return id;
  },
  async setVisibility(id, visibility) {
    const all = cardsLS();
    if (!all[id] || !canEdit(all[id], session())) throw new AppError('permission-denied', '이 작업을 할 권한이 없어요.');
    all[id].visibility = visibility; all[id].updatedAt = Date.now();
    LS.set('fc_cards', all);
  },
  async deleteCard(id) {
    const all = cardsLS();
    if (!all[id] || !canEdit(all[id], session())) throw new AppError('permission-denied', '이 작업을 할 권한이 없어요.');
    delete all[id]; LS.set('fc_cards', all);
  },
  async listMine(user) {
    return Object.entries(cardsLS()).filter(([, c]) => c.owner === user.uid)
      .map(([id, c]) => ({ ...sanitizeCard(c), ...c, id })).sort((a, b) => b.updatedAt - a.updatedAt);
  },
  async listAll() {
    if (!session()?.isAdmin) throw new AppError('permission-denied', '관리자만 볼 수 있어요.');
    return Object.entries(cardsLS()).map(([id, c]) => ({ ...sanitizeCard(c), ...c, id })).sort((a, b) => b.updatedAt - a.updatedAt);
  },
};

export const store = useFirebase ? firebaseBackend : demoBackend;
