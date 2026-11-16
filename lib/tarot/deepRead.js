// deepRead.js — v2.3.29 앞단(1~3쪽) 강조와 기저 생각 · v3.1 COMMON 세부도 켬, 세기 2이면 scene_strong(reportLines.applyScene level) (데이터: 02_데이터/deep_read.json)
// CSO 2026-11-16: 타로 이용자는 모두 불안·걱정·고민이 있는 사람. 지나온 힘든 시간을 짚고, 글 밑에 있는 생각을 짚는다.
//   intensityOf  글에서 마음 낱말·지나온 기간·되풀이·겪은 일·“고민돼요” 신호를 찾아 강조 세기를 정함(1 지금 정도 / 2 더 세게 / 0 붙이지 않음) — v2.3.30 CSO 판별 반영
//   signalLine   더 세게일 때 3쪽 신호 줄(마음 낱말이면 그 낱말을 받아 씀)
//   tailFor      지나온 길 문장 뒤에 붙는 덧줄(카드별)
//   formOf       묻는 꼴(언제·될까·할까 말까·그 사람 마음·어떻게)
//   thoughtFor   기저 생각 2개(세부마다, v2.3.31)
//   secondLine   2순위 세부(A2 sub2)로 쓰는 줄
//   deepRead     위를 모아 쪽별로 돌려줌
// 안전 표시가 있으면 아무것도 붙이지 않는다(안전 규칙은 바꾸지 않음).
// v3.1: 묶음이 COMMON이어도 세부(subId)가 있고 확신이 낮지 않으면 붙인다(운세·나 자신·건강·기타·법 세부 17개). 세부가 없거나 확신이 낮으면 붙이지 않는다.
//   장면 문장(scene)은 COMMON에 없으므로 1·2쪽 카드 문장은 그대로이고, 덧줄·기저 생각·3쪽 신호 줄만 붙는다.
const rx = (s) => new RegExp(s);
const off = (variant, safety, subId = null, confidence = "high", db = null) => {
  if (!variant || (safety && safety !== "none") || confidence === "low") return true;
  if (variant !== "COMMON") return false;
  if (!subId) return true;
  return (db?.common_on?.off_prefix || []).some((p) => subId.startsWith(p));
};

export function intensityOf(text, { safety = "none" } = {}, db) {
  if (safety && safety !== "none") return { level: 0, signals: [], word: null };
  const t = String(text || ""), S = db.intensity.signals, signals = [];
  let word = null;
  for (const k of db.intensity.order) {
    if (k === "FEEL") { const w = S.FEEL.words.find((x) => rx(x.rx).test(t)); if (w) { signals.push(k); word = w.word; } }
    else if (rx(S[k].rx).test(t)) signals.push(k);
  }
  return { level: signals.length ? 2 : 1, signals, word };
}
// 3쪽 신호 줄: 첫 신호 하나. FEEL이면 글에 쓴 마음 낱말을 기본형으로 받아 씀(v2.3.30)
export function signalLine(it, db) {
  if (!it || it.level !== 2) return "";
  const k = it.signals[0], tpl = db.intensity.signal_line[k] || "";
  return k === "FEEL" ? tpl.replace("{word}", it.word || "힘들다") : tpl;
}
export function tailFor(cardKey, level, db) {
  const t = db.intensity.tail[cardKey];
  return t && level > 0 ? t[String(level >= 2 ? 2 : 1)] : "";
}
export function formOf(text, db) {
  const t = String(text || "");
  for (const f of db.form.rx) if (rx(f.rx).test(t)) return f.id;
  return null;
}
export function formLine(text, variant, db) {
  const g = db.form.group[variant], f = formOf(text, db);
  return (g && f && db.form.lines[g][f]) || "";
}
// v2.3.31: 세부(subId)마다 기저 생각 2개. 세부가 없으면 묶음의 대표 세부. 카드는 고르지 않음(첫머리 문장만).
export function thoughtFor(variant, cardKey, db, subId = null) {
  const T = db.thought, key = (subId && T.by_sub[subId]) ? subId : T.variant_top_sub[variant];
  const t = key && T.by_sub[key];
  if (!t) return null;
  return { sub: key, first: t.first, second: t.second, text: T.tpl.replace("{s}", t.surface).replace("{a}", t.first).replace("{b}", t.second) };
}
export function secondLine(variant, variant2, db) {
  const a = db.second.phrase[variant], b = db.second.phrase[variant2];
  if (!a || !b || variant === variant2) return "";
  return db.second.tpl.replace("{q}", a.q).replace("{u}", b.u);
}
// cards: { now: "9_up", hold: "16_rev" } · variant2: 2순위 세부의 묶음(areaVariant(sub2))
export function deepRead({ text, variant, subId = null, variant2 = null, cards = {}, safety = "none", confidence = "high" }, db) {
  if (off(variant, safety, subId, confidence, db)) return { level: 0, signals: [], page1_tail: "", page2_thought: "", page3_line: "", page3_signal: "", source: null };
  const it = intensityOf(text, { safety }, db);
  const second = variant2 ? secondLine(variant, variant2, db) : "";
  const form = second ? "" : formLine(text, variant, db);
  const th = thoughtFor(variant, cards.hold, db, subId);
  return {
    level: it.level, signals: it.signals,
    page1_tail: cards.now ? tailFor(cards.now, it.level, db) : "",
    page2_thought: th ? th.text : "", thought_sub: th ? th.sub : null,
    page3_line: second || form, source: second ? "second" : form ? "form" : null,
    page3_signal: signalLine(it, db), word: it.word,
  };
}
// 기록용: 어느 세기·어느 갈래가 나갔는지(결제율 비교에 씀)
export const deepEvent = (r) => ({ deep_level: r.level, deep_signal: r.signals[0] || null, deep_thought_sub: r.thought_sub || null, deep_source: r.source });
