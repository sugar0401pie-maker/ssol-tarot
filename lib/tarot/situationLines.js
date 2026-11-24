// situationLines.js — v3.7 과제 1(CSO 11/23: 1안을 먼저 넣고, 2안은 41자 이상 긴 글에만)
//   1안: 판별 AI(A2 v4.29)가 원문에서 뽑은 사정 칸(facts: how_long · who · bind · event)을 무료 1·3쪽 DB 문장에 끼움.
//   2안: 결제 전 AI(C)가 쓴 '글에서 짚는 한 줄'(free_lines.p1·p2)을 검사해 1·2쪽에 붙임(41자 이상 글만).
//   데이터: 02_데이터/situation_lines.json. 조사: josa.js.
import { hasBatchim } from "./josa.js";

const norm = (s) => String(s || "").replace(/\s+/g, "");
const SAFETY_RX = /죽|자살|자해|목숨|유서/;
const LIMIT = { how_long: [2, 12], who: [2, 20], bind: [2, 20], event: [2, 20] };

// 칸 값 검사: 원문에 그대로 있는 말만(띄어쓰기 무시), 길이 제한, 안전 낱말 금지. 통과한 칸만 돌려줌.
export function cleanFacts(text, facts = {}) {
  const t = norm(text), out = {};
  for (const k of Object.keys(LIMIT)) {
    const v = facts && typeof facts[k] === "string" ? facts[k].trim().replace(/^[‘'"]|[’'"]$/g, "") : "";
    if (!v) continue;
    const n = norm(v).length;
    if (n < LIMIT[k][0] || n > LIMIT[k][1]) continue;
    if (!t.includes(norm(v)) || SAFETY_RX.test(v)) continue;
    out[k] = v;
  }
  return out;
}
const isCount = (x) => /번째|\d+\s*번|재수|삼수|장수/.test(x);
const hash = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
function fill(tpl, x) {
  const b = hasBatchim(x);
  return tpl.replace("{x}", x).replace("{이라는}", b ? "이라는" : "라는").replace("{과의}", b ? "과의" : "와의").replace("{을}", b ? "을" : "를");
}
function line(slot, x, level, db, seed) {
  const L = db.slots[slot].tpl[String(level >= 2 ? 2 : 1)];
  return fill(L[hash(seed + slot) % L.length], x);
}
// 1쪽·3쪽 사정 줄. variant = 묶음(관계 묶음일 때만 who를 씀). level = 강조 세기.
export function factLines({ text, facts, variant = null, level = 1 }, db) {
  const f = cleanFacts(text, facts), used = [];
  let p1 = "", p3 = "";
  if (f.how_long) { p1 = line(isCount(f.how_long) ? "how_long_count" : "how_long", f.how_long, level, db, text); used.push("how_long"); }
  else if (f.event) { p1 = line("event", f.event, level, db, text); used.push("event"); }
  if (f.bind) { p3 = line("bind", f.bind, level, db, text); used.push("bind"); }
  else if (f.who && db.relation_variants.includes(variant)) { p3 = line("who", f.who, level, db, text); used.push("who"); }
  else if (f.event && !used.includes("event")) { p3 = line("event", f.event, level, db, text); used.push("event"); }
  return { page1: p1, page3: p3, used, facts: f };
}
// 2안 검사: 한 문장, 길이, 금지어, 원문 낱말(또는 사정 칸 값) 하나 이상, 원문에 없는 숫자 금지.
export function checkFreeLine(lineText, text, facts = {}, db) {
  const s = String(lineText || "").trim(), F = db.free_line, errors = [];
  if (!s) return { ok: false, errors: ["비어 있음"] };
  if ([...s].length < F.len[0] || [...s].length > F.len[1]) errors.push("길이");
  if ((s.match(/[.!?]/g) || []).length !== 1 || !/[다요]\.$/.test(s)) errors.push("한 문장·마침");
  if (s.includes("?")) errors.push("물음");
  for (const w of F.banned) if (s.includes(w)) errors.push(`금지어:${w}`);
  const toks = (String(text).match(/[가-힣]{2,}/g) || []).filter((w) => w.length >= 2 && !/^(그리고|근데|그래서|너무|정말|진짜|지금|요즘|제가|저는|나는|내가|있어요|없어요|같아요|할까요|될까요|있을까요)$/.test(w));
  const stems = toks.map((w) => w.slice(0, 2));
  const cf = cleanFacts(text, facts);
  const hit = Object.values(cf).some((v) => s.includes(v)) || stems.some((st) => s.includes(st));
  if (!hit) errors.push("원문 낱말 없음");
  for (const d of s.match(/\d+/g) || []) if (!String(text).includes(d)) errors.push(`원문에 없는 숫자:${d}`);
  return { ok: errors.length === 0, errors };
}
// 1쪽·2쪽 무료 줄을 모아 줌. 2안은 41자 이상 글에서만, 검사 통과한 줄만. 1쪽은 2안 > 1안 > 기존 덧줄.
export function freeSection({ text, facts = {}, freeLines = null, variant = null, level = 1 }, db) {
  const fl = factLines({ text, facts, variant, level }, db);
  const long = [...String(text || "")].length >= db.free_line.min_chars;
  const c1 = long && freeLines ? checkFreeLine(freeLines.p1, text, facts, db) : null;
  const c2 = long && freeLines ? checkFreeLine(freeLines.p2, text, facts, db) : null;
  return {
    page1: c1 && c1.ok ? String(freeLines.p1).trim() : fl.page1,
    page1_source: c1 && c1.ok ? "free" : fl.page1 ? "fact" : null,
    page2: c2 && c2.ok ? String(freeLines.p2).trim() : "",
    page3: fl.page3,
    used: fl.used, facts: fl.facts,
    free_errors: { p1: c1 && !c1.ok ? c1.errors : null, p2: c2 && !c2.ok ? c2.errors : null },
  };
}
