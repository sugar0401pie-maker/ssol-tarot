// v2.3.14 짧은 고민에 한 번 더 묻기 — 질문·고르기 답은 모두 02_데이터/followup_questions.json(데이터베이스)에서. AI를 부르지 않음.
//   왜: 20자 이하 고민이 33%이고 결제율 4.6%(81자 이상 17.2%). 짧은 글은 듣고 싶은 답·연애 단계를 알 수 없는 경우가 긴 글의 3~4배.
//   흐름: 고민 제출 → needsFollowup(text) → firstQuestion() → 고르면 nextQuestion(db, 고른 답) → composeWorry(text, 답들) 로 고민 글 뒤에 붙여 저장·AI에 전달
//         → 고민 틀이 나온 뒤 applyFollowup(frame, 답들) 로 빈 칸만 채움(AI가 이미 채운 칸은 덮어쓰지 않음)
//   안전: 위기 판정(urgent)이면 질문을 보여 주지 않음(호출하는 쪽에서 안전 확인을 먼저).
const len = (t) => [...String(t || "").trim()].length;
export function needsFollowup(text, db, { urgent = false } = {}) {
  if (urgent || !db) return false;
  const n = len(text);
  return n > 0 && n <= (db.short_max || 20);
}
const view = (db, key) => { const q = db.questions[key]; return q ? { key, ask: q.ask, options: q.options.map((o) => ({ id: o.id, label: o.label })) } : null; };
export const firstQuestion = (db) => view(db, "q1");
// 고른 답 목록 [{q, id}] 을 받아 다음 질문(없으면 null). 최대 db.max_questions개.
export function nextQuestion(db, answers = []) {
  if (!answers.length) return firstQuestion(db);
  if (answers.length >= (db.max_questions || 2)) return null;
  const last = answers[answers.length - 1], opt = pick(db, last);
  const key = opt && opt.next ? opt.next : answers.some((a) => a.q === "want") ? null : "want";
  return key && !answers.some((a) => a.q === key) ? view(db, key) : null;
}
function pick(db, a) { const q = a && db.questions[a.q]; return q ? q.options.find((o) => o.id === a.id) || null : null; }
// 고민 글 뒤에 고른 답을 붙임: "취업 될까요 (덧붙임: 취업 고민 · 지원 결과를 기다리는 중)"
export function composeWorry(text, answers, db) {
  const parts = (answers || []).map((a) => pick(db, a)).filter((o) => o && o.text).map((o) => o.text);
  return parts.length ? `${String(text || "").trim()}${db.compose_prefix}${parts.join(" · ")}${db.compose_suffix}` : String(text || "").trim();
}
// 고민 틀의 빈 칸만 채움. 연애가 아니면 love_status는 넣지 않음.
export function applyFollowup(frame, answers, db) {
  if (!frame || !answers || !answers.length) return frame;
  const f = { ...frame }, filled = [];
  for (const a of answers) { const o = pick(db, a); if (!o) continue;
    for (const [k, v] of Object.entries(o.fields || {})) { if (k === "love_status" && (f.area || (o.fields.area)) !== "LOV" && f.area) continue;
      if (f[k] == null || f[k] === "unknown" || f[k] === "unclear" || (k === "stage" && f[k] === "none")) { f[k] = v; filled.push(k); } } }
  f.followup = { answers: answers.map((a) => `${a.q}:${a.id}`), filled };
  return f;
}
