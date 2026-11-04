import { SONGS, songById } from "./songs.js";
import * as store from "./store.js";
import { $, $$, esc, STEPS, parseLyrics, levelOf } from "./worksheet.js";

const ICON = { dog: "🐶", cat: "🐱", rabbit: "🐰", bear: "🐻", penguin: "🐧" };
let students = [], curSong = SONGS[0].id, drawerSid = null;
let tt;
const toast = (t, m) => { $("#toastT").textContent = t; $("#toastM").textContent = m; $("#toast").classList.add("show"); clearTimeout(tt); tt = setTimeout(() => $("#toast").classList.remove("show"), 3000); };

async function enter(email) {
  $("#gate").style.display = "none"; $("#tWin").style.display = "flex"; $("#who").textContent = email;
  await loadStudents(); renderSongTabs(); loadLyr();
}
async function loadStudents() {
  try { students = (await store.listStudents()).sort((a, b) => String(a.sid).localeCompare(String(b.sid))); }
  catch (e) { console.error(e); toast("학생 목록을 불러오지 못했어요", "Firestore 규칙의 선생님 이메일을 확인하세요."); students = []; }
  renderTable();
}
function renderTable() {
  const q = $("#filter").value.trim();
  const rows = students.filter(s => !q || String(s.sid).includes(q) || (s.name || "").includes(q));
  $("#count").textContent = `${rows.length}명`;
  $("#tbl").innerHTML = `<tr><th></th><th>학번</th><th>이름</th>${SONGS.map(s => `<th>${s.cover.motif} ${esc(s.title)}</th>`).join("")}<th>음악 지수</th><th>최근 저장</th></tr>` +
    rows.map(s => { const st = s.stats || {}, L = levelOf(s.musicIndex || 0);
      const last = Math.max(0, ...SONGS.map(x => (st[x.id] && st[x.id].at) || 0));
      return `<tr class="r" data-sid="${esc(s.sid)}"><td><span class="av">${ICON[s.icon] || "🙂"}</span></td><td class="tn">${esc(s.sid)}</td><td>${esc(s.name || "")}</td>
        ${SONGS.map(x => { const v = st[x.id]; return `<td class="tn">${v ? `<span class="mini"><i style="width:${v.pct}%"></i></span>${v.pct}% · ${v.score}점` : `<span style="color:var(--text-3)">—</span>`}</td>`; }).join("")}
        <td class="tn"><b>${s.musicIndex || 0}</b> ${L.icon}</td><td class="tn" style="color:var(--text-2)">${last ? new Date(last).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}</td></tr>`; }).join("");
}
$("#filter").addEventListener("input", renderTable);
$("#refresh").onclick = loadStudents;
$("#tbl").addEventListener("click", e => { const r = e.target.closest("tr.r"); if (r) openDrawer(r.dataset.sid); });
$("#csv").onclick = () => {
  const head = ["학번", "이름", ...SONGS.flatMap(s => [`${s.title} 완성도`, `${s.title} 점수`]), "음악지수"];
  const lines = students.map(s => [s.sid, s.name, ...SONGS.flatMap(x => { const v = (s.stats || {})[x.id]; return [v ? v.pct : 0, v ? v.score : 0]; }), s.musicIndex || 0]);
  const csv = "﻿" + [head, ...lines].map(r => r.map(c => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = `popsong_학생현황_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
};

/* drawer: student answers */
async function openDrawer(sid, song = SONGS[0].id) {
  drawerSid = sid; const s = students.find(x => String(x.sid) === String(sid)) || {};
  $("#dAv").textContent = ICON[s.icon] || "🙂"; $("#dTitle").textContent = `${sid} ${s.name || ""}`;
  $("#dSongs").innerHTML = SONGS.map(x => `<button data-ds="${x.id}" class="${x.id === song ? "on" : ""}">${x.cover.motif}</button>`).join("");
  $$("#dSongs button").forEach(b => b.onclick = () => openDrawer(sid, b.dataset.ds));
  $("#drawer").classList.add("show"); $("#dBody").innerHTML = `<span class="spinner" style="border-color:var(--line);border-top-color:var(--accent)"></span>`;
  const A = await store.loadStudentSong(sid, song), x = songById(song);
  const v = k => { const a = A[k]; return Array.isArray(a) ? a.join(", ") : (a == null ? "" : String(a)); };
  const box = (q, k) => `<div class="q">${esc(q)}</div><div class="a">${esc(v(k)) || '<span class="x">(비어 있음)</span>'}</div>`;
  const ck = (pfx, n, label) => { let ok = 0; const cells = []; for (let i = 0; i < n; i++) { const g = A[`ok.${pfx}.${i}`]; if (g) ok++; cells.push(`${i + 1}. ${label(i)} → <b class="${g ? "ok" : ""}">${esc(v(`${pfx}.${i}`)) || "—"}</b>${g ? " ✓" : ""}`); }
    return `<div class="q">맞힘 ${ok}/${n} · 확인 ${A["tries." + pfx] || 0}회</div><div class="a" style="white-space:normal">${cells.join("<br>")}</div>`; };
  $("#dBody").innerHTML = `<h4>${x.cover.motif} ${esc(x.title)}</h4>
    <h4>A. 첫 감상</h4>${box("기분", "A.mood")}${box("느낌", "A.feel")}
    <h4>B. 어휘</h4>${ck("B", x.vocab.length, i => x.vocab[i])}
    <h4>C. 영영 풀이</h4>${ck("C", x.keyC.length, i => x.defs[i][1].slice(0, 28) + "…")}
    <h4>D. 철자 문장</h4>${ck("D", x.keyD.length, i => x.sents[i][1] + "____")}
    <h4>E. 문법</h4>${x.grammar.map((g, gi) => { let n = 0; const ch = g.a.filter(Array.isArray).map(() => v(`E.${gi + 1}s${n++}`) || "—").join(" / ");
      return `<div class="q">${esc(g.title)}</div><div class="a">A: ${esc(ch)}\nB: ${esc(v(`E.${gi + 1}b`)) || "—"}</div>`; }).join("")}
    <h4>F. 가사</h4><div class="q">색칠한 줄 ${A["F.colors"] ? Object.keys(A["F.colors"]).length : 0}줄 · 빈칸 ${x.blanks.filter((b, j) => v("F.b" + j)).length}/${x.blanks.length}칸 채움 · 맞힌 빈칸 ${x.blanks.filter((b, j) => v("F.b" + j) === b.ko).length}칸</div>
    <h4>G. 이해 질문</h4>${x.questions.map((q, i) => box(q, "G." + (i + 1))).join("")}
    <h4>H. 다시 감상</h4>${box("기분", "H.mood")}${box("새로 알게 된 것", "H.new")}${box("달라진 점", "H.diff")}${box("마음에 남는 한 줄", "H.line")}${box("이유", "H.why")}
    <h4>I. 나의 한 문장</h4><div class="a">${esc(x.finale.a[0])}<b>${esc(v("I.a")) || "___"}</b>${esc(x.finale.a[2])} ${esc(x.finale.b[0])}<b>${esc(v("I.b")) || "___"}</b>${esc(x.finale.b[2])}</div>
    <div style="margin-top:18px"><button class="pill ghost" id="dReset">이 곡 답안 초기화</button></div>`;
  $("#dReset").onclick = async () => { if (!confirm(`${sid} 학생의 '${x.title}' 답안을 모두 지울까요? 되돌릴 수 없어요.`)) return;
    await store.resetStudentSong(sid, song); toast("초기화했어요", `${sid} · ${x.title}`); await loadStudents(); openDrawer(sid, song); };
}
$("#dClose").onclick = () => $("#drawer").classList.remove("show");

/* lyrics */
function renderSongTabs() {
  $("#songTabs").innerHTML = SONGS.map(s => `<button data-song="${s.id}" class="${s.id === curSong ? "on" : ""}">${s.cover.motif} ${esc(s.title)}</button>`).join("");
  $$("#songTabs button").forEach(b => b.onclick = () => { curSong = b.dataset.song; renderSongTabs(); loadLyr(); });
}
async function loadLyr() { $("#lyrState").textContent = "불러오는 중…"; $("#lyrText").value = await store.loadLyrics(curSong); preview(); }
function preview() {
  const s = songById(curSong), L = parseLyrics($("#lyrText").value), ok = L.length === s.lines;
  const miss = L.length ? s.blanks.filter(b => !(L[b.line - 1] && L[b.line - 1].ko.includes(b.ko))).length : 0;
  $("#lyrState").innerHTML = L.length ? `<span class="badge ${ok ? "ok" : "no"}">${L.length}줄 / 학습지 ${s.lines}줄</span> <span class="badge ${miss ? "no" : "ok"}">빈칸 ${s.blanks.length - miss}/${s.blanks.length} 연결</span>` : `<span class="badge no">가사 없음</span>`;
  $("#lyrPrev").innerHTML = L.length ? `<table>${L.map((l, i) => `<tr><td class="n">${i + 1}</td><td>${esc(l.en)}<br><span style="color:var(--text-2)">${esc(l.ko) || '<span class="badge no">해석 없음</span>'}</span></td></tr>`).join("")}</table>` : `<div class="empty">붙여 넣으면 여기에 줄별로 미리 보여요.</div>`;
}
$("#lyrText").addEventListener("input", preview);
$("#lyrSave").onclick = async () => {
  try { await store.saveLyrics(curSong, $("#lyrText").value); toast("가사를 저장했어요", songById(curSong).title); }
  catch (e) { console.error(e); toast("저장하지 못했어요", "Firestore 규칙의 선생님 이메일을 확인하세요."); }
};

$$(".tabs [data-tab]").forEach(b => b.onclick = () => { $$(".tabs [data-tab]").forEach(x => x.classList.toggle("on", x === b)); $$("[data-pane]").forEach(p => p.style.display = p.dataset.pane === b.dataset.tab ? "" : "none"); });
$("#gLogin").onclick = async () => {
  try { const r = await store.teacherLogin(); if (r.denied) { $("#gateMsg").textContent = `${r.email} 계정은 선생님으로 등록되어 있지 않아요.`; return; } enter(r.email); }
  catch (e) { $("#gateMsg").textContent = "로그인하지 못했어요. 팝업 차단을 해제하고 다시 시도하세요."; console.error(e); }
};
$("#tLogout").onclick = async () => { await store.teacherLogout(); location.reload(); };

(async () => {
  document.documentElement.dataset.theme = "light";
  const r = await store.initStore();
  if (r.local) { $("#localBadge").innerHTML = `<span class="offline-badge">로컬 모드</span>`; $("#gateMsg").innerHTML = "Firebase가 아직 연결되지 않았어요.<br>지금은 이 기기에 저장된 데이터만 볼 수 있어요."; $("#gLogin").textContent = "로컬 모드로 들어가기"; }
  const s = await store.teacherSession();
  if (s && !s.denied) enter(s.email);
})();
