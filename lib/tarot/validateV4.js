// v4.0 (새로) AI 출력 검증 — A2(고민 틀) · C(2~5쪽, 3장째 뽑는 순간) · E(7~10쪽, 결제 직후)
//   assembleReport.js의 parse/validate 방식을 따름: 통과한 값만 쓰고, 걸린 칸은 null → 코드가 대체 문장으로 채움.
//   모든 parse*는 { ..., errors: [] }를 돌려줌 — errors가 비어 있지 않으면 무엇이 걸렸는지 적혀 있음(재생성 1회·운영 로그용).
//   v4.1: parseFrame이 A2 v4.6 새 형식(table 10개·mode axis/rank·options_ranked·decision_source·confidence)을 검증. 옛 형식도 통과.
//   규칙: V1(v4 금지어) · V3(폭력 구체 행동일 때만 다가가기 금지) · V9(선택지 이름·원문 구절) · V10(모호한 말·가정 행동·문학 표현) · R4(방향 문장에 열어 두는 표현 금지)
import { parseLinks, forbiddenHitsV4, APPROACH_WORDS } from "./assembleReport.js";
import { cleanOption, isNewFrame, isDecisionFrame, MODES } from "./decision.js";

export const WORRY_TYPES = ["decision", "relationship_question", "situation", "feeling"];
export const TABLE_TYPES = ["job", "start", "move", "approach", "reunion", "progress", "continue", "newlove", "express", "boundary"]; // v4.1: 10개(act 없음)

const parseObj = (raw) => {
  if (raw && typeof raw === "object") return raw;
  const t = String(raw || "");
  const i = t.indexOf("{"), j = t.lastIndexOf("}");
  if (i < 0 || j < i) return null;
  try { return JSON.parse(t.slice(i, j + 1)); } catch { return null; }
};
const str = (x) => typeof x === "string" && x.trim().length > 0;
const allText = (x) => (typeof x === "string" ? [x] : Array.isArray(x) ? x.flatMap(allText) : x && typeof x === "object" ? Object.values(x).flatMap(allText) : []);

// ---- V10: 문학 표현 · 모호한 말(뒤에 구체어 없이) · 가정 행동 ----
const LITERARY = [/머금/, /데우/, /데워/, /길을 비춥니다/, /길을 비춰/];
export const VAGUE = ["찜찜함", "막연함", "어딘가", "무언가", "뭔가", "그 무엇", "마음의 자리", "어떤 흐름"];
const HYPOTHETICAL = [/하루(씩|만|동안)?\s?[^.?!]{0,12}살아\s?보/, /인 척\s?(지내|살아)/, /척하며 지내/, /역할극/, /상상 속 (대화|인물|상대)/, /상상(으로|해서) (말|대화)/];
export function v10Hits(text) {
  const t = String(text || ""), out = [];
  LITERARY.forEach((re) => { const m = t.match(re); if (m) out.push(`문학 표현 '${m[0]}'`); });
  // 모호한 말: 바로 뒤에 '(원문 말)' 같은 구체어가 붙지 않으면(조사·공백·문장 끝) 걸림
  VAGUE.forEach((w) => { let k = t.indexOf(w); while (k >= 0) { const after = t.slice(k + w.length, k + w.length + 2); if (!/^[(:‘'"]/.test(after)) { out.push(`모호한 말 '${w}'`); break; } k = t.indexOf(w, k + 1); } });
  HYPOTHETICAL.forEach((re) => { const m = t.match(re); if (m) out.push(`가정 행동 '${m[0]}'`); });
  return out;
}
// V1 + '결정은 당신에게' + 학자·영어 + (폭력일 때) 다가가기
const SCHOLARS = ["프랭클", "셀리그먼", "네프", "헤이스", "리네한", "엘리스", "길버트", "칙센트미하이", "반두라", "프레드릭슨", "페니베이커", "위니컷", "스나이더", "브리지스", "워든"];
export function ruleHitsV4(text, { violence = false } = {}) {
  const t = String(text || "");
  return [...forbiddenHitsV4(t).map((w) => `금지어 '${w}'`), ...SCHOLARS.filter((w) => t.includes(w)).map((w) => `학자 이름 '${w}'`),
    ...((t.match(/[A-Za-z]{3,}/g) || []).slice(0, 1).map((w) => `영어 '${w}'`)),
    ...(violence ? APPROACH_WORDS.filter((w) => t.includes(w)).map((w) => `폭력 확인 시 다가가기 '${w}'`) : [])];
}
// R4: 방향·결론 문장에 열어 두는 표현 금지
// R2(2026-10-22): 결론 문단에 제3안·절충 금지 — 제3안은 계획·처방에서 '결론을 실행하는 방법'으로만
export const THIRD_WAY = /둘 다|양쪽 다|두 쪽의 좋은 점|양쪽의 좋은 점|절충|제3의|제 3의|세 번째 길|중간 지점|둘을 섞|둘 다 아닌/;
export const OPEN_ENDED = /수 있어요|수 있습니다|수도 있|일 수도|일지도|[을를]지도 몰|[가-힣]ㄹ지도|할지도|될지도|갈지도/;

// ---- A2 고민 틀 ----
// v4.6 새 형식: {"table","decision_source","mode","rank_reason","worry_type","options_ranked","core_question","hidden_question","deadline","duration","money","user_words","confidence"}
//   table 10개|null, mode axis|rank, options_ranked 2~4개·중복 없음(table이 있을 때), rank면 rank_reason 문자열, decision_source explicit|implicit|none, confidence high|low
//   table이 "null"(문자열)이면 null로 읽음(모델이 가끔 이렇게 냄). table null이면 options_ranked는 []로 둠.
//   통과하면 옛 코드와 맞도록 options(= options_ranked)·option_axis({move: [0], stay: [1]})도 채워 돌려줌.
// 옛 형식(v4.0): {"worry_type","options","option_axis","core_question","hidden_question","deadline","duration","money","table","user_words"} — 계속 통과
export const DECISION_SOURCES = ["explicit", "implicit", "none"];
export const CONFIDENCES = ["high", "low"];
function commonFrameChecks(o, errors) {
  if (!WORRY_TYPES.includes(o.worry_type)) errors.push(`worry_type '${o.worry_type}'은(는) 4종(${WORRY_TYPES.join("/")})이 아님`);
  if (!str(o.core_question) || !o.core_question.trim().endsWith("?")) errors.push("core_question이 물음표로 끝나는 문장이 아님");
  if (typeof o.money !== "boolean") errors.push("money가 true/false가 아님");
  if (o.hidden_question != null && !str(o.hidden_question)) errors.push("hidden_question 형식");
  if (o.user_words != null && !(Array.isArray(o.user_words) && o.user_words.every(str))) errors.push("user_words 형식");
}
export function parseFrame(raw) {
  const o0 = parseObj(raw), errors = [];
  if (!o0) return { frame: null, errors: ["JSON 아님"] };
  if (isNewFrame(o0)) return parseFrameV46(o0);
  const o = o0;
  commonFrameChecks(o, errors);
  const decision = o.worry_type === "decision";
  if (decision) {
    const opts = Array.isArray(o.options) ? o.options : [];
    if (opts.length < 2 || opts.length > 3 || !opts.every(str)) errors.push(`decision인데 options가 2~3개 문장이 아님(${opts.length}개)`);
    const ax = o.option_axis;
    if (!ax || !str(ax.move) || !str(ax.stay)) errors.push("decision인데 option_axis.move/stay 없음");
    else {
      const inOpts = (x) => opts.includes(x) || opts.map(cleanOption).includes(cleanOption(x));
      if (!inOpts(ax.move)) errors.push(`option_axis.move '${ax.move}'가 options 안에 없음`);
      if (!inOpts(ax.stay)) errors.push(`option_axis.stay '${ax.stay}'가 options 안에 없음`);
      if (cleanOption(ax.move) === cleanOption(ax.stay)) errors.push("option_axis.move와 stay가 같음");
    }
  }
  if (!(o.table === null || TABLE_TYPES.includes(o.table))) errors.push(`table '${o.table}'은(는) ${TABLE_TYPES.length}종(${TABLE_TYPES.join("/")})|null이 아님`);
  if (errors.length) return { frame: null, errors };
  const frame = { ...o, options: decision ? o.options : [], option_axis: decision ? o.option_axis : null, table: decision ? o.table ?? null : null,
    hidden_question: o.hidden_question || null, deadline: o.deadline || null, duration: o.duration || null, user_words: o.user_words || [] };
  return { frame, errors };
}
function parseFrameV46(o0) {
  const errors = [];
  const o = { ...o0, table: o0.table === "null" || o0.table === "" || o0.table === undefined ? null : o0.table };
  commonFrameChecks(o, errors);
  if (!(o.table === null || TABLE_TYPES.includes(o.table))) errors.push(`table '${o.table}'은(는) ${TABLE_TYPES.length}종(${TABLE_TYPES.join("/")})|null이 아님`);
  if (!DECISION_SOURCES.includes(o.decision_source)) errors.push(`decision_source '${o.decision_source}'은(는) ${DECISION_SOURCES.join("/")}이 아님`);
  if (!CONFIDENCES.includes(o.confidence)) errors.push(`confidence '${o.confidence}'은(는) high/low가 아님`);
  const has = o.table !== null && TABLE_TYPES.includes(o.table);
  const opts = Array.isArray(o.options_ranked) ? o.options_ranked : o.options_ranked == null ? [] : null;
  if (opts === null) errors.push("options_ranked가 목록이 아님");
  if (has) {
    if (!MODES.includes(o.mode)) errors.push(`mode '${o.mode}'은(는) axis/rank가 아님`);
    if (opts && (opts.length < 2 || opts.length > 4 || !opts.every(str))) errors.push(`table이 있는데 options_ranked가 2~4개 문장이 아님(${opts.length}개)`);
    if (opts && new Set(opts.map(cleanOption)).size !== opts.length) errors.push("options_ranked에 같은 선택지가 두 번");
    if (o.mode === "axis" && opts && opts.length > 2) errors.push(`mode axis인데 options_ranked가 ${opts.length}개(axis는 [+ 쪽, − 쪽] 2개)`);
    if (o.mode === "rank" && !str(o.rank_reason)) errors.push("mode rank인데 rank_reason(1순위가 앞인 이유) 문장이 없음");
    if (o.decision_source === "none") errors.push("table이 있는데 decision_source가 none");
  }
  if (errors.length) return { frame: null, errors };
  const r = has ? opts : [];
  const frame = { ...o, mode: has ? o.mode : null, rank_reason: has && o.mode === "rank" ? o.rank_reason : null, options_ranked: r,
    options: r, option_axis: has ? { move: r[0], stay: r[1] } : null,
    hidden_question: o.hidden_question || null, deadline: o.deadline || null, duration: o.duration || null, user_words: o.user_words || [] };
  return { frame, errors };
}

// ---- C: 기존 parseLinks(v4 금지어) + teaser_headline·teaser_lead(결론을 숨김) + reasons(결정형만) ----
const CONCLUSION_WORDS = ["남는", "떠나는", "수락", "거절", "옮기는", "머무는", "그만두는", "남기로", "떠나기로"];
// 결론을 드러내는가: 선택지를 모두 나란히 적은 경우(2안 "A와 B 중")는 그 이름들을 지우고 나머지만 봄
export function revealsConclusion(text, { frame, option }) {
  let t = String(text || "");
  const names = frame ? (frame.options_ranked || frame.options || []).map(cleanOption) : [];
  if (names.length >= 2 && names.every((n) => t.includes(n))) names.forEach((n) => { t = t.split(n).join(" "); });
  const hits = [];
  if (option && t.includes(option)) hits.push(`결론 선택지 이름 '${option}'`);
  CONCLUSION_WORDS.forEach((w) => { if (t.includes(w)) hits.push(`결론 낱말 '${w}'`); });
  return hits;
}
export function parseC(raw, { decision = false, strength = null, frame = null, lean = null, option = null, violence = false } = {}) {
  const o = parseObj(raw), errors = [];
  if (!o) return { links: null, teaser_headline: null, teaser_lead: null, reasons: null, errors: ["JSON 아님"] };
  const links = parseLinks(o, { violence, v4: true });
  if (!links) errors.push("now/hold/step line 규칙(15~90자·요/다로 끝·제안 없음·금지어) 위반");
  else {
    if (!links.headline) errors.push("headline 규칙 위반");
    if (!links.lead) errors.push("lead 규칙 위반");
    ["now", "hold", "step"].forEach((k) => { if (!links[k].ask) errors.push(`${k}.ask 모양 위반`); });
  }
  const v10 = v10Hits(allText([o.now, o.hold, o.step, o.headline, o.lead, o.teaser_headline, o.teaser_lead, o.reasons]).join("\n"));
  if (v10.length) errors.push(...v10.map((x) => `V10 ${x}`));
  let teaser_headline = null, teaser_lead = null, reasons = null;
  if (decision) {
    const concl = option || (lean && lean.option) || null;
    const th = String(o.teaser_headline || "").trim(), tl = String(o.teaser_lead || "").trim();
    const thErr = [], tlErr = [];
    if (th.length < 8 || th.length > 40 || /[.!?]$/.test(th)) thErr.push("teaser_headline 8~40자·마침표 없음 위반");
    if (tl.length < 25 || tl.length > 120 || (tl.match(/[.?!](?=\s|$)/g) || []).length !== 1 || !/(요|다)\.$/.test(tl)) tlErr.push("teaser_lead 한 문장 25~120자 위반");
    thErr.push(...revealsConclusion(th, { frame, option: concl }).map((x) => `teaser_headline이 결론을 드러냄: ${x}`), ...ruleHitsV4(th, { violence }));
    tlErr.push(...revealsConclusion(tl, { frame, option: concl }).map((x) => `teaser_lead가 결론을 드러냄: ${x}`), ...ruleHitsV4(tl, { violence }));
    if (strength === "slight" && /분명한|뚜렷한/.test(th + tl)) tlErr.push("강도 '조금 더'인데 teaser가 '분명한/뚜렷한'(R7 2안을 써야 함)");
    if (v10Hits(th + "\n" + tl).length) thErr.push("teaser V10");
    if (!thErr.length && !tlErr.length) { teaser_headline = th; teaser_lead = tl; } else errors.push(...thErr, ...tlErr);
    const rs = Array.isArray(o.reasons) ? o.reasons.map((x) => String(x || "").trim()) : [];
    const names = frame ? (frame.options_ranked || frame.options || []).map(cleanOption) : [];
    const rErr = [];
    if (rs.length !== 3) rErr.push(`reasons가 3개가 아님(${rs.length}개)`);
    rs.forEach((r, i) => {
      if (r.length < 30 || r.length > 90) rErr.push(`reasons[${i}] 30~90자 위반(${r.length}자)`);
      if (!/(요|다)\.$/.test(r)) rErr.push(`reasons[${i}] 끝맺음`);
      names.forEach((n) => { if (r.includes(n)) rErr.push(`reasons[${i}]에 선택지 이름 '${n}'`); });
      rErr.push(...ruleHitsV4(r, { violence }).map((x) => `reasons[${i}] ${x}`), ...v10Hits(r).map((x) => `reasons[${i}] V10 ${x}`));
    });
    if (!rErr.length) reasons = rs; else errors.push(...rErr);
  }
  return { links, teaser_headline, teaser_lead, reasons, errors };
}

// ---- E: 7쪽 direction(결정형) 또는 최상위 plan(비결정형) · 8쪽 change · 9쪽 rx · 10쪽 practices ----
function checkPlan(p, where, errors) {
  if (!p || !str(p.when) || !str(p.where) || !str(p.how)) { errors.push(`${where} when/where/how 없음`); return; }
  const n = p.how.trim().length;
  if (n < 20 || n > 70) errors.push(`${where}.how 20~70자 위반(${n}자)`);
}
// V9: 쪽마다 선택지 이름·원문 구절(user_words·기한·기간) 중 하나 이상
export function anchorsOf(frame) {
  if (!frame) return [];
  return [...(frame.options_ranked || frame.options || []).map(cleanOption), ...(frame.user_words || []), frame.deadline, frame.duration].filter(str);
}
export function parseE(raw, { lean = null, frame = null, violence = false } = {}) {
  const o = parseObj(raw), errors = [];
  if (!o) return { E: null, errors: ["JSON 아님"] };
  const decision = !!(lean && isDecisionFrame(frame));
  if (decision) {
    const d = o.direction;
    if (!d || typeof d !== "object") errors.push("결정형인데 direction 없음");
    else {
      const opt = lean.option;
      const headRe = new RegExp(`세 장은 (?:뚜렷하게 |분명하게 |조금 더 )?‘${opt.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}’ 쪽`);
      if (!str(d.head) || !headRe.test(d.head)) errors.push(`direction.head가 "세 장은 ‘${opt}’ 쪽"을 포함하지 않음`);
      if (!str(d.lean) || !d.lean.trim().startsWith(opt)) errors.push(`direction.lean이 선택지 이름 '${opt}'로 시작하지 않음`);
      const bl = str(d.body) ? d.body.trim().length : 0;
      if (bl < 180 || bl > 420) errors.push(`direction.body 180~420자 위반(${bl}자)`);
      if (!str(d.timing)) errors.push("direction.timing 없음");
      if (!Array.isArray(d.if_then) || d.if_then.length !== 2 || !d.if_then.every(str)) errors.push("direction.if_then 2개 아님");
      if (!str(d.decide_by) || !d.decide_by.trim().endsWith("?")) errors.push("direction.decide_by가 '?'로 끝나지 않음");
      checkPlan(d.plan, "direction.plan", errors);
      const dirText = [d.head, d.lean, d.body, d.timing, ...(Array.isArray(d.if_then) ? d.if_then : []), d.decide_by].filter(str);
      dirText.forEach((s) => { const m = s.match(OPEN_ENDED); if (m) errors.push(`R4 방향 문장에 열어 두는 표현 '${m[0]}'`); });
      [d.head, d.lean, d.body].filter(str).forEach((s) => { const m = s.match(THIRD_WAY); if (m) errors.push(`R2 결론 문단에 제3안·절충 표현 '${m[0]}' — 제3안은 plan·rx에 '결론을 실행하는 방법'으로`); });
      const other = lean.other ? cleanOption(lean.other) : frame.option_axis && cleanOption(frame.option_axis[lean.side === "move" ? "stay" : "move"]);
      if (other && str(d.head) && d.head.includes(`‘${other}’ 쪽이에요`)) errors.push("direction.head가 다른 선택지를 결론으로 씀");
    }
  } else {
    if (o.direction != null) errors.push("결정형이 아닌데 direction이 null이 아님");
    checkPlan(o.plan, "plan", errors);
  }
  const ch = o.change;
  if (!ch || !str(ch.head) || !str(ch.body)) errors.push("change.head/body 없음");
  if (!ch || !Array.isArray(ch.signs) || ch.signs.length !== 3) errors.push("change.signs 3개 아님");
  else ch.signs.forEach((s, i) => { const n = String(s || "").trim().length; if (n < 25 || n > 70) errors.push(`change.signs[${i}] 25~70자 위반(${n}자)`); });
  if (!Array.isArray(o.rx) || o.rx.length !== 2 || !o.rx.every((r) => r && ["bridge", "title", "how", "why"].every((k) => str(r[k])))) errors.push("rx 2개(bridge·title·how·why) 아님");
  const pr = o.practices;
  if (!pr || !["today", "three", "week"].every((k) => pr[k] && ["title", "how", "time", "why"].every((f) => str(pr[k][f])))) errors.push("practices today/three/week(title·how·time·why) 아님");
  // V1·V3·V10, 직접 종료 권유·'결정은 당신에게'
  const text = allText(o).join("\n");
  errors.push(...ruleHitsV4(text, { violence }).map((x) => `V1 ${x}`), ...v10Hits(text).map((x) => `V10 ${x}`));
  if (/결정적인 판단은/.test(text)) errors.push("R10 돈 안내 문구는 코드가 붙임(AI가 쓰면 안 됨)");
  // V9(결정형): 7·8·9·10쪽 각각에 선택지 이름·원문 구절이 하나도 없으면 탈락
  if (decision) {
    const A = anchorsOf(frame);
    [["7쪽 direction", o.direction], ["8쪽 change", o.change], ["9쪽 rx", o.rx], ["10쪽 practices", o.practices]].forEach(([nm, part]) => {
      const t = allText(part).join("\n");
      if (t && !A.some((a) => t.includes(a))) errors.push(`V9 ${nm}에 선택지 이름·원문 구절이 하나도 없음`);
    });
  }
  return { E: errors.length ? null : o, errors };
}
