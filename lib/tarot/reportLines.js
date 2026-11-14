// v2.3.16 — 문장 DB(02_데이터/report_lines.json)에서 문장을 고르는 함수 모음. AI 호출 없음.
// 아직 buildPagesV43에 끼워 넣지 않았어요. 끼울 자리는 01_설계/문장DB_v2.3.15.md의 '끼울 자리' 표를 봐 주세요.
import { hasBatchim } from "./josa.js";

const sign = (n) => (n > 0 ? 1 : n < 0 ? -1 : 0);
const pickOne = (list, seed = 0) => list[Math.abs(seed) % list.length];

// ── 1. 고민 유형: OUTCOME(결과형) / CHOICE(선택형) / SITUATION(상황형)
export function worryType(frame = {}, sub = null, db) {
  const userOptions = Array.isArray(frame.options) && frame.options.length === 2 && frame.decision_source === "explicit"; // 사용자가 직접 쓴 선택지(v43: decision_source)
  if (userOptions) return "CHOICE";
  const want = frame.want || (sub && sub.want);
  const T = db.worry_type.types;
  for (const k of ["CHOICE", "OUTCOME", "SITUATION"]) if (T[k].want.includes(want)) return k === "OUTCOME" && !(frame.table || (sub && sub.table)) ? "SITUATION" : k;
  return frame.table || (sub && sub.table) ? "OUTCOME" : "SITUATION";
}

// ── 2. 카드 모양. scores=[지나온 길, 지금의 흐름, 앞으로의 열쇠] 점수, pickSign=결론 쪽(+1 움직이는 쪽 / -1 머무는 쪽)
export function cardPattern(scores, pickSign) {
  const [a, b, c] = scores.map((s) => sign(s) === pickSign);
  if (a && b && c) return "ALL";
  if (c && (a || b)) return "TWO_KEY";
  if (a && b && !c) return "TWO_NOKEY";
  if (c && !a && !b) return "KEY_ALONE";
  return "MIXED";
}

// ── 3. 5쪽 머리 문장
export function page5Head({ type, pickSign = 1, pattern, pick = "", gap = 0, seed = 0 }, db) {
  const H = db.page5_head;
  if (type === "SITUATION") return pickOne(H.SITUATION.ANY, seed);
  const group = type === "CHOICE" ? "CHOICE" : pickSign > 0 ? "OUTCOME_POS" : "OUTCOME_NEG";
  const list = H[group][pattern] || H[group].MIXED;
  let line = pickOne(list, seed).replaceAll("{pick}", pick);
  if (pattern === "ALL" && Math.abs(gap) >= db.card_pattern.clear_gap) line += " " + H.clear_tail[group];
  return line;
}

// ── 4. 선택지 별칭. side: 0=움직이는 쪽, 1=머무는 쪽
export function aliasFor({ type, table, side, userOption = null }, db) {
  if (userOption) {
    const a = (userOption.alias || "").trim();
    const ok = a && [...a].length <= 8;
    return { full: userOption.text || userOption, alias: ok ? a : side === 0 ? "첫 번째 쪽" : "두 번째 쪽", source: ok ? "ai" : "order" };
  }
  const set = type === "CHOICE" ? db.alias.choice : db.alias.outcome;
  const row = (set[table] || db.alias.choice[table] || [])[side];
  return row ? { ...row, source: "db" } : null;
}

// 쪽별로 정식 이름·별칭 중 무엇을 쓸지
export function optionNameFor(page, nth, names, db) {
  const first = { 3: true, 7: true, 10: true }[page] && nth === 0;
  return first ? names.full : names.alias;
}

// ── 5. 5쪽 카드별 한 줄. score=이 점수표에서의 카드 점수, stance=decision_tables.stance[cardKey], tableReason=점수표의 카드 설명
export function cardLine({ cardKey, score, pickSign, stance, tableReason = "" }, db) {
  const C = db.card_line, L = C.lines[cardKey];
  if (!L) return "";
  const s = sign(score);
  if (s === 0) return L.neutral;
  const rel = s === pickSign ? "support" : "oppose";
  const natural = C.natural[stance] ?? 0;
  if (natural !== 0 && natural !== s && tableReason) return (rel === "support" ? C.flip_support : C.flip_oppose).replace("{reason}", tableReason);
  return L[rel];
}

// ── 6. 영역 변형(1·2쪽 셋째 문장)
export function areaVariant(subId, { confidence = "high", safety = "none" } = {}, db) {
  if (!subId || confidence === "low" || (safety && safety !== "none")) return "COMMON";
  const V = db.area_variants.variants;
  for (const [k, v] of Object.entries(V)) if ((v.subs || []).includes(subId)) return k;
  for (const [k, v] of Object.entries(V)) if ((v.prefix || []).some((p) => subId.startsWith(p)) && !(v.except || []).includes(subId)) return k;
  return "COMMON";
}

const sentences = (text) => text.match(/[^.!?]+[.!?]+/g)?.map((x) => x.trim()) || [text];

// 카드 고정 문장(세 문장)의 셋째 문장을 영역 문장으로 바꿈. 영역 문장이 없으면 그대로 돌려줌
export function applyScene(text, cardKey, pos, variant, db) {
  const line = variant !== "COMMON" && db.scene[cardKey]?.[variant]?.[pos];
  if (!line) return text;
  const ss = sentences(text);
  if (ss.length < 3) return text;
  return [...ss.slice(0, 2), line].join(" ");
}

// ── 7. 3쪽 끝 예고, 7쪽 조건문, 대체 문장
export const page3Tail = (type, pattern, db) => (type === "SITUATION" ? db.page3_tail.SITUATION.ANY : (db.page3_tail[type] || db.page3_tail.OUTCOME)[pattern] || db.page3_tail.OUTCOME.MIXED);
export const page7Cond = (table, pickSign, db) => db.page7_cond[table]?.[pickSign > 0 ? "plus" : "minus"] || null;
export function fallbackQuote(worryText, type, db, seed = 0) {
  const q = [...String(worryText || "").replace(/\s+/g, " ").trim()].slice(0, 30).join("");
  if (!q) return "";
  let line = pickOne(db.fallback_quote[type] || db.fallback_quote.SITUATION, seed).replace("{q}", q);
  return line.replace("’가 어디서", hasBatchim(q) ? "’이 어디서" : "’가 어디서");
}
export function planLine(frameId, pickSign, db) {
  const P = db.plan[frameId];
  if (!P) return null;
  return P.first ? { first: P.first, look: P.look } : { first: pickSign > 0 ? P.plus : P.minus };
}

// ── 8. 실천 조립: "다음에 {cue} — {title} · {min}분"
export function cueFor({ subId, frameId, sceneCue = null }, db) {
  return sceneCue || db.cue.sub[subId] || db.cue.frame[frameId] || "";
}
export function pickPractices({ frameId, variant = "COMMON", emotion = null, safety = "none", pickSign = 1, exclude = [] }, db) {
  const link = db.practice_link[frameId];
  if (!link) return { today: null, three: null };
  const bank = Object.fromEntries([...db.practice_bank[link.theme].today, ...db.practice_bank[link.theme].three].map((p) => [p.id, p]));
  const tired = emotion === "TIR", watch = safety && safety !== "none";
  const ok = (p) => p && !exclude.includes(p.id) && !exclude.includes(p.title)
    && (!p.partner || variant === "DATING") && (!p.employed || link.theme.startsWith("work"))
    && (!p.others || pickSign > 0) && (!(tired || watch) || p.power === 1) && (!watch || !Number(p.stay));
  const today = link.today.map((id) => bank[id]).find(ok) || null;
  const pool = link.three.map((id) => bank[id]).filter(ok);
  const spare = link.today.map((id) => bank[id]).filter((p) => ok(p) && (!today || p.id !== today.id)); // 3일 안에 후보가 다 걸러지면 오늘 후보에서 채움
  const three = pool.find((p) => !today || p.form !== today.form) || pool[0] || spare.find((p) => p.form !== today?.form) || spare[0] || null;
  return { today, three };
}
export function practiceLine(p, cue) {
  if (!p) return "";
  return `${cue ? `다음에 ${cue} — ` : ""}${p.title} · ${p.min}분`;
}

// 틀 안에서 세부를 가르는 질문(다시 묻기 둘째 질문 후보)
export const splitQuestions = (frameId, db) => db.split_questions.filter((q) => q.frame === frameId);
