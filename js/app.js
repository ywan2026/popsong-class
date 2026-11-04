import { SONGS, songById } from "./songs.js?v=20261104b";
import * as store from "./store.js?v=20261104b";
import { $, $$, esc, STEPS, STEP_COLORS, mountWorksheet, computeStats, parseLyrics, levelOf, musicIndexOf, LEVELS } from "./worksheet.js?v=20261104b";

const ANIMALS = [
  { id: "dog", e: "🐶", n: "강아지", bg: "linear-gradient(145deg,#ffe2b0,#ffc56b)" },
  { id: "cat", e: "🐱", n: "고양이", bg: "linear-gradient(145deg,#ffdbe5,#ffa9c0)" },
  { id: "rabbit", e: "🐰", n: "토끼", bg: "linear-gradient(145deg,#ece4ff,#c7b5ff)" },
  { id: "bear", e: "🐻", n: "곰", bg: "linear-gradient(145deg,#f3e1d0,#d9b08c)" },
  { id: "penguin", e: "🐧", n: "펭귄", bg: "linear-gradient(145deg,#d9efff,#9ccfff)" }];
const PREF = "popsong-class-pref";
let pref = {}; try { pref = JSON.parse(localStorage.getItem(PREF) || "{}"); } catch (e) {}
const savePref = () => { try { localStorage.setItem(PREF, JSON.stringify(pref)); } catch (e) {} };

const S = { sid: null, profile: null, stats: {}, song: null, A: null, ws: null, sec: "A", dirty: false };

/* ---------------- helpers ---------------- */
let tt;
function toast(t, m, ms = 3200) { $("#toastT").textContent = t; $("#toastM").textContent = m; $("#toast").classList.add("show"); clearTimeout(tt); tt = setTimeout(() => $("#toast").classList.remove("show"), ms); }
function confirmBox(t, m, yes) {
  $("#cfTitle").textContent = t; $("#cfMsg").textContent = m; $("#confirmSheet").classList.add("show");
  $("#cfNo").onclick = () => $("#confirmSheet").classList.remove("show");
  $("#cfYes").onclick = () => { $("#confirmSheet").classList.remove("show"); yes(); };
}
const loading = (on, txt = "불러오는 중…") => { const el = $("#loading"); el.querySelector("span").textContent = txt; el.classList.toggle("show", on); };
const animal = id => ANIMALS.find(a => a.id === id);
function applyTheme() { document.documentElement.dataset.theme = pref.theme === "dark" ? "dark" : "light"; }
function setStatus(t) { $("#saveStatus").textContent = t; }
function tick() {
  const d = new Date(), w = "일월화수목금토"[d.getDay()], hh = ((d.getHours() + 11) % 12) + 1, mm = String(d.getMinutes()).padStart(2, "0");
  $("#clock").textContent = `${d.getMonth() + 1}월 ${d.getDate()}일 (${w}) ${d.getHours() < 12 ? "오전" : "오후"} ${hh}:${mm}`;
  $("#lkDate").textContent = `${d.getMonth() + 1}월 ${d.getDate()}일 ${w}요일`; $("#lkTime").textContent = `${hh}:${mm}`;
}
function show(id) { ["musicWin", "wsWin"].forEach(x => $("#" + x).classList.toggle("show", x === id)); document.body.classList.toggle("in-ws", id === "wsWin"); }
const coverHTML = (s, play = true) => `<div class="cover" style="background:${s.cover.bg};color:${s.cover.ink}"><div class="disc"></div><div class="motif">${s.cover.motif}</div>
  <div class="no">${esc(s.no)}</div><div class="t">${esc(s.title)}</div>${play ? `<div class="play">▶</div>` : ""}</div>`;

/* ---------------- login ---------------- */
let lkIcon = pref.lastIcon || "";
function paintLoginIcons() {
  $("#lkIcons").innerHTML = ANIMALS.map(a => `<button type="button" data-i="${a.id}" title="${a.n}" class="${a.id === lkIcon ? "on" : ""}">${a.e}</button>`).join("");
  const a = animal(lkIcon); $("#lkAv").textContent = a ? a.e : "🎵"; $("#lkAv").style.background = a ? a.bg : "";
  $$("#lkIcons button").forEach(b => b.onclick = () => { lkIcon = lkIcon === b.dataset.i ? "" : b.dataset.i; paintLoginIcons(); });
}
function showLogin() {
  show(null); document.body.dataset.wall = "";
  $("#login").classList.add("show"); $("#login").classList.remove("confirming");
  $("#lkMsg").textContent = ""; $("#lkPin").value = ""; $("#lkPin2").value = "";
  if (pref.lastSid) $("#lkSid").value = pref.lastSid;
  if (pref.lastName) $("#lkName").value = pref.lastName;
  paintLoginIcons(); setStatus("");
  setTimeout(() => ($("#lkSid").value ? (pref.lastName ? $("#lkPin") : $("#lkName")) : $("#lkSid")).focus(), 60);
}
const MSG = {
  WRONG_PIN: "비밀번호가 틀렸어요. 다시 입력해 주세요.",
  NAME_MISMATCH: "이 학번은 다른 이름으로 등록되어 있어요. 학번과 이름을 확인하세요.",
  TOO_MANY: "잠시 후 다시 시도해 주세요. (시도 횟수 초과)",
  NETWORK: "인터넷 연결을 확인해 주세요.",
  SETUP: "로그인 설정이 아직 안 되어 있어요. 선생님께 알려 주세요. (이메일/비밀번호 로그인 사용 설정)",
  RULES: "데이터 권한 설정이 아직 안 되어 있어요. 선생님께 알려 주세요. (Firestore 규칙)",
  UNKNOWN: "로그인 중 문제가 생겼어요. 다시 시도해 주세요."
};
$("#lkForm").addEventListener("submit", async e => {
  e.preventDefault();
  const sid = $("#lkSid").value.trim(), name = $("#lkName").value.trim(), pin = $("#lkPin").value.trim(), msg = $("#lkMsg");
  const confirming = $("#login").classList.contains("confirming");
  msg.className = "msg err";
  if (!/^3\d{4}$/.test(sid)) { msg.textContent = "학번은 3으로 시작하는 숫자 5자리예요. (예: 30701)"; return; }
  if (!name) { msg.textContent = "이름을 입력하세요."; return; }
  if (!/^\d{6}$/.test(pin)) { msg.textContent = "비밀번호는 숫자 6자리로 입력하세요."; return; }
  if (confirming && $("#lkPin2").value.trim() !== pin) { msg.textContent = "두 비밀번호가 달라요. 다시 입력하세요."; $("#lkPin2").value = ""; $("#lkPin2").focus(); return; }
  $("#lkGo").disabled = true; msg.className = "msg"; msg.innerHTML = `<span class="spinner"></span>`;
  const r = await store.studentLogin(sid, name, pin, { create: confirming, icon: lkIcon });
  $("#lkGo").disabled = false;
  if (r.ok) {
    pref.lastSid = sid; pref.lastName = name; pref.lastIcon = lkIcon; savePref();
    $("#login").classList.remove("show", "confirming");
    await enterApp(sid, r.created);
    return;
  }
  if (r.code === "NEED_CONFIRM") {
    $("#login").classList.add("confirming"); msg.className = "msg";
    msg.innerHTML = "처음 로그인이거나 비밀번호가 틀렸어요.<br><b>처음이라면</b> 비밀번호를 한 번 더 입력하세요.";
    $("#lkPin2").value = ""; $("#lkPin2").focus(); return;
  }
  if (r.code === "WRONG_PIN" && confirming) { $("#login").classList.remove("confirming"); $("#lkPin").value = ""; }
  msg.className = "msg err"; msg.textContent = MSG[r.code] || MSG.UNKNOWN;
  if (r.code === "WRONG_PIN") $("#lkPin").focus();
});
$("#lkPin").addEventListener("input", () => { if ($("#login").classList.contains("confirming")) { $("#login").classList.remove("confirming"); $("#lkMsg").textContent = ""; } });

/* ---------------- profile ---------------- */
function paintProfile() {
  const p = S.profile || {}, a = animal(p.icon), sid = p.sid || "";
  [["#mAvatar", "#mName", "#mId"], ["#avatar", "#meName", "#meId"]].forEach(([av, n, i]) => {
    const el = $(av); el.classList.toggle("emoji", !!a); el.textContent = a ? a.e : (p.name ? p.name.slice(-2) : "?");
    el.style.background = a ? a.bg : "linear-gradient(145deg,#64a8ff,#0a6cff)";
    $(n).textContent = p.name || ""; $(i).textContent = sid ? `${sid.slice(0, 1)}학년 ${+sid.slice(1, 3)}반 ${+sid.slice(3)}번` : "";
  });
  $("#pId").textContent = sid || " "; $("#pNo").textContent = sid ? +sid.slice(3) : " "; $("#pName").textContent = p.name || " ";
}
let pick = "";
$("#iconPick").innerHTML = ANIMALS.map(a => `<button type="button" data-icon="${a.id}"><span class="e">${a.e}</span>${a.n}</button>`).join("");
$$("#iconPick button").forEach(b => b.onclick = () => { pick = b.dataset.icon; paintPick(); });
function paintPick() { $$("#iconPick button").forEach(b => b.classList.toggle("on", b.dataset.icon === pick)); const a = animal(pick); $("#psBig").textContent = a ? a.e : "🎵"; }
function openProfile() { pick = (S.profile && S.profile.icon) || ""; paintPick(); $("#profileSheet").classList.add("show"); }
$("#psCancel").onclick = () => $("#profileSheet").classList.remove("show");
$("#psOk").onclick = async () => {
  $("#profileSheet").classList.remove("show");
  S.profile.icon = pick; pref.lastIcon = pick; savePref(); paintProfile();
  try { await store.saveProfile(S.sid, { icon: pick }); } catch (e) { toast("저장하지 못했어요", "인터넷 연결을 확인하세요."); }
};

/* ---------------- library ---------------- */
async function enterApp(sid, created) {
  S.sid = sid; loading(true);
  try { S.profile = (await store.loadProfile(sid)) || { sid, name: pref.lastName || "", icon: lkIcon }; }
  catch (e) { S.profile = { sid, name: pref.lastName || "", icon: lkIcon }; }
  if (!S.profile.icon && lkIcon && created) S.profile.icon = lkIcon;
  S.stats = S.profile.stats || {};
  loading(false); paintProfile(); renderSongList(); renderLibrary();
  show("musicWin"); document.body.dataset.wall = "";
  setStatus(store.isLocal() ? "로컬 모드" : "☁︎ 동기화됨");
  if (created) toast(`환영해요, ${S.profile.name}!`, "앨범을 골라 학습을 시작하세요.");
}
function renderSongList() {
  $("#mSongs").innerHTML = SONGS.map(s => `<button class="song-mini" data-album="${s.id}"><span class="th" style="background:${s.cover.bg}">${s.cover.motif}</span><span class="lbl">${esc(s.title)}</span></button>`).join("");
}
function songStat(id) { return S.stats[id] || { pct: 0, score: 0, ok: 0, okTotal: 32, colored: 0, chars: 0 }; }
function renderLibrary() {
  $("#mTitle").textContent = "보관함"; $$("#musicWin [data-lib]").forEach(b => b.classList.toggle("active", b.dataset.lib === "albums"));
  const mi = musicIndexOf(SONGS, S.stats), L = levelOf(mi);
  const sum = k => SONGS.reduce((s, x) => s + (songStat(x.id)[k] || 0), 0);
  const doneSongs = SONGS.filter(x => songStat(x.id).pct >= 100).length;
  const next = L.next ? `다음 레벨 <b>${L.next[1]} ${L.next[2]}</b>까지 ${L.next[0] - mi}점 남았어요` : "최고 레벨이에요! 정말 멋져요 👏";
  const C = 2 * Math.PI * 52, dash = C * mi / 100;
  $("#lib").innerHTML = `
    <h2 class="big">안녕하세요, ${esc(S.profile.name || "")}님 👋</h2><div class="subt">오늘은 어떤 노래로 영어를 공부해 볼까요?</div>
    <section class="mq" id="mqCard">
      <div class="ringwrap"><svg viewBox="0 0 122 122"><circle cx="61" cy="61" r="52" fill="none" stroke="rgba(255,255,255,.25)" stroke-width="11"/>
        <circle cx="61" cy="61" r="52" fill="none" stroke="#fff" stroke-width="11" stroke-linecap="round" stroke-dasharray="${dash} ${C}" transform="rotate(-90 61 61)"/></svg>
        <div class="val"><div><b>${mi}</b><small>/ 100</small></div></div></div>
      <div><span class="lvl">${L.icon} Lv. ${L.name}</span><h3>나의 음악 지수</h3><div class="next">${next}</div>
        <div class="tiles">
          <div class="tile"><b>${doneSongs}<small style="font-size:12px;opacity:.8"> / ${SONGS.length}</small></b><span>완주한 앨범</span></div>
          <div class="tile"><b>${sum("ok")}<small style="font-size:12px;opacity:.8"> / ${sum("okTotal") || 96}</small></b><span>맞힌 어휘 문제</span></div>
          <div class="tile"><b>${sum("colored")}</b><span>색칠한 가사 줄</span></div>
          <div class="tile"><b>${sum("chars").toLocaleString()}</b><span>내가 쓴 글자 수</span></div>
        </div></div>
      <button class="how" data-act="score">점수 계산 방법</button>
    </section>
    <div class="shelf-h"><h3>앨범</h3><span>${SONGS.length}개의 앨범</span></div>
    <div class="albums">${SONGS.map(s => { const st = songStat(s.id);
      return `<button class="album" data-album="${s.id}">${coverHTML(s)}<div class="name">${esc(s.title)}</div><div class="art">${esc(s.album)}</div>
        <div class="pbar"><i style="width:${st.pct}%"></i></div><div class="pmeta"><span>${st.pct ? `${st.pct}% 완성` : "아직 시작 안 함"}</span><span>${st.score ? `${st.score}점` : ""}</span></div></button>`; }).join("")}</div>`;
}
function renderAlbum(id) {
  const s = songById(id), st = songStat(id), per = st.per || {};
  $("#mTitle").textContent = s.title; $$("#musicWin [data-lib]").forEach(b => b.classList.remove("active"));
  $("#lib").innerHTML = `<button class="back" data-act="lib">‹ 보관함</button>
    <div class="detail">${coverHTML(s, false)}
      <div class="meta"><div class="no">${esc(s.no.toUpperCase())}</div><h2>${esc(s.title)}</h2><div class="from">${esc(s.from)}</div>
        <div class="stat">9단계 · ${st.pct ? `${st.pct}% 완성 · ${st.score}점` : "아직 시작 안 함"}</div>
        <div class="acts"><button class="pill red" data-open="${id}" data-sec="${st.sec || "A"}">▶ ${st.started ? "이어서 하기" : "학습 시작"}</button>
          ${st.started ? `<button class="pill soft" data-open="${id}" data-sec="A">처음 단계부터</button>` : ""}</div>
        <div class="tracks">${STEPS.map((t, i) => { const p = per[t.id];
          const stx = p ? (p[0] === p[1] ? `<span class="st done">✓ 완료</span>` : `<span class="st">${p[0]}/${p[1]}</span>`) : `<span class="st">—</span>`;
          return `<button class="track" data-open="${id}" data-sec="${t.id}"><span class="n">${i + 1}</span><span class="tt">${esc(t.title)}<small>${esc(t.desc || "나만의 문장 만들기")}</small></span>${stx}</button>`; }).join("")}</div>
      </div></div>`;
  $("#mContent").scrollTop = 0;
}
function openScore() {
  $("#brk").innerHTML = `<tr><td><b>곡</b></td><td>완성도</td><td>정답</td><td>감상</td><td>점수</td></tr>` + SONGS.map(s => { const st = songStat(s.id);
    return `<tr><td>${s.cover.motif} ${esc(s.title)}</td><td>${Math.round((st.pct || 0) / 2)}</td><td>${Math.round((st.acc || 0) * .3)}</td><td>${Math.round((st.reflect || 0) / 5)}</td><td>${st.score || 0}</td></tr>`; }).join("");
  $("#levels").innerHTML = LEVELS.map(l => `<div><b>${l[1]}</b>${l[2]}<br>${l[0]}점~</div>`).join("");
  $("#scoreSheet").classList.add("show");
}
$("#scOk").onclick = () => $("#scoreSheet").classList.remove("show");

/* ---------------- worksheet ---------------- */
async function openSong(id, sec = "A") {
  const s = songById(id); loading(true, "학습지를 여는 중…");
  let answers = {}, lyrics = "";
  try { [answers, lyrics] = await Promise.all([store.loadSong(S.sid, id), store.loadLyrics(id)]); }
  catch (e) { toast("불러오지 못했어요", "인터넷 연결을 확인하세요."); }
  loading(false);
  S.song = s; S.A = answers || {}; S.dirty = false;
  document.body.dataset.wall = s.theme;
  const ns = $("#nowsong"); ns.innerHTML = `<div class="th" style="background:${s.cover.bg}">${s.cover.motif}</div><div><div class="t">${esc(s.title)}</div><div class="s">${esc(s.no)}</div></div>`;
  S.ws = mountWorksheet(s, { A: S.A, lyricsText: lyrics, onChange: queueSave });
  paintProfile(); show("wsWin"); $("#search").value = ""; go(sec);
}
function go(id) {
  if (!STEPS.some(s => s.id === id)) id = "A";
  S.sec = id;
  $$("#sections .sec").forEach(x => x.classList.toggle("show", x.dataset.sec === id));
  $$("#nav button").forEach(b => b.classList.toggle("active", b.dataset.go === id));
  const i = STEPS.findIndex(s => s.id === id);
  $("#tbTitle").textContent = STEPS[i].title;
  $("#back").disabled = i === 0; $("#fwd").disabled = i === STEPS.length - 1;
  $("#wsWin .main").classList.toggle("f-mode", id === "F");
  $("#content").style.scrollBehavior = "auto"; $("#content").scrollTop = 0; $("#content").style.scrollBehavior = "";
  queueSave(true);
}
const step = d => { const i = STEPS.findIndex(s => s.id === S.sec), n = STEPS[i + d]; if (n) go(n.id); };
$("#back").onclick = () => step(-1); $("#fwd").onclick = () => step(1);

let saveT = null;
function queueSave(quiet) {
  if (!S.song) return;
  S.dirty = true; if (!quiet) setStatus("저장 중…");
  clearTimeout(saveT); saveT = setTimeout(flush, quiet ? 2500 : 1200);
}
async function flush() {
  clearTimeout(saveT);
  if (!S.song || !S.dirty) return;
  S.dirty = false;
  const st = S.ws.stats(), id = S.song.id;
  const lite = { pct: st.pct, acc: st.acc, reflect: st.reflect, score: st.score, ok: st.ok, okTotal: st.okTotal, chars: st.chars, colored: st.colored, per: st.per, started: st.started, sec: S.sec, at: Date.now() };
  S.stats[id] = lite;
  const mi = musicIndexOf(SONGS, S.stats);
  try { await store.saveSong(S.sid, id, JSON.parse(JSON.stringify(S.A)), lite, mi); setStatus(store.isLocal() ? "✓ 이 기기에 저장됨" : "☁︎ 저장됨"); }
  catch (e) { console.error(e); S.dirty = true; setStatus("⚠ 저장 실패 · 다시 시도 중"); clearTimeout(saveT); saveT = setTimeout(flush, 5000); }
}
window.addEventListener("beforeunload", e => { if (S.dirty) { flush(); e.preventDefault(); e.returnValue = ""; } });
document.addEventListener("visibilitychange", () => { if (document.hidden) flush(); });

async function goHome() {
  if (S.song) await flush();
  S.song = null; document.body.dataset.wall = ""; renderLibrary(); show("musicWin"); $("#mContent").scrollTop = 0;
}

function doPrint() {
  if (!S.song) return;
  $$("[data-pv]").forEach(d => { const t = $(`textarea[data-k="${d.dataset.pv}"]`); d.textContent = t ? t.value : ""; });
  const old = document.title; document.title = `${S.sid}_${S.profile.name}_${S.song.title.replace(/[^A-Za-z0-9]+/g, "")}`;
  toast("PDF로 저장하기", "인쇄 창의 ‘대상’에서 ‘PDF로 저장’을 고르세요.", 3500);
  setTimeout(() => { window.print(); document.title = old; }, 350);
}
window.addEventListener("beforeprint", () => $$("[data-pv]").forEach(d => { const t = $(`textarea[data-k="${d.dataset.pv}"]`); d.textContent = t ? t.value : ""; }));

/* ---------------- global events ---------------- */
function act(a) {
  if (a === "print") doPrint();
  else if (a === "home" || a === "lib") goHome();
  else if (a === "profile") { if (S.sid) openProfile(); }
  else if (a === "theme") { pref.theme = pref.theme === "dark" ? "light" : "dark"; savePref(); applyTheme(); }
  else if (a === "prev") step(-1);
  else if (a === "next") step(1);
  else if (a === "score") openScore();
  else if (a === "logout") confirmBox("로그아웃할까요?", "다음에 같은 학번·이름·비밀번호로 다시 로그인하면 이어서 할 수 있어요.", async () => { await flush(); await store.logout(); S.sid = null; S.song = null; showLogin(); });
  else if (a === "reset" && S.song) confirmBox(`'${S.song.title}' 답을 모두 지울까요?`, "이 곡에서 쓴 답과 정답 확인 기록이 모두 사라지고 되돌릴 수 없어요.", async () => {
    Object.keys(S.A).forEach(k => delete S.A[k]); S.dirty = true; await flush(); openSong(S.song.id, "A"); });
}
document.addEventListener("click", e => {
  const g = e.target.closest("[data-go]"); if (g) { go(g.dataset.go); return; }
  const o = e.target.closest("[data-open]"); if (o) { openSong(o.dataset.open, o.dataset.sec); return; }
  const al = e.target.closest("[data-album]"); if (al) { renderAlbum(al.dataset.album); return; }
  const lb = e.target.closest("[data-lib]"); if (lb) { renderLibrary(); if (lb.dataset.lib === "mq") $("#mqCard").scrollIntoView({ behavior: "smooth", block: "start" }); else $("#mContent").scrollTop = 0; return; }
  const a = e.target.closest("[data-act]"); if (a) { closeMenus(); act(a.dataset.act); return; }
  const m = e.target.closest("[data-menu]"); if (m) { const open = m.classList.contains("open"); closeMenus(); if (!open) m.classList.add("open"); return; }
  closeMenus();
});
$$("[data-menu]").forEach(m => m.addEventListener("mouseenter", () => { if ($(".mi.open") && !m.classList.contains("open")) { closeMenus(); m.classList.add("open"); } }));
function closeMenus() { $$(".mi.open").forEach(m => m.classList.remove("open")); }
document.addEventListener("keydown", e => {
  if (!document.body.classList.contains("in-ws")) return;
  if (e.altKey && e.key === "ArrowRight") { e.preventDefault(); step(1); }
  if (e.altKey && e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
  if (e.key === "Escape") closeMenus();
});
$("#search").addEventListener("input", e => {
  const q = e.target.value.trim().toLowerCase();
  $$("#nav button").forEach(b => b.classList.toggle("hide", !!q && !b.dataset.label.toLowerCase().includes(q)));
  $$("#nav .grp").forEach(g => g.style.display = q ? "none" : "");
});

/* ---------------- boot ---------------- */
(async function boot() {
  applyTheme(); tick(); setInterval(tick, 15000);
  const r = await store.initStore();
  if (r.local) $("#localBadge").innerHTML = `<span class="offline-badge" title="Firebase가 연결되지 않아 이 기기에만 저장돼요">로컬 모드</span>`;
  const sid = await store.waitForSession();
  if (sid) await enterApp(sid); else showLogin();
})();
