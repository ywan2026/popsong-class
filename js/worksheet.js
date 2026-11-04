/* =====================================================================
   학습지(A~I) 렌더링·입력·정답 확인 + 점수 계산
   ===================================================================== */
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const STEP_COLORS = ["#ff9f0a", "#0a84ff", "#5e5ce6", "#30b0c7", "#ff375f", "#ff6b22", "#34c759", "#bf5af2", "#ac8e68"];
export const STEPS = [
  { id: "A", group: "Before", title: "A. 첫 감상 · 느낌 쓰기", short: "첫 감상", desc: "가사를 배우기 전, 노래만 듣고 느낀 점을 써 봅시다." },
  { id: "B", group: "어휘 · 문법", title: "B. 어휘 뜻 익히기", short: "어휘 뜻", desc: "빈칸에 우리말 뜻을 쓰세요." },
  { id: "C", group: "어휘 · 문법", title: "C. 영영 풀이", short: "영영 풀이", desc: "영영 풀이에 알맞은 단어를 <보기>에서 찾아 쓰세요." },
  { id: "D", group: "어휘 · 문법", title: "D. 철자로 문장 완성", short: "철자 문장", desc: "자연스러운 문장이 되도록 주어진 철자로 시작하는 단어를 쓰세요." },
  { id: "E", group: "어휘 · 문법", title: "E. 문법 정리 및 연습", short: "문법 2가지", desc: "노래 속 문법 두 가지를 정리하고 연습해 봅시다." },
  { id: "F", group: "가사", title: "F. 가사 이해 · 색칠하기", short: "가사 색칠", desc: "구간별로 가사를 색칠하고, 해석의 빈칸을 채워 봅시다. (둘 중 고르기 · 초성 보고 쓰기)" },
  { id: "G", group: "가사", title: "G. 이해 질문", short: "이해 질문", desc: "가사의 내용을 생각하며 답해 봅시다." },
  { id: "H", group: "After", title: "H. 다시 듣고 느낌 쓰기", short: "다시 감상", desc: "가사를 배운 뒤, 색칠한 가사를 따라가며 다시 들어 봅시다." },
  { id: "I", group: "After", title: "I. 마무리 · 나의 한 문장", short: "나의 한 문장", desc: "" }];

/* ---------- lyrics ---------- */
export function parseLyrics(txt) {
  const out = [], hasKo = s => /[가-힣]/.test(s);
  let expectNew = true;
  (txt || "").split(/\r?\n/).forEach(raw => {
    let l = raw.replace(/ /g, " ").trim();
    if (!l || l.startsWith("//") || l.startsWith("#")) return;
    if (/^\d{1,3}[.)]?$/.test(l)) { expectNew = true; return; }
    l = l.replace(/^\d{1,3}(\s*[\t.)\]]\s*|\s+)/, "").trim();
    if (/\t|\|/.test(l)) { const p = l.split(/\t+|\s*\|\s*/); out.push({ en: p[0].trim(), ko: p.slice(1).join(" ").trim() }); expectNew = true; return; }
    const last = out[out.length - 1];
    if (hasKo(l) && last && !hasKo(last.en)) { last.ko = last.ko ? last.ko + " " + l : l; expectNew = true; return; }
    if (!expectNew && last && !hasKo(l) && !last.ko) { last.en += " " + l; return; }
    out.push({ en: l, ko: "" }); expectNew = false;
  });
  return out;
}

/* ---------- answer checking ---------- */
const stemKo = w => {
  let x = w.replace(/[\s.·'"!?()]/g, "");
  if (x.startsWith("~")) x = x.slice(1).replace(/^(에게|의|에|을|를|와|과|이|가)/, "");
  x = x.replace(/~/g, "");
  return x.replace(/(하다|하는|했다|한다|합니다|해요|한|해|함|다|인|의|은|는|음|운|에)$/, "");
};
const low = v => v.trim().toLowerCase().replace(/[.\s]+$/, "").replace(/\s+/g, " ");
export const checkers = song => ({
  B: [song.vocab.length, (i, v) => { const ok = new Set(song.keyB[i].map(stemKo)); return v.split(/[,/;]|또는/).map(stemKo).filter(Boolean).some(x => ok.has(x)); }],
  C: [song.keyC.length, (i, v) => low(v) === song.keyC[i]],
  D: [song.keyD.length, (i, v) => { const a = song.keyD[i], x = low(v); return x === a || (song.sents[i][1] + x) === a; }]
});

/* ---------- keys & stats ---------- */
export function fieldKeys(song, hasLyrics) {
  const k = { A: ["A.mood", "A.feel"], B: song.vocab.map((_, i) => "B." + i), C: song.keyC.map((_, i) => "C." + i), D: song.keyD.map((_, i) => "D." + i), E: [], F: [], G: ["G.1", "G.2", "G.3"], H: ["H.mood", "H.new", "H.diff", "H.line", "H.why"], I: ["I.a", "I.b"] };
  song.grammar.forEach((g, gi) => { let n = 0; g.a.forEach(t => { if (Array.isArray(t)) k.E.push(`E.${gi + 1}s${n++}`); }); k.E.push(`E.${gi + 1}b`); });
  k.F = hasLyrics ? song.blanks.map((_, j) => "F.b" + j).concat(["F.colors"]) : [1, 2, 3, 4].map(n => "F.range" + n);
  return k;
}
export const filled = (k, v, linesN) => {
  if (k === "F.colors") return v && typeof v === "object" && Object.keys(v).length >= Math.ceil((linesN || 1) * 0.8);
  return Array.isArray(v) ? v.length >= 2 : (v != null && String(v).trim() !== "");
};
export function computeStats(song, A, hasLyrics, linesN) {
  const keys = fieldKeys(song, hasLyrics); let total = 0, done = 0; const per = {};
  Object.entries(keys).forEach(([sec, ks]) => { const d = ks.filter(k => filled(k, A[k], linesN)).length; per[sec] = [d, ks.length]; total += ks.length; done += d; });
  const ckTotal = song.vocab.length + song.keyC.length + song.keyD.length;
  const ok = Object.keys(A).filter(k => k.startsWith("ok.") && A[k]).length;
  const refl = ["A", "G", "H", "I"].reduce((s, x) => s + per[x][0], 0), reflT = ["A", "G", "H", "I"].reduce((s, x) => s + per[x][1], 0);
  const pct = total ? done / total : 0, acc = ok / ckTotal, rf = reflT ? refl / reflT : 0;
  const chars = ["A.feel", "G.1", "G.2", "G.3", "H.new", "H.diff", "H.line", "H.why", "I.a", "I.b"].reduce((s, k) => s + String(A[k] || "").trim().length, 0);
  const colored = A["F.colors"] && typeof A["F.colors"] === "object" ? Object.keys(A["F.colors"]).length : 0;
  return { pct: Math.round(pct * 100), acc: Math.round(acc * 100), reflect: Math.round(rf * 100), score: Math.round(50 * pct + 30 * acc + 20 * rf), ok, okTotal: ckTotal, chars, colored, per, done, total, started: done > 0 };
}
export const LEVELS = [[0, "🎧", "리스너"], [25, "🎵", "플레이어"], [50, "🎤", "싱어"], [75, "🌟", "스타"], [90, "👑", "레전드"]];
export const levelOf = n => { let L = LEVELS[0], next = null; LEVELS.forEach((l, i) => { if (n >= l[0]) { L = l; next = LEVELS[i + 1] || null; } }); return { icon: L[1], name: L[2], min: L[0], next }; };
export const musicIndexOf = (songs, statsMap) => Math.round(songs.reduce((s, x) => s + ((statsMap[x.id] && statsMap[x.id].score) || 0), 0) / songs.length);

/* ---------- blanks in lyrics ---------- */
const CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
const chosung = w => [...w].map(c => { const n = c.charCodeAt(0) - 0xAC00; return (n >= 0 && n < 11172) ? CHO[Math.floor(n / 588)] : c; }).join("");
function enHTML(song, no, en) {
  let h = esc(en);
  song.blanks.filter(b => b.line === no && b.en).forEach(b => {
    const re = new RegExp("\\b(" + esc(b.en).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")\\b", "i");
    h = h.replace(re, `<mark class="kw">$1</mark>`);
  });
  return h;
}
function koHTML(song, no, ko) {
  const bs = song.blanks.map((b, j) => ({ ...b, j })).filter(b => b.line === no && b.ko && ko.includes(b.ko));
  if (!bs.length) return esc(ko);
  let pos = 0, out = "";
  bs.map(b => ({ ...b, at: ko.indexOf(b.ko) })).sort((a, b) => a.at - b.at).forEach(b => {
    if (b.at < pos) return;
    out += esc(ko.slice(pos, b.at));
    const k = `F.b${b.j}`;
    if (b.type === "choice") {
      const o = b.opts.slice(0, 2), shown = ((b.line + b.j) % 2) ? o : [o[1], o[0]];
      out += `<span class="seg bl" data-seg="${k}">${shown.map(v => `<button data-v="${esc(v)}">${esc(v)}</button>`).join("")}</span>`;
    } else {
      const c = chosung(b.ko);
      out += `<span class="cho"><input class="field" data-k="${k}" placeholder="${esc(c)}" autocomplete="off" spellcheck="false" style="width:${Math.max(4, [...b.ko].length * 1.15 + 1.6)}em"><span class="cho-h">${esc(c)}</span></span>`;
    }
    pos = b.at + b.ko.length;
  });
  return out + esc(ko.slice(pos));
}

/* ---------- mount ---------- */
/* ctx: { A, lyricsText, onChange(), sec, onSec(id) } */
export function mountWorksheet(song, ctx) {
  const A = ctx.A, LYR = parseLyrics(ctx.lyricsText), hasL = LYR.length > 0;
  const ta = (k, ph = "", rows = 3) => `<textarea class="area" data-k="${k}" rows="${rows}" placeholder="${esc(ph)}"></textarea><div class="pv" data-pv="${k}"></div>`;
  const fi = (k, ph = "", cls = "") => `<input class="field ${cls}" data-k="${k}" placeholder="${esc(ph)}" autocomplete="off" spellcheck="false">`;
  const seg = (k, opts) => `<span class="seg" data-seg="${k}">${opts.map(o => `<button data-v="${esc(o)}">${esc(o)}</button>`).join("")}</span>`;
  const moodBlock = pfx => `<div class="gtitle">기분 · 노래를 들으며 느낀 기분 단어 2개를 고르세요</div>
    <div class="group"><div class="row"><div class="chips" data-mood="${pfx}">${song.moods.map(m => `<button class="chip" data-m="${m}">${m}</button>`).join("")}</div>
    <div class="picked" id="${pfx}-picked"></div></div></div>`;
  const checkBar = id => `<div class="checkbar no-print" id="cb-${id}"><svg class="ring" viewBox="0 0 36 36"><circle cx="18" cy="18" r="15" fill="none" stroke="var(--line)" stroke-width="4"/><circle class="arc" cx="18" cy="18" r="15" fill="none" stroke="#34c759" stroke-width="4" stroke-linecap="round" stroke-dasharray="0 100" transform="rotate(-90 18 18)" pathLength="100"/></svg>
    <div class="res" id="res-${id}">다 풀었으면 정답을 확인해 보세요. 틀린 문제는 지워지니 다시 채워 넣으세요.</div>
    <button class="pill" data-check="${id}">정답 확인하기</button></div>`;

  const body = {
    A: () => `${moodBlock("A")}<div class="gtitle">느낌 · 이 노래를 듣고 어떤 생각이나 장면이 떠올랐나요?</div>
      <div class="group"><div class="row">${ta("A.feel", "우리말 또는 영어로 2~3문장", 4)}</div></div>`,
    B: () => { const n = song.vocab.length, rows = Math.ceil(n / 3), order = []; for (let r = 0; r < rows; r++) for (let c = 0; c < 3; c++) { const i = c * rows + r; if (i < n) order.push(i); }
      return `<div class="gtitle">English → Korean</div><div class="group"><div class="vgrid">${order.map(i => `<div class="vcell"><span class="num">${i + 1}</span><span class="w">${esc(song.vocab[i])}</span>${fi("B." + i, "뜻")}</div>`).join("")}</div></div>${checkBar("B")}`; },
    C: () => `<div class="gtitle">&lt;보기&gt; — 쓴 단어는 흐리게 표시돼요</div>
      <div class="group"><div class="row"><div class="chips" id="bank">${song.bank.map(w => `<span class="chip static" data-w="${w}">${w}</span>`).join("")}</div></div></div>
      <div class="gtitle">영영 풀이</div><div class="group">${song.defs.map((d, i) => `<div class="row def"><span class="num">${i + 1}</span>${fi("C." + i, "단어")}<span class="d"><span class="pos">${d[0]}</span>${esc(d[1])}</span></div>`).join("")}</div>${checkBar("C")}`,
    D: () => `<div class="group">${song.sents.map((s, i) => `<div class="row flex"><span class="num">${i + 1}</span>
      <div class="sent">${esc(s[0])}<span class="lead">${s[1]}</span>${fi("D." + i, "")}${esc(s[2])}<span class="ko">${s[3]}</span></div></div>`).join("")}</div>${checkBar("D")}`,
    E: () => song.grammar.map((g, gi) => { let n = 0;
      return `<div class="gtitle">${esc(g.title)}</div><div class="group">
        <div class="row"><div class="rule"><span class="t">쓰임</span><span>${esc(g.use)}</span><span class="t">형태</span><span>${g.form}</span></div></div>
        <div class="row"><div class="ex">${g.ex}</div></div>
        <div class="row"><div class="k">A. 알맞은 것을 고르시오.</div><div style="font-size:15px;line-height:2.1">${g.a.map(t => Array.isArray(t) ? seg(`E.${gi + 1}s${n++}`, t) : esc(t)).join("")}</div></div>
        <div class="row"><div class="k">B. 영작하시오. &nbsp;${esc(g.b[0])} <i style="color:var(--text-3)">(${esc(g.b[1])})</i></div>${fi(`E.${gi + 1}b`, "영어 문장을 쓰세요")}</div></div>`; }).join("")
      + (song.tip ? `<div class="callout"><span>💡</span><span>${song.tip}</span></div>` : ""),
    F: () => `<div class="gtitle">구간별 내용 요약</div>
      <div class="group">${song.parts.map(p => `<div class="row sum"><span><b>${p.seg}</b><br><span style="font-size:11.5px;color:var(--text-2)">${p.r}</span></span>
        <span class="who"><span style="width:11px;height:11px;border-radius:50%;background:var(--c${p.c});flex:none"></span>${esc(p.who)}</span><span>${esc(p.sum)}</span></div>`).join("")}</div>
      <div class="gtitle">가사 · 오른쪽 <b>붓</b>으로 ${song.partHead === "부르는 사람" ? "부르는 사람별로" : "구간별로"} 색칠해요. <mark class="kw">노란 표시</mark>는 중요 어휘·문법, 해석 빈칸은 둘 중 고르거나 초성을 보고 쓰세요.</div>
      <div class="group">${hasL ? `<table class="lyr"><tbody>${LYR.map((l, i) => `<tr data-line="${i}"><td class="no">${i + 1}</td><td class="en"><span class="ent">${enHTML(song, i + 1, l.en)}</span>${
          l.ko ? `<span class="ko">${koHTML(song, i + 1, l.ko)}</span>` : `<input class="field" data-k="F.ko${i}" placeholder="해석을 써 보세요" autocomplete="off">`}</td></tr>`).join("")}</tbody></table>`
        : `<div class="empty"><div class="big">📄</div><b>선생님이 아직 가사를 올리지 않았어요.</b><br>종이 학습지의 가사를 보며 색칠하고, 아래 칸에 줄 번호로 정리해 보세요.</div>
           <div class="row">${song.parts.map(p => `<div style="display:flex;gap:10px;align-items:center;margin:6px 0"><span style="width:12px;height:12px;border-radius:50%;background:var(--c${p.c});flex:none"></span><span style="width:130px;font-size:13px">${esc(p.seg)} · ${esc(p.who)}</span>${fi("F.range" + p.c, "줄 번호 (예: 1–9)")}</div>`).join("")}</div>`}
      </div>`,
    G: () => `<div class="group">${song.questions.map((q, i) => `<div class="row"><div class="k">${esc(q)}</div>${ta("G." + (i + 1), "", i === 2 ? 4 : 2)}</div>`).join("")}</div>`,
    H: () => `${moodBlock("H")}
      <div class="gtitle">새로 알게 된 것 · 가사를 공부하며 새롭게 알게 된 표현이나 의미</div><div class="group"><div class="row">${ta("H.new", "", 3)}</div></div>
      <div class="gtitle">달라진 점 · 처음 들었을 때(A)와 비교해 느낌이 어떻게 달라졌나요?</div>
      <div class="group"><div class="row"><div class="note no-print" id="H-recall" style="margin:0 0 8px"></div>${ta("H.diff", "", 3)}</div></div>
      <div class="gtitle">마음에 남는 한 줄 · 가장 마음에 남는 가사 한 줄을 영어로 적고, 그 이유를 쓰세요</div>
      <div class="group"><div class="row"><div class="k">가사 한 줄</div>${fi("H.line", "")}</div><div class="row"><div class="k">이유</div>${ta("H.why", "", 2)}</div></div>`,
    I: () => `<div class="group"><div class="frame">${esc(song.finale.a[0])}${fi("I.a", song.finale.a[1], "inline")}${esc(song.finale.a[2])}<br>
        ${esc(song.finale.b[0])}${fi("I.b", song.finale.b[1], "inline wide")}${esc(song.finale.b[2])}</div></div>
      <div class="example">${song.finale.example}</div>
      <div class="group no-print" style="margin-top:24px"><div class="row flex">
        <div class="ico" style="width:34px;height:34px;font-size:16px;border-radius:9px;background:linear-gradient(145deg,#30d158,#0a9e3a)">✓</div>
        <div style="flex:1"><b style="font-size:13.5px">학습지 완성!</b><div class="note" style="margin:2px 0 0" id="doneNote"></div></div>
        <button class="pill" data-act="print">PDF로 저장</button></div></div>`
  };
  const descI = "마지막 문장틀을 채워 나만의 문장을 만들어 봅시다.";
  const prevNext = i => { const p = STEPS[i - 1], n = STEPS[i + 1];
    return `<span>${p ? `<button class="pill ghost" data-go="${p.id}">‹ ${p.id}. ${p.short}</button>` : `<button class="pill ghost" data-act="home">‹ 보관함</button>`}</span>
            <span>${n ? `<button class="pill" data-go="${n.id}">${n.id}. ${n.short} ›</button>` : ""}</span>`; };

  $("#sections").innerHTML = STEPS.map((s, i) => `<section class="sec" id="sec-${s.id}" data-sec="${s.id}">
    <div class="hero"><div class="ico" style="background:${STEP_COLORS[i]}">${s.id}</div><div><h2>${s.title}</h2><p>${esc(s.desc || descI)}</p></div></div>
    ${body[s.id]()}<div class="foot">${prevNext(i)}</div></section>`).join("");
  let lastG = null;
  $("#nav").innerHTML = STEPS.map((s, i) => { const g = s.group !== lastG ? `<div class="grp">${s.group}</div>` : ""; lastG = s.group;
    return g + `<button data-go="${s.id}" data-label="${esc(s.title + " " + s.desc)}"><span class="ico" style="background:${STEP_COLORS[i]}">${s.id}</span><span class="lbl">${s.title.replace(/^[A-I]\. /, "")}</span><span class="prog" data-prog="${s.id}"></span></button>`; }).join("");
  $("#hudList").innerHTML = song.parts.map(p => `<button class="hb" data-brush="${p.c}"><span class="sw" style="background:var(--c${p.c})"></span>${esc(p.short)}</button>`).join("");
  $("#pNoTitle").textContent = `${song.no} · ${song.from} · 송례중 3학년`;
  $("#pTitle").textContent = song.title;

  const changed = k => { if (k && k.startsWith("C.")) updateBank(); if (!k || k.startsWith("A.")) updateRecall(); updateProgress(); ctx.onChange(); };

  /* fields */
  $$("#sections [data-k]").forEach(el => { const k = el.dataset.k; if (A[k] != null) el.value = A[k]; el.addEventListener("input", () => { A[k] = el.value; changed(k); }); });
  $$("#sections [data-seg]").forEach(sg => { const k = sg.dataset.seg;
    $$("button", sg).forEach(b => { if (A[k] === b.dataset.v) b.classList.add("on");
      b.addEventListener("click", () => { const was = b.classList.contains("on"); $$("button", sg).forEach(x => x.classList.remove("on"));
        if (!was) { b.classList.add("on"); A[k] = b.dataset.v; } else delete A[k]; changed(k); }); }); });
  $$("#sections [data-mood]").forEach(box => { const k = box.dataset.mood + ".mood"; const sel = () => Array.isArray(A[k]) ? A[k] : (A[k] = []);
    const paint = () => { $$(".chip", box).forEach(c => c.classList.toggle("on", sel().includes(c.dataset.m))); const p = sel();
      $("#" + box.dataset.mood + "-picked").innerHTML = `<span>1. <b>${p[0] || ""}</b></span><span>2. <b>${p[1] || ""}</b></span>`; };
    $$(".chip", box).forEach(c => c.addEventListener("click", () => { const arr = sel(), m = c.dataset.m, i = arr.indexOf(m);
      if (i >= 0) arr.splice(i, 1); else { if (arr.length >= 2) arr.shift(); arr.push(m); } paint(); changed(k); }));
    paint(); });

  /* painting */
  let brush = 1;
  if (!A["F.colors"] || typeof A["F.colors"] !== "object") A["F.colors"] = {};
  const markBrush = () => $$("#hud [data-brush]").forEach(b => b.classList.toggle("on", +b.dataset.brush === brush));
  $$("#hud [data-brush]").forEach(b => b.onclick = () => { brush = +b.dataset.brush; markBrush(); });
  markBrush();
  $$(".lyr tr").forEach(tr => { const i = tr.dataset.line; if (A["F.colors"][i]) tr.dataset.c = A["F.colors"][i];
    $("td.en", tr).addEventListener("click", e => { if (e.target.closest("input,button,.seg")) return;
      if (brush === 0 || +tr.dataset.c === brush) { delete tr.dataset.c; delete A["F.colors"][i]; } else { tr.dataset.c = brush; A["F.colors"][i] = brush; }
      changed("F.colors"); }); });

  /* checking B~D */
  const CK = checkers(song);
  const markField = (id, i, st) => { const el = $(`#sections [data-k="${id}.${i}"]`); if (!el) return; const num = $(".num", el.closest(".vcell,.row"));
    el.classList.toggle("ok", st === "ok"); el.classList.toggle("bad", st === "bad");
    if (num) { num.classList.toggle("ok", st === "ok"); num.classList.toggle("bad", st === "bad"); } el.readOnly = st === "ok"; };
  const paintResult = (id, right, n) => { const bar = $("#cb-" + id), res = $("#res-" + id), btn = $(`[data-check="${id}"]`);
    $(".arc", bar).setAttribute("stroke-dasharray", `${Math.round(right / n * 100)} 100`); const all = right === n; bar.classList.toggle("all", all);
    if (all) { res.innerHTML = `<b>🎉 ${n}문제 모두 맞혔어요!</b> 다음 단계로 넘어가세요.`; btn.textContent = "완료"; btn.disabled = true; btn.classList.add("green"); }
    else res.innerHTML = `<b>${n}문제 중 ${right}개 정답</b> · 빨간 칸 ${n - right}개를 다시 채운 뒤 한 번 더 확인하세요.`, btn.textContent = "다시 확인하기"; };
  const runCheck = id => { const [n, fn] = CK[id]; let right = 0, firstBad = null;
    for (let i = 0; i < n; i++) { const k = `${id}.${i}`, el = $(`#sections [data-k="${k}"]`), v = (el.value || "").trim();
      if (A["ok." + k] || (v && fn(i, v))) { A["ok." + k] = 1; right++; markField(id, i, "ok"); continue; }
      markField(id, i, "bad"); el.placeholder = v ? `✗ ${v}` : "비어 있어요"; el.title = v ? `내가 쓴 답: ${v} — 다시 써 보세요` : "";
      el.value = ""; A[k] = ""; el.classList.remove("bad"); void el.offsetWidth; el.classList.add("bad"); if (!firstBad) firstBad = el; }
    A["tries." + id] = (A["tries." + id] || 0) + 1; paintResult(id, right, n); changed(id + ".0");
    if (firstBad) setTimeout(() => firstBad.focus(), 150); };
  $$("#sections [data-check]").forEach(b => b.addEventListener("click", () => runCheck(b.dataset.check)));
  Object.keys(CK).forEach(id => { const [n] = CK[id]; let right = 0;
    for (let i = 0; i < n; i++) { const el = $(`#sections [data-k="${id}.${i}"]`); if (!el) continue; if (A[`ok.${id}.${i}`]) { right++; markField(id, i, "ok"); }
      el.addEventListener("input", () => { if (el.classList.contains("bad")) { el.classList.remove("bad"); const num = $(".num", el.closest(".vcell,.row")); if (num) num.classList.remove("bad"); } }); }
    if (A["tries." + id]) paintResult(id, right, n); });

  /* progress */
  function updateProgress() {
    const st = computeStats(song, A, hasL, LYR.length);
    STEPS.forEach(s => { const [d, t] = st.per[s.id], el = $(`[data-prog="${s.id}"]`); el.textContent = d === t ? "✓" : `${d}/${t}`; el.classList.toggle("done", d === t); });
    const dn = $("#doneNote"); if (dn) dn.textContent = st.done === st.total ? "모든 칸을 채웠어요. PDF로 저장해서 제출하세요." : `전체 ${st.total}칸 중 ${st.done}칸을 채웠어요. 빈 칸은 왼쪽 목록의 숫자로 확인할 수 있어요.`;
    return st;
  }
  function updateBank() { const used = $$("#sections [data-k^='C.']").map(e => e.value.trim().toLowerCase()).filter(Boolean); $$("#bank .chip").forEach(c => c.classList.toggle("used", used.includes(c.dataset.w))); }
  function updateRecall() { const el = $("#H-recall"); if (!el) return; const m = (A["A.mood"] || []).join(", "), f = (A["A.feel"] || "").trim();
    el.innerHTML = (m || f) ? `📝 처음(A)에 쓴 내용 — 기분: <b>${esc(m || "없음")}</b>${f ? ` · “${esc(f.length > 80 ? f.slice(0, 80) + "…" : f)}”` : ""}` : ""; }

  updateBank(); updateRecall(); updateProgress();
  return { stats: () => computeStats(song, A, hasL, LYR.length), hasLyrics: hasL, lines: LYR.length };
}
