// v2.3.21 여러 고민을 한꺼번에 썼을 때 — 뽑기 전에 하나를 고르게 하고, 결과에서 어떤 고민으로 읽었는지 먼저 알려 줌.
//   데이터: 02_데이터/multi_worry.json. AI를 부르지 않음.
//   흐름: 고민 제출 → (안전 확인) → detectMulti(text) → ask면 multiQuestion() 화면 → 고르면 composeFocus(text, choice) 로 고민 글 뒤에 "(고른 고민: 연애)"를 붙여 저장·AI에 전달
//         → 고민 틀이 나온 뒤 applyFocus(frame, detect, choice) → 3쪽 첫 줄 focusLine(frame.focus)
//   이 질문이 나가면 짧은 고민 다시 묻기(followup.js)는 건너뜀(질문 화면은 한 번만).
const re = (s, f = "") => new RegExp(s, f);

// 글에서 서로 다른 묶음(연애 / 일 / 돈 / 건강 / 인간관계)의 고민을 찾음. 같은 묶음 안(직장·취업·시험·진로)은 한 고민으로 봄.
export function detectMulti(text, db, { urgent = false } = {}) {
  const t = String(text || "");
  const found = [], sig = re(db ? db.signal : "$^");
  if (!db || urgent || !t.trim()) return { ask: false, options: [] };
  for (const fam of db.families) {
    let best = null;
    for (const lb of fam.labels) for (const m of t.matchAll(re(lb.words, "g"))) { // 낱말 뒤 가까이에 묻는 말이 있어야 '고민'으로 셈(긴 사연 속에 지나가는 낱말은 빼기)
      const near = t.slice(m.index, m.index + m[0].length + (db.signal_window || 25));
      if (sig.test(near) && (!best || m.index < best.pos)) best = { key: fam.key, label: lb.label, area: lb.area || fam.area || null, pos: m.index };
    }
    if (best) found.push(best);
  }
  found.sort((a, b) => a.pos - b.pos);
  const ask = found.length >= 2;
  return { ask, options: ask ? found.slice(0, db.max_options || 4) : [], families: found.map((x) => x.key) };
}

// 질문 화면에 넣을 값. small은 작은 글씨 한 줄.
export function multiQuestion(detect, db, name = "") {
  if (!detect || !detect.ask) return null;
  return { ask: db.ask, small: db.small_note.replace("{name}", name),
    options: [...detect.options.map((o) => ({ id: o.key, label: `${o.label}${db.option_suffix}` })), { id: db.linked.id, label: db.linked.label }] };
}

// 고민 글 뒤에 고른 고민을 붙임: "수능 잘 볼까요? 연애도 할 수 있을까요 (고른 고민: 연애)"
export function composeFocus(text, choiceId, detect, db) {
  const base = String(text || "").trim();
  if (!detect || !detect.ask || !choiceId) return base;
  const o = detect.options.find((x) => x.key === choiceId);
  const word = choiceId === db.linked.id ? db.linked.text : o ? o.label : null;
  return word ? `${base}${db.compose_prefix}${word}${db.compose_suffix}` : base;
}

// 고민 틀에 focus를 붙임. 고르지 않고 넘어온 경우(옛 화면 등)는 틀의 영역으로 채움.
export function applyFocus(frame, detect, choiceId, db) {
  if (!frame || !detect || !detect.ask) return frame;
  const opts = detect.options;
  if (choiceId === db.linked.id) return { ...frame, focus: { how: "linked", picked: null, others: [], asked: opts.map((o) => o.key) } };
  let o = opts.find((x) => x.key === choiceId), how = "picked";
  if (!o) { o = opts.find((x) => x.area && x.area === frame.area) || opts.find((x) => x.key === "work" && ["CAR", "JOB", "EDU", "DIR"].includes(frame.area)) || null; how = "not_asked"; }
  if (!o) return { ...frame, focus: { how: "unknown", picked: null, others: [], asked: opts.map((x) => x.key) } };
  const f = { ...frame, focus: { how, picked: o.label, picked_key: o.key, others: opts.filter((x) => x.key !== o.key).map((x) => x.label), asked: opts.map((x) => x.key) } };
  if (how === "picked" && o.area && !f.area) f.area = o.area; // 빈 칸만 채움
  return f;
}

// 3쪽 첫 줄. 이어진 한 가지 고민이거나 focus가 없으면 null.
export function focusLine(focus, db) {
  if (!focus || !focus.picked) return null;
  const P = db.page3;
  const head = (focus.how === "picked" ? P.picked : P.not_asked).replace("{picked}", focus.picked);
  return focus.how === "picked" && focus.others.length ? `${head} ${P.others.replace("{others}", focus.others.join("’·‘"))}` : head;
}

// 기록 칸 값: "asked:love,work|picked:love"
export const multiEvent = (focus) => (focus ? `asked:${focus.asked.join(",")}|${focus.how}:${focus.picked_key || ""}` : null);
