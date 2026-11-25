/* =====================================================================
   감상 어휘 분석 — 우리 반이 감상 쓰기(A·G·H·I)에 쓴 단어를 모아 탐구
   - 공유되는 것: 단어별 개수, 고른 기분 단어, '마음에 남는 한 줄'(가사)뿐
   - 학생이 쓴 문장 자체는 공유하지 않습니다.
   ===================================================================== */
import { $, $$, esc } from "./worksheet.js?v=20261125a";

/* ---------- 단어 추출 ---------- */
const EN_STOP = new Set(("a an the and or but so if then than that this these those it its it's i i'm im me my mine you your " +
  "he she him her his they them their we us our is am are was were be been being do does did done have has had " +
  "to of in on at by for with from as about into up out over just very really too also not no yes can could will would " +
  "should may might must there here what when where who why how which all some any more most much many one two " +
  "song songs thing things learn learned learnt feel feels felt think thought like get got go going make made know dont don't didn't im it's 's").split(/\s+/));
const KO_STOP = new Set(["그리고", "그래서", "하지만", "그런데", "그냥", "너무", "정말", "진짜", "아주", "매우", "조금", "많이", "약간",
  "이번", "이런", "그런", "저런", "어떤", "무슨", "이것", "그것", "저것", "우리", "나는", "내가", "제가", "저는", "같다", "같은", "같아",
  "같았다", "있다", "있는", "있었다", "없다", "없는", "했다", "하는", "하고", "해서", "했고", "된다", "되는", "됐다", "것이", "것을",
  "것은", "느낌", "느낌이", "생각", "생각이", "생각했다", "노래", "노래를", "노래가", "노래는", "가사", "가사를", "가사가", "가사는", "부분"]);
const KO_VERB = /(다|요|서|고|면|데|지만|니까|어서|아서|는지|었|았|겠)$/;
const KO_JOSA = /(이랑|에서|에게|한테|까지|부터|처럼|보다|으로|이라|이다|에는|에도|와|과|은|는|이|가|을|를|의|에|도|로|만|랑)$/;

export function wordsOf(text) {
  const out = {};
  const add = w => { out[w] = (out[w] || 0) + 1; };
  const t = String(text || "").toLowerCase();
  (t.match(/[a-z][a-z']*/g) || []).forEach(w => { w = w.replace(/'s$|'$/, ""); if (w.length >= 3 && !EN_STOP.has(w)) add(w); });
  (t.match(/[가-힣]+/g) || []).forEach(w => {
    if (KO_STOP.has(w)) return;
    if (KO_VERB.test(w)) return;              // 동사·형용사 활용형(났다, 생각나서 …)은 빼고 명사·꾸밈말 위주로
    const s = w.length > 2 ? w.replace(KO_JOSA, "") : w;
    if (s.length >= 2 && !KO_STOP.has(s)) add(s);
  });
  return out;
}
const merge = (a, b) => { Object.entries(b).forEach(([k, v]) => { a[k] = (a[k] || 0) + v; }); return a; };

export const BEFORE_KEYS = ["A.feel"];
export const AFTER_KEYS = ["G.1", "G.2", "G.3", "H.new", "H.diff", "H.why", "I.a", "I.b"];

/* 답안 → 공유용 요약 (문장은 넣지 않음) */
export function summarize(A) {
  const wb = BEFORE_KEYS.reduce((m, k) => merge(m, wordsOf(A[k])), {});
  const wa = AFTER_KEYS.reduce((m, k) => merge(m, wordsOf(A[k])), {});
  const line = String(A["H.line"] || "").trim().slice(0, 160);
  return { wb, wa, mb: Array.isArray(A["A.mood"]) ? A["A.mood"].slice(0, 2) : [], ma: Array.isArray(A["H.mood"]) ? A["H.mood"].slice(0, 2) : [], line };
}
export const hasContent = s => Object.keys(s.wb).length + Object.keys(s.wa).length + s.mb.length + s.ma.length > 0 || !!s.line;

/* ---------- 화면 ---------- */
const QUESTIONS = [
  "① 우리 반이 가장 많이 쓴 단어 3개는 무엇인가요? 왜 이 단어들이 많이 나왔을까요?",
  "② 처음 감상(A)과 공부한 뒤(G·H·I)에 자주 나온 단어는 어떻게 달라졌나요? 그 이유를 가사와 연결해 써 보세요.",
  "③ 친구들은 쓰지 않았지만 내가 쓴 단어 하나를 골라, 그 단어를 쓴 이유를 영어 한 문장으로 써 보세요."
];
const normLine = s => s.toLowerCase().replace(/[^a-z0-9가-힣\s']/g, "").replace(/\s+/g, " ").trim();

/* ctx: { songs, sid, explore, load(songIds) → Promise<[{sid,song,...summary}]>, saveExplore(key, text) } */
export function mountInsight(root, ctx) {
  const V = { song: "all", phase: "all", word: null, mine: true, rows: [], loadedFor: null };

  async function load() {
    const ids = V.song === "all" ? ctx.songs.map(s => s.id) : [V.song];
    root.querySelector(".ins-body").innerHTML = `<div class="ins-empty"><span class="spinner dark"></span> 우리 반 단어를 모으는 중…</div>`;
    try { V.rows = await ctx.load(ids); } catch (e) { console.error(e); V.rows = null; }
    V.loadedFor = V.song; V.word = null; paint();
  }

  function aggregate() {
    const rows = V.rows || [];
    const words = {}, people = {}, perSong = {}, moodB = {}, moodA = {}, lines = {}, my = {};
    const students = new Set();
    rows.forEach(r => {
      const w = V.phase === "before" ? r.wb : V.phase === "after" ? r.wa : merge(merge({}, r.wb || {}), r.wa || {});
      if (Object.keys(w || {}).length || (r.mb || []).length || (r.ma || []).length || r.line) students.add(r.sid);
      Object.entries(w || {}).forEach(([k, v]) => {
        words[k] = (words[k] || 0) + v;
        (people[k] = people[k] || new Set()).add(r.sid);
        perSong[k] = perSong[k] || {}; perSong[k][r.song] = (perSong[k][r.song] || 0) + v;
        if (r.sid === ctx.sid) my[k] = (my[k] || 0) + v;
      });
      (r.mb || []).forEach(m => { moodB[m] = (moodB[m] || 0) + 1; });
      (r.ma || []).forEach(m => { moodA[m] = (moodA[m] || 0) + 1; });
      if (r.line) { const n = normLine(r.line); if (n) { lines[n] = lines[n] || { text: r.line, n: 0, song: r.song, mine: false }; lines[n].n++; if (r.sid === ctx.sid) lines[n].mine = true; } }
    });
    return { words, people, perSong, moodB, moodA, lines, my, n: students.size };
  }

  function paint() {
    const body = root.querySelector(".ins-body");
    if (V.rows === null) { body.innerHTML = `<div class="ins-empty">불러오지 못했어요. 인터넷 연결을 확인하거나 선생님께 알려 주세요.</div>`; return; }
    const G = aggregate();
    const list = Object.keys(G.words).map(w => ({ w, c: G.words[w], p: G.people[w].size }))
      .sort((a, b) => b.p - a.p || b.c - a.c || a.w.localeCompare(b.w));
    const top = list.slice(0, 60), max = top.length ? top[0].p : 1;
    const songOf = id => ctx.songs.find(s => s.id === id);

    // 단어 구름 (쓴 친구 수 기준 크기, 순서는 섞어서 보기 좋게)
    const cloud = top.map((x, i) => ({ ...x, i })).sort((a, b) => ((a.i * 7919) % 61) - ((b.i * 7919) % 61)).map(x => {
      const r = x.p / max, size = 13 + Math.round(r * 30), mine = V.mine && G.my[x.w];
      return `<button class="ins-w${mine ? " mine" : ""}${V.word === x.w ? " on" : ""}" data-word="${esc(x.w)}" style="font-size:${size}px;opacity:${(.55 + r * .45).toFixed(2)}" title="친구 ${x.p}명 · ${x.c}번">${esc(x.w)}</button>`;
    }).join("");

    // 선택한 단어 자세히
    let detail = `<div class="ins-hint">👆 단어를 누르면 몇 명이 썼는지, 어느 곡에서 나왔는지 볼 수 있어요.</div>`;
    if (V.word && G.words[V.word]) {
      const ps = G.perSong[V.word];
      detail = `<div class="ins-detail"><b>“${esc(V.word)}”</b> — 친구 <b>${G.people[V.word].size}명</b>이 모두 <b>${G.words[V.word]}번</b> 썼어요.
        ${G.my[V.word] ? `<span class="tag mine">나도 ${G.my[V.word]}번 씀</span>` : `<span class="tag">나는 안 씀</span>`}
        <div class="ins-songs">${Object.entries(ps).map(([id, v]) => { const s = songOf(id); return s ? `<span>${s.cover.motif} ${esc(s.title)} <b>${v}</b></span>` : ""; }).join("")}</div></div>`;
    }

    // Top 10
    const top10 = list.slice(0, 10).map((x, i) => `<div class="ins-bar"><span class="rk">${i + 1}</span><button class="lbl" data-word="${esc(x.w)}">${esc(x.w)}</button>
      <span class="track"><i style="width:${Math.round(x.p / max * 100)}%"></i></span><span class="v">${x.p}명</span></div>`).join("");

    // 나만 쓴 단어
    const onlyMe = Object.keys(G.my).filter(w => G.people[w] && G.people[w].size === 1).slice(0, 12);

    // 기분 변화
    const moods = [...new Set([...Object.keys(G.moodB), ...Object.keys(G.moodA)])]
      .sort((a, b) => ((G.moodA[b] || 0) + (G.moodB[b] || 0)) - ((G.moodA[a] || 0) + (G.moodB[a] || 0)));
    const mMax = Math.max(1, ...moods.map(m => Math.max(G.moodB[m] || 0, G.moodA[m] || 0)));
    const moodRows = moods.map(m => { const b = G.moodB[m] || 0, a = G.moodA[m] || 0, d = a - b;
      return `<div class="ins-mood"><span class="m">${esc(m)}</span>
        <span class="pair"><span class="track"><i class="b" style="width:${b / mMax * 100}%"></i></span><span class="track"><i class="a" style="width:${a / mMax * 100}%"></i></span></span>
        <span class="nums">${b} → ${a}</span><span class="d ${d > 0 ? "up" : d < 0 ? "down" : ""}">${d > 0 ? "▲" + d : d < 0 ? "▼" + (-d) : "–"}</span></div>`; }).join("");

    // 마음에 남는 한 줄
    const lines = Object.values(G.lines).sort((a, b) => b.n - a.n).slice(0, 5);

    const key = V.song;
    body.innerHTML = `
      <div class="ins-meta">참여한 친구 <b>${G.n}명</b> · 서로 다른 단어 <b>${list.length}개</b>${V.song === "all" ? " · 세 곡 전체" : ""}</div>
      ${G.n === 0 ? `<div class="ins-empty">아직 모인 단어가 없어요. 학습지의 감상 쓰기(A·G·H·I)를 채우면 여기에 나타나요.</div>` : `
      <section class="ins-card">
        <div class="ins-h"><h3>☁️ 우리 반 단어 구름</h3>
          <div class="seg-s">${[["all", "전체"], ["before", "처음 감상 (A)"], ["after", "공부한 뒤 (G·H·I)"]].map(([v, l]) => `<button data-phase="${v}" class="${V.phase === v ? "on" : ""}">${l}</button>`).join("")}</div></div>
        <p class="ins-sub">글자가 클수록 <b>더 많은 친구가</b> 쓴 단어예요. <label class="ck"><input type="checkbox" id="insMine" ${V.mine ? "checked" : ""}> 내가 쓴 단어 <span class="mine-dot"></span> 표시</label></p>
        <div class="ins-cloud">${cloud || `<span class="ins-hint">이 구간에는 아직 단어가 없어요.</span>`}</div>
        ${detail}
      </section>
      <div class="ins-grid">
        <section class="ins-card"><h3>🏆 많이 쓴 단어 Top 10</h3><p class="ins-sub">쓴 친구 수 기준</p>${top10 || `<div class="ins-hint">—</div>`}
          <div class="ins-only"><b>나만 쓴 단어</b> ${onlyMe.length ? onlyMe.map(w => `<button class="tag mine" data-word="${esc(w)}">${esc(w)}</button>`).join("") : `<span class="ins-hint">없어요 — 나만의 표현을 더 써 볼까요?</span>`}</div></section>
        <section class="ins-card"><h3>🎭 기분은 어떻게 바뀌었을까?</h3>
          <p class="ins-sub"><span class="lg b"></span> 처음 들었을 때 (A) &nbsp; <span class="lg a"></span> 가사를 배운 뒤 (H) · 고른 친구 수</p>
          ${moodRows || `<div class="ins-hint">아직 고른 기분 단어가 없어요.</div>`}</section>
      </div>
      <section class="ins-card"><h3>💬 우리 반 마음에 남는 한 줄</h3><p class="ins-sub">H단계에서 고른 가사 한 줄 · 같은 줄을 고른 친구 수</p>
        ${lines.length ? `<ol class="ins-lines">${lines.map(l => { const s = songOf(l.song); return `<li class="${l.mine ? "mine" : ""}"><span class="q">“${esc(l.text)}”</span><span class="who">${V.song === "all" && s ? s.cover.motif + " " : ""}${l.n}명${l.mine ? " · 나도 골랐어요" : ""}</span></li>`; }).join("")}</ol>` : `<div class="ins-hint">아직 없어요.</div>`}
      </section>`}
      <section class="ins-card explore"><h3>🔍 탐구 질문</h3><p class="ins-sub">위 자료를 보고 답해 보세요. 답은 나와 선생님만 볼 수 있어요.</p>
        ${QUESTIONS.map((q, i) => `<div class="ins-q"><div class="k">${q}</div><textarea class="area" data-ex="${i}" rows="2">${esc(((ctx.explore[key] || {})[i]) || "")}</textarea></div>`).join("")}
        <div class="ins-save"><span id="insSaved"></span><button class="pill" id="insSave">답 저장하기</button></div>
      </section>`;

    $$("[data-word]", body).forEach(b => b.onclick = () => { V.word = V.word === b.dataset.word ? null : b.dataset.word; paint(); if (V.word) root.querySelector(".ins-cloud").scrollIntoView({ behavior: "smooth", block: "center" }); });
    $$("[data-phase]", body).forEach(b => b.onclick = () => { V.phase = b.dataset.phase; V.word = null; paint(); });
    const mine = $("#insMine", body); if (mine) mine.onchange = () => { V.mine = mine.checked; paint(); };
    $("#insSave", body).onclick = async () => {
      const ans = {}; $$("[data-ex]", body).forEach(t => { ans[t.dataset.ex] = t.value.trim(); });
      $("#insSaved", body).textContent = "저장 중…";
      try { await ctx.saveExplore(key, ans); ctx.explore[key] = ans; $("#insSaved", body).textContent = "✓ 저장했어요"; }
      catch (e) { $("#insSaved", body).textContent = "⚠ 저장하지 못했어요"; }
    };
  }

  root.innerHTML = `<h2 class="big">감상 어휘 분석 🔎</h2>
    <div class="subt">우리 반 친구들이 감상 쓰기(A·G·H·I)에 쓴 <b>단어</b>를 모아 봤어요. 문장은 공유되지 않고, 누가 썼는지도 보이지 않아요.</div>
    <div class="ins-tabs">${[{ id: "all", t: "세 곡 전체", m: "🎵" }, ...ctx.songs.map(s => ({ id: s.id, t: s.title, m: s.cover.motif }))]
      .map(s => `<button data-song="${s.id}" class="${V.song === s.id ? "on" : ""}">${s.m} ${esc(s.t)}</button>`).join("")}</div>
    <div class="ins-body"></div>`;
  $$("[data-song]", root).forEach(b => b.onclick = () => { V.song = b.dataset.song; $$("[data-song]", root).forEach(x => x.classList.toggle("on", x === b)); load(); });
  load();
}
