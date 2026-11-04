/* =====================================================================
   데이터 저장소 — Firebase(Auth + Firestore) 또는 로컬 모드(localStorage)
   Firestore 구조
     students/{학번}               : { sid, name, icon, stats:{곡id:{...}}, musicIndex, updatedAt }
     students/{학번}/songs/{곡id}   : { answers:{...}, updatedAt }
     lyrics/{곡id}                  : { text, updatedAt }   ← 선생님만 쓰기
   ===================================================================== */
import { firebaseConfig, TEACHER_EMAILS, STUDENT_EMAIL_DOMAIN } from "./firebase-config.js?v=20261104b";

const V = "10.12.2";
const CDN = `https://www.gstatic.com/firebasejs/${V}`;
let fb = null;            // { auth, db, m:{...modules} }
export const isLocal = () => !fb;
const LS = "popsong-class-v1";

const lsGet = () => { try { return JSON.parse(localStorage.getItem(LS) || "{}"); } catch (e) { return {}; } };
const lsSet = (o) => { try { localStorage.setItem(LS, JSON.stringify(o)); } catch (e) {} };
const lsPatch = (fn) => { const o = lsGet(); fn(o); lsSet(o); };

export async function initStore() {
  if (!firebaseConfig) return { local: true };
  try {
    const [appM, authM, fsM] = await Promise.all([
      import(`${CDN}/firebase-app.js`), import(`${CDN}/firebase-auth.js`), import(`${CDN}/firebase-firestore.js`)]);
    const app = appM.initializeApp(firebaseConfig);
    const auth = authM.getAuth(app);
    await authM.setPersistence(auth, authM.browserLocalPersistence);
    const db = fsM.getFirestore(app);
    fb = { auth, db, a: authM, f: fsM };
    return { local: false };
  } catch (e) {
    console.error("Firebase 초기화 실패 — 로컬 모드로 동작합니다.", e);
    fb = null;
    return { local: true, error: e };
  }
}

const emailOf = (sid) => `${sid}@${STUDENT_EMAIL_DOMAIN}`;
const sidOf = (email) => (email || "").split("@")[0];

async function sha(s) {
  try { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join(""); }
  catch (e) { return "p:" + s; }
}

/* ---------- 학생 세션 ---------- */
export function waitForSession() {
  if (!fb) {
    const o = lsGet();
    return Promise.resolve(o.session && o.users && o.users[o.session] ? o.session : null);
  }
  return new Promise(res => {
    const un = fb.a.onAuthStateChanged(fb.auth, u => {
      un();
      if (u && u.email && u.email.endsWith("@" + STUDENT_EMAIL_DOMAIN)) res(sidOf(u.email)); else res(null);
    });
  });
}

/* 결과: {ok:true, created} | {ok:false, code:"NEED_CONFIRM"|"WRONG_PIN"|"NAME_MISMATCH"|"NETWORK"|..., name} */
export async function studentLogin(sid, name, pin, { create = false, icon = "" } = {}) {
  if (!fb) {
    const o = lsGet(); o.users = o.users || {};
    const hash = await sha(sid + ":" + pin), u = o.users[sid];
    if (!u) {
      if (!create) return { ok: false, code: "NEED_CONFIRM" };
      o.users[sid] = { hash, profile: { sid, name, icon }, songs: {} };
      o.session = sid; lsSet(o); return { ok: true, created: true };
    }
    if (u.hash !== hash) return { ok: false, code: "WRONG_PIN" };
    if (u.profile.name !== name) return { ok: false, code: "NAME_MISMATCH", name: u.profile.name };
    o.session = sid; lsSet(o); return { ok: true, created: false };
  }
  const { a, f, auth, db } = fb;
  try {
    if (!create) await a.signInWithEmailAndPassword(auth, emailOf(sid), pin);
    else await a.createUserWithEmailAndPassword(auth, emailOf(sid), pin);
  } catch (e) {
    const c = e.code || "";
    if (!create && /invalid-credential|user-not-found|wrong-password|invalid-login/.test(c)) return { ok: false, code: "NEED_CONFIRM" };
    if (create && /email-already-in-use/.test(c)) return { ok: false, code: "WRONG_PIN" };
    if (/too-many-requests/.test(c)) return { ok: false, code: "TOO_MANY" };
    if (/network/.test(c)) return { ok: false, code: "NETWORK" };
    if (/operation-not-allowed/.test(c)) return { ok: false, code: "SETUP" };
    return { ok: false, code: "UNKNOWN", detail: c };
  }
  const ref = f.doc(db, "students", sid);
  try {
    const snap = await f.getDoc(ref);
    if (snap.exists()) {
      const p = snap.data();
      if (p.name && p.name !== name) { await a.signOut(auth); return { ok: false, code: "NAME_MISMATCH", name: p.name }; }
    } else {
      await f.setDoc(ref, { sid, name, icon, createdAt: f.serverTimestamp(), updatedAt: f.serverTimestamp() }, { merge: true });
    }
  } catch (e) {
    await a.signOut(auth);
    return { ok: false, code: /permission/.test(e.code || "") ? "RULES" : "NETWORK", detail: e.code };
  }
  return { ok: true, created: create };
}

export async function logout() {
  if (!fb) { lsPatch(o => { delete o.session; }); return; }
  await fb.a.signOut(fb.auth);
}

export async function loadProfile(sid) {
  if (!fb) { const u = (lsGet().users || {})[sid]; return u ? { ...u.profile, stats: u.stats || {} } : null; }
  const s = await fb.f.getDoc(fb.f.doc(fb.db, "students", sid));
  return s.exists() ? s.data() : null;
}
export async function saveProfile(sid, patch) {
  if (!fb) { lsPatch(o => { const u = o.users[sid]; if (!u) return; const { stats, musicIndex, ...rest } = patch; Object.assign(u.profile, rest); if (stats) u.stats = Object.assign(u.stats || {}, stats); if (musicIndex != null) u.musicIndex = musicIndex; }); return; }
  await fb.f.setDoc(fb.f.doc(fb.db, "students", sid), { ...patch, updatedAt: fb.f.serverTimestamp() }, { merge: true });
}

/* ---------- 곡별 답안 ---------- */
const cacheKey = (sid, song) => `${LS}:cache:${sid}:${song}`;
export async function loadSong(sid, song) {
  if (!fb) { const u = (lsGet().users || {})[sid]; return (u && u.songs && u.songs[song]) || {}; }
  try {
    const s = await fb.f.getDoc(fb.f.doc(fb.db, "students", sid, "songs", song));
    const data = s.exists() ? (s.data().answers || {}) : {};
    try { localStorage.setItem(cacheKey(sid, song), JSON.stringify(data)); } catch (e) {}
    return data;
  } catch (e) {
    try { return JSON.parse(localStorage.getItem(cacheKey(sid, song)) || "{}"); } catch (x) { return {}; }
  }
}
export async function saveSong(sid, song, answers, stats, musicIndex) {
  if (!fb) {
    lsPatch(o => { const u = o.users[sid]; if (!u) return; u.songs = u.songs || {}; u.songs[song] = answers; u.stats = u.stats || {}; u.stats[song] = stats; u.musicIndex = musicIndex; });
    return;
  }
  try { localStorage.setItem(cacheKey(sid, song), JSON.stringify(answers)); } catch (e) {}
  const { f, db } = fb;
  const batch = f.writeBatch(db);
  batch.set(f.doc(db, "students", sid, "songs", song), { answers, updatedAt: f.serverTimestamp() });
  batch.set(f.doc(db, "students", sid), { stats: { [song]: stats }, musicIndex, updatedAt: f.serverTimestamp() }, { merge: true });
  await batch.commit();
}

/* ---------- 가사 ---------- */
export async function loadLyrics(song) {
  if (!fb) return (lsGet().lyrics || {})[song] || "";
  try {
    const s = await fb.f.getDoc(fb.f.doc(fb.db, "lyrics", song));
    const t = s.exists() ? (s.data().text || "") : "";
    try { localStorage.setItem(`${LS}:lyrics:${song}`, t); } catch (e) {}
    return t;
  } catch (e) { try { return localStorage.getItem(`${LS}:lyrics:${song}`) || ""; } catch (x) { return ""; } }
}
export async function saveLyrics(song, text) {
  if (!fb) { lsPatch(o => { o.lyrics = o.lyrics || {}; o.lyrics[song] = text; }); return; }
  await fb.f.setDoc(fb.f.doc(fb.db, "lyrics", song), { text, updatedAt: fb.f.serverTimestamp() });
}

/* ---------- 선생님 ---------- */
export function teacherSession() {
  if (!fb) return Promise.resolve(lsGet().teacher ? { email: "local", local: true } : null);
  return new Promise(res => {
    const un = fb.a.onAuthStateChanged(fb.auth, u => { un(); res(u && TEACHER_EMAILS.includes(u.email) ? { email: u.email } : (u ? { email: u.email, denied: true } : null)); });
  });
}
export async function teacherLogin() {
  if (!fb) { lsPatch(o => { o.teacher = true; }); return { email: "local", local: true }; }
  const p = new fb.a.GoogleAuthProvider();
  p.setCustomParameters({ prompt: "select_account" });
  const r = await fb.a.signInWithPopup(fb.auth, p);
  if (!TEACHER_EMAILS.includes(r.user.email)) { await fb.a.signOut(fb.auth); return { email: r.user.email, denied: true }; }
  return { email: r.user.email };
}
export async function teacherLogout() {
  if (!fb) { lsPatch(o => { delete o.teacher; }); return; }
  await fb.a.signOut(fb.auth);
}
export async function listStudents() {
  if (!fb) return Object.values(lsGet().users || {}).map(u => ({ ...u.profile, stats: u.stats || {}, musicIndex: u.musicIndex || 0 }));
  const q = await fb.f.getDocs(fb.f.collection(fb.db, "students"));
  return q.docs.map(d => ({ ...d.data(), updatedAt: d.data().updatedAt && d.data().updatedAt.toDate ? d.data().updatedAt.toDate() : null }));
}
export async function loadStudentSong(sid, song) { return loadSong(sid, song); }
export async function resetStudentSong(sid, song) {
  if (!fb) { lsPatch(o => { const u = o.users[sid]; if (u && u.songs) delete u.songs[song]; if (u && u.stats) delete u.stats[song]; }); return; }
  const { f, db } = fb;
  await f.deleteDoc(f.doc(db, "students", sid, "songs", song));
  await f.setDoc(f.doc(db, "students", sid), { stats: { [song]: f.deleteField() } }, { merge: true });
}
