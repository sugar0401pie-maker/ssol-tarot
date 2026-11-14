// v4.3 (2026-11-05 CSO, 실제 고민 975건 분석 반영)
//   ① 고민 틀(A2) 새 칸: want(듣고 싶은 답) · love_status(연애 단계) · stage(단계) · control(답이 누구 손에) · area(세부 영역 — 취업 JOB·시험 EDU 분리)
//   ③ 3쪽 '두 장 중간 결과' + 세 번째 카드 예고(want별) — 1·2번 카드만 보여 주고 3번째 카드는 결제 전 뒷면
//   ④ 7쪽 맨 위 '답 먼저' 한 줄(예측·시기·상대 마음) — DB(answer_first_db.json), 조건 문장은 붙이지 않음
//   ⑤⑥ 예측 질문(want yesno·when + 선택지 미기재)이면 선택지를 '될 흐름 / 어려운 흐름'(decision_tables forecast_options)으로
//   ⑨ A/B 배정(variantOf)과 결제 분석용 기록(eventFields)
//   사용: frame = normalizeFrameV43(parseFrameV43(...).frame) → applySubDefaults(frame, subDb) → resolveTable(frame, subDb, tables, {safety}) → applyForecastOptions(frame, tables) → lean(...) → buildPagesV43({...})
//   v2.3.11 resolveTable: 세부 고민의 점수표 규칙(table_rule)으로 A2의 table을 맞춤 — 같은 세부면 늘 같은 점수표 계열
import { buildPagesV4 } from "./pagesV4.js";
import { cleanOption, cardKey } from "./decision.js";
import { GWA_WA } from "./josa.js";
import { forceOf } from "./assembleReport.js";
import { parseFrame, WORRY_TYPES as WT, TABLE_TYPES as TT } from "./validateV4.js";

export const WANTS = ["yesno", "when", "their_mind", "which", "how", "why", "comfort", "unclear"];
export const LOVE_STATUS = ["single", "some", "crush", "dating", "ex", "married", "unknown"];
export const STAGES = ["before", "waiting", "after_fail", "ongoing", "none"];
export const CONTROLS = ["me", "other", "outside", "mixed"];
export const AREAS = ["LOV", "CAR", "JOB", "EDU", "DIR", "FAM", "SOC", "LIF", "SELF", "FORT", "NONE"];
// v2.3.7 연애 세부 주제(A2 v4.8 love_topic) — 중간 결과 묶음·3쪽 첫 문장에 씀
export const LOVE_TOPICS = ["marriage", "distance", "conflict", "breakup_consider", "future", "crush_progress", "reunion", "new"];
const pick = (v, list) => (list.includes(v) ? v : null);

// ① A2 새 칸 검사(틀린 값은 null — 결과는 그대로 진행, warnings로 남김)
export function normalizeFrameV43(frame, cls = null) {
  if (!frame) return frame;
  const warnings = [];
  const f = { ...frame };
  for (const [k, list] of [["want", WANTS], ["love_status", LOVE_STATUS], ["love_topic", LOVE_TOPICS], ["stage", STAGES], ["control", CONTROLS], ["area", AREAS]]) {
    if (f[k] != null && !list.includes(f[k])) warnings.push(`${k} '${f[k]}' 허용값 아님 → null`);
    f[k] = pick(f[k], list);
  }
  if (!f.area && cls && cls.domain) f.area = pick(cls.domain, AREAS); // A2가 area를 안 주면 A 분류 영역
  if (f.area !== "LOV") { f.love_status = null; f.love_topic = null; }
  if (f.sub_id != null && !(typeof f.sub_id === "string" && /^[A-Z0-9]+-[A-Z0-9]+$/.test(f.sub_id))) { warnings.push(`sub_id '${f.sub_id}' 형식 아님 → null`); f.sub_id = null; }
  return Object.defineProperty(f, "v43_warnings", { value: warnings, enumerable: false });
}

// v2.3.7 고민 틀 '부분 살리기' — 칸 하나가 형식에 안 맞아도 고민 상자·예고가 통째로 사라지지 않게
//   1) parseFrame 통과면 그대로  2) 고칠 수 있는 칸(confidence·worry_type·물음표·money·decision_source·mode·선택지 개수·표 이름)을 고쳐 다시 검사
//   3) 그래도 안 되면 표 없이 '결국 묻는 것·먼저 풀어야 할 물음·원문 구절·기한·새 칸'만 살린 틀(salvaged: true)
export function parseFrameV43(raw) {
  const first = parseFrame(raw);
  if (first.frame) return { frame: first.frame, errors: [], fixed: [], salvaged: false };
  let o; try { o = typeof raw === "string" ? JSON.parse(String(raw).replace(/^```(json)?|```$/g, "").trim()) : raw; } catch { o = null; }
  if (!o || typeof o !== "object") return { frame: null, errors: first.errors, fixed: [], salvaged: false };
  const fixed = [], f = { ...o };
  const fix = (k, v) => { fixed.push(`${k}: ${JSON.stringify(f[k])} → ${JSON.stringify(v)}`); f[k] = v; };
  const s = (x) => typeof x === "string" && x.trim().length > 0;
  if (!["high", "low"].includes(f.confidence)) fix("confidence", "low");
  if (f.table === "null" || f.table === "" || (f.table != null && !TT.includes(f.table))) fix("table", null);
  const opts = Array.isArray(f.options_ranked) ? f.options_ranked.filter(s) : [];
  if (!WT.includes(f.worry_type)) fix("worry_type", opts.length >= 2 ? "decision" : "situation");
  if (s(f.core_question) && !f.core_question.trim().endsWith("?")) fix("core_question", f.core_question.trim().replace(/[.!…~]+$/, "") + "?");
  if (typeof f.money !== "boolean") fix("money", f.money === "true");
  if (f.hidden_question != null && !s(f.hidden_question)) fix("hidden_question", null);
  if (f.user_words != null && !(Array.isArray(f.user_words) && f.user_words.every(s))) fix("user_words", Array.isArray(f.user_words) ? f.user_words.filter(s) : []);
  if (f.table) {
    if (opts.length < 2) fix("table", null);
    else {
      if (f.mode !== "axis" && f.mode !== "rank") fix("mode", "axis");
      if (f.mode === "rank" && !s(f.rank_reason)) fix("mode", "axis");
      if (f.mode === "axis" && opts.length > 2) fix("options_ranked", opts.slice(0, 2));
      if (!["explicit", "implicit"].includes(f.decision_source)) fix("decision_source", "implicit");
    }
  }
  if (!f.table) { if (!["explicit", "implicit", "none"].includes(f.decision_source)) fix("decision_source", "none"); }
  const second = parseFrame(f);
  if (second.frame) return { frame: second.frame, errors: first.errors, fixed, salvaged: false };
  if (!s(f.core_question)) return { frame: null, errors: first.errors.concat(second.errors), fixed, salvaged: false };
  const frame = { table: null, decision_source: "none", mode: null, rank_reason: null, worry_type: "situation", options_ranked: [], options: [], option_axis: null,
    core_question: f.core_question.trim().endsWith("?") ? f.core_question.trim() : f.core_question.trim() + "?", hidden_question: s(f.hidden_question) ? f.hidden_question : null,
    deadline: s(f.deadline) ? f.deadline : null, duration: s(f.duration) ? f.duration : null, money: f.money === true,
    user_words: Array.isArray(f.user_words) ? f.user_words.filter(s) : [], confidence: "low",
    want: f.want, love_status: f.love_status, love_topic: f.love_topic, stage: f.stage, control: f.control, area: f.area, salvaged: true };
  return { frame, errors: first.errors.concat(second.errors), fixed, salvaged: true };
}

// v2.3.8 세부 고민(sub_id, 117개 — 02_데이터/worry_subtopics.json): A2가 고른 세부의 기본값으로 빈 칸을 채움
// v2.3.11 영역 묶음 — 실제 서비스가 취업·시험 고민을 '진로'로 붙이는 일이 많아(11/9까지 104건) 같은 묶음 안이면 세부의 영역으로 맞춤
export const AREA_FAMILY = { DIR: "path", JOB: "path", EDU: "path", CAR: "work", LOV: "love", LIF: "life", FAM: "people", SOC: "people", SELF: "self", FORT: "vague", NONE: "vague" };
export const sameAreaFamily = (a, b) => Boolean(a && b && AREA_FAMILY[a] && AREA_FAMILY[a] === AREA_FAMILY[b]);

export function applySubDefaults(frame, subDb) {
  if (!frame || !subDb || !subDb.subs) return frame;
  const sub = frame.sub_id ? subDb.subs[frame.sub_id] : null;
  if (frame.sub_id && !sub) return { ...frame, sub_id: null };
  if (!sub) return frame;
  const f = { ...frame };
  if (!f.area) f.area = sub.area;
  else if (f.area !== sub.area && sameAreaFamily(f.area, sub.area)) f.area = sub.area; // 진로 ↔ 취업·시험처럼 같은 묶음이면 더 구체적인 세부 영역으로
  if (f.area === "LOV") { if (!f.love_status && sub.love_status) f.love_status = sub.love_status; if (!f.love_topic && sub.love_topic) f.love_topic = sub.love_topic; }
  if (!f.want && sub.want) f.want = sub.want;
  return f;
}

// v2.3.14 결과 틀(두 단계 고르기) — worry_subtopics.json v4의 frames
//   결과 틀 = 영역·기본 점수표·3쪽 중간 결과 묶음이 같은 세부 묶음(50개). A2 v4.12는 "frame_id"(틀)를 먼저 고르고 그 안에서 sub_id를 고름.
//   resolveFrame: ① 틀과 세부가 맞으면 그대로 ② 세부만 있으면 그 세부의 틀 ③ 틀만 있으면 그 틀의 대표 세부
//                ④ 둘이 어긋나면 틀을 믿고 대표 세부로(틀 정확도가 세부보다 높음 — 운영 1,434건: 틀 90% · 세부 70%).
//                   단 틀의 영역이 frame.area와 다른 묶음이고 세부의 영역은 맞으면 세부를 믿음.
//   순서: normalizeFrameV43 → resolveFrame → applySubDefaults → resolveTable → applyForecastOptions
export function frameOf(subId, subDb) { const s = subDb && subDb.subs && subDb.subs[subId]; return s ? s.frame || null : null; }
export function resolveFrame(frame, subDb) {
  if (!frame || !subDb || !subDb.frames) return frame;
  const F = subDb.frames, S = subDb.subs;
  const fid = typeof frame.frame_id === "string" && F[frame.frame_id] ? frame.frame_id : null;
  const sid = frame.sub_id && S[frame.sub_id] ? frame.sub_id : null;
  const done = (o, how) => ({ ...frame, ...o, frame_fix: { from_frame: frame.frame_id || null, from_sub: frame.sub_id || null, how } });
  if (!fid && !sid) return done({ frame_id: null, sub_id: null }, "none");
  if (!fid) return done({ frame_id: S[sid].frame, sub_id: sid }, "frame_from_sub");
  if (!sid) return done({ frame_id: fid, sub_id: F[fid].rep }, "sub_from_frame");
  if (S[sid].frame === fid) return done({ frame_id: fid, sub_id: sid }, "kept");
  const areaOk = (a) => !frame.area || a === frame.area || sameAreaFamily(a, frame.area);
  if (!areaOk(F[fid].area) && areaOk(S[sid].area)) return done({ frame_id: S[sid].frame, sub_id: sid }, "sub_wins_area");
  return done({ frame_id: fid, sub_id: F[fid].rep, sub2: frame.sub2 || sid }, "frame_wins");
}
// A2 v4.12의 {SUB_BLOCK}: 후보 세부를 틀별로 묶어 보여 주고(정의·구분·점수표 규칙), 나머지 틀은 이름과 세부 id·이름만.
//   compact: true면 나머지 틀은 '틀 id · 이름'만(프롬프트가 짧아짐 — 후보 안 비율이 충분히 높을 때)
export function subPromptBlockFrames(candidates, subDb, { compact = false } = {}) {
  const S = (subDb && subDb.subs) || {}, F = (subDb && subDb.frames) || {}, cand = (candidates || []).filter((k) => S[k]);
  const cf = []; for (const k of cand) if (!cf.includes(S[k].frame)) cf.push(S[k].frame);
  const lines = ["[결과 틀 후보 — 틀 id · 이름 / 그 안의 세부 id · 이름 · 구분 단서 · 이웃과 다른 점 · 점수표]"];
  for (const fid of cf) { lines.push(`■ ${fid} · ${F[fid].name}`);
    for (const k of F[fid].subs) lines.push(cand.includes(k) ? `  - ${k} · ${S[k].name} · ${S[k].clue}${S[k].vs_neighbors ? ` · ${S[k].vs_neighbors}` : ""} · ${tableRuleText(S[k].table_rule)}` : `  - ${k} · ${S[k].name}`); }
  lines.push("[그 밖의 틀]");
  for (const [fid, f] of Object.entries(F)) if (!cf.includes(fid)) lines.push(compact ? `${fid} · ${f.name}` : `${fid} · ${f.name}: ${f.subs.map((k) => `${k} ${S[k].name}`).join(" / ")}`);
  return lines.join("\n");
}
// 정확도 채점(개발 측정용): 엄격(세부 1위) · 두 번째 세부 인정 · 결과 틀
export function scoreSub(pred, gold, subDb) {
  const S = subDb.subs, p = pred && pred.sub_id, g = gold.sub_id, g2 = gold.sub2 || null;
  const strict = !!p && p === g, second = strict || (!!p && p === g2);
  const pf = (pred && pred.frame_id) || (p && S[p] ? S[p].frame : null), gf = S[g] ? S[g].frame : null;
  return { strict, second, frame: !!pf && pf === gf, frame_or_second: second || (!!pf && pf === gf) };
}

// v2.3.11 점수표 규칙 — worry_subtopics.json v2의 table_rule {mode, default, allowed, choose_by}
//   fixed: 늘 default · choose: A2 표가 allowed 안이면 그대로, 아니면 default · none: 표 없음
//   지키는 것: ① 세부 영역과 frame.area가 다른 묶음이면 손대지 않음(같은 묶음 — 진로·취업·시험 — 이면 적용) ② 안전 '주의(watch)'·폭력 언급이면 표를 새로 붙이지 않음(없애기만)
//   ③ 사용자가 선택지를 직접 쓴 경우(explicit)는 선택지를 지우지 않음 — none이어도 A2 표 유지, 표만 바꿀 땐 선택지 그대로
//   ④ 표를 새로 붙이면 선택지는 그 표의 [move, stay](implicit) → 뒤의 applyForecastOptions가 예측 질문이면 '될 흐름/어려운 흐름'으로 바꿈
export function resolveTable(frame, subDb, tables, opts = {}) {
  if (!frame || !subDb || !subDb.subs || !frame.sub_id) return frame;
  const sub = subDb.subs[frame.sub_id], rule = sub && sub.table_rule;
  if (!rule || (sub.area && frame.area && sub.area !== frame.area && !sameAreaFamily(sub.area, frame.area))) return frame;
  const cur = frame.table || null, explicit = frame.decision_source === "explicit" && (frame.options_ranked || []).length >= 2;
  let to;
  if (rule.mode === "fixed") to = rule.default;
  else if (rule.mode === "none") to = explicit ? cur : null;
  else to = (rule.allowed || []).includes(cur) ? cur : rule.default;
  const safety = opts.safety || null;
  if (to && !cur && safety && (safety.level === "watch" || safety.level === "urgent" || safety.violence)) to = null;
  if (to && tables && tables.types && !tables.types[to]) to = cur;
  const mark = (f, how) => { f.table_fix = { from: cur, to: f.table, rule: rule.mode, how }; return f; }; // 보이는 칸(뒤 단계에서 {...frame}로 복사돼도 남음)
  if ((to || null) === cur) return mark({ ...frame }, "kept");
  if (!to) return mark({ ...frame, table: null, decision_source: "none", mode: null, rank_reason: null, options_ranked: [], options: [], option_axis: null, worry_type: frame.worry_type === "decision" ? "situation" : frame.worry_type }, "removed");
  if (explicit) return mark({ ...frame, table: to }, "table_only");
  const t = tables.types[to];
  return mark({ ...frame, table: to, decision_source: "implicit", mode: "axis", rank_reason: null, options_ranked: [t.move, t.stay], options: [t.move, t.stay], option_axis: { move: t.move, stay: t.stay } }, cur ? "replaced" : "added");
}

// 프롬프트에 넣는 점수표 규칙 한 줄
export function tableRuleText(rule) {
  if (!rule) return "";
  if (rule.mode === "fixed") return `점수표 ${rule.default}`;
  if (rule.mode === "none") return "점수표 없음(null)";
  return `점수표 ${(rule.allowed || []).map((x) => x || "null").join("/")} 중 — ${rule.choose_by}`;
}

// v2.3.9 A2 v4.10의 {SUB_BLOCK} — 후보(비슷한 예시에서 뽑은 세부 8개)는 정의·구분 단서까지, 나머지는 id·이름만
export function subPromptBlock(candidates, subDb) {
  const S = (subDb && subDb.subs) || {}, cand = (candidates || []).filter((k) => S[k]);
  const lines = ["[세부 고민 후보 — id · 이름 · 구분 단서 · 이웃과 다른 점]"];
  for (const k of cand) lines.push(`- ${k} · ${S[k].name} · ${S[k].clue}${S[k].vs_neighbors ? ` · ${S[k].vs_neighbors}` : ""}${S[k].table_rule ? ` · ${tableRuleText(S[k].table_rule)}` : ""}`);
  const groups = new Map();
  for (const [k, v] of Object.entries(S)) if (!cand.includes(k)) { if (!groups.has(v.group)) groups.set(v.group, []); groups.get(v.group).push(`${k} ${v.name}`); }
  lines.push("[그 밖의 세부 — id 이름]");
  for (const [g, xs] of groups) lines.push(`${g}: ${xs.join(" / ")}`);
  return lines.join("\n");
}

// ⑤⑥ 예측 질문이면 선택지를 '될 흐름 / 어려운 흐름'으로(사용자가 선택지를 쓰지 않았을 때만)
export function applyForecastOptions(frame, tables) {
  if (!frame || !frame.table) return frame;
  const fo = tables.types[frame.table] && tables.types[frame.table].forecast_options;
  if (!fo || !["yesno", "when"].includes(frame.want) || frame.decision_source !== "implicit") return frame;
  return { ...frame, options_ranked: fo.slice(), options: fo.slice(), option_axis: { move: fo[0], stay: fo[1] }, mode: "axis", forecast: true };
}

// ③ 3쪽 중간 결과 — 영역·연애 단계로 문장 묶음을 고름
export function midAreaKey(frame, cls, midDb, subDb = null) {
  const sub = frame && frame.sub_id && subDb && subDb.subs ? subDb.subs[frame.sub_id] : null;
  if (sub && sub.mid && midDb.lines[sub.mid] && (!frame.area || frame.area === sub.area)) return sub.mid; // v2.3.8 세부 고민이 가장 먼저(영역이 다르면 무시)
  const area = (frame && frame.area) || (cls && cls.domain) || "NONE";
  const map = midDb.area_keys || {};
  const v = map[area];
  if (area === "LOV" && v && typeof v === "object") {
    // v2.3.7 연애 세부: 결혼 생활 → 결혼 앞둠·떨어져 지냄·헤어질까(love_topic) → 연애 단계
    if (frame && frame.love_status === "married" && midDb.lines.LOV_MARRIED) return "LOV_MARRIED";
    const tk = frame && frame.love_topic && midDb.love_topic_keys ? midDb.love_topic_keys[frame.love_topic] : null;
    if (tk && midDb.lines[tk] && !(["LOV_SINGLE", "LOV_CRUSH", "LOV_EX"].includes(tk) && frame.love_status && frame.love_status !== "unknown")) return tk;
    const sk = v[(frame && frame.love_status) || "unknown"] || "LOV";
    return midDb.lines[sk] ? sk : "LOV";
  }
  return typeof v === "string" ? v : midDb.lines[area] ? area : "NONE";
}
export function midParagraph({ picks, frame = null, cls = null, midDb, subDb = null }) {
  const key = midAreaKey(frame, cls, midDb, subDb);
  const L = midDb.lines[key] || midDb.lines.NONE;
  const k0 = cardKey(picks[0]), k1 = cardKey(picks[1]);
  const t0 = midDb.card_themes[k0].past, t1 = midDb.card_themes[k1].present;
  const merge = midDb.merge[`${t0}>${t1[0]}`];
  return { key, merge_key: `${t0}>${t1[0]}`, text: [L[k0].past, L[k1].block, merge].filter(Boolean).join(" ") };
}

const shortQ = (frame) => String((frame && frame.core_question) || "").trim();
function withinOf(frame, V) {
  const d = `${(frame && frame.deadline) || ""}`;
  if (/올해|연말|이번 ?해|12월/.test(d)) return "올해 안에";
  if (/내년/.test(d)) return "내년까지";
  return V.within_default;
}
export function teaserLine({ frame = null, lean = null, name, data }) {
  const V = data.copy.result.v43, T = V.teasers;
  const fill = (s) => s.replaceAll("{name}", name).replaceAll("{q}", shortQ(frame)).replaceAll("{within}", withinOf(frame, V));
  if (!frame) return T.no_worry;
  const w = frame.want, tb = (lean && lean.table) || frame.table, ls = frame.love_status, area = frame.area;
  // v2.3.14 세부 전용 예고(잘 결제하는 세부 6개) — 사용자가 선택지를 직접 쓴 'which'는 기존 문구(선택지 이름)를 씀
  const ST = V.sub_teasers && frame.sub_id ? V.sub_teasers[frame.sub_id] : null;
  const explicitWhich = w === "which" && !frame.forecast && (frame.options_ranked || frame.options || []).length >= 2;
  if (ST && !explicitWhich) { const t = (w === "when" && ST.when) || (w === "their_mind" && ST.their_mind) || ST.default; if (t) return fill(t); }
  const result = tb === "start" && ["JOB", "EDU"].includes(area);
  let key = "default";
  const REL = ["approach", "reunion", "continue", "progress"];
  if (w === "their_mind" && REL.includes(tb)) key = "their_mind"; // v4.3.1 상대 마음 답(DB)이 있는 표에서만 약속
  else if (w === "when") key = tb === "newlove" ? "when_love" : tb === "reunion" ? "when_reunion" : result || tb === "start" ? "when_result" : "when_general";
  else if (w === "yesno" || w === "their_mind") key = tb === "newlove" ? "yesno_single" : tb === "reunion" ? "yesno_ex" : ["approach", "progress"].includes(tb) ? "yesno_crush" : tb === "continue" ? "yesno_dating" : tb === "job" ? "yesno_job"
    : tb === "start" ? (frame.stage === "waiting" && T.yesno_result_waiting ? "yesno_result_waiting" : frame.stage === "after_fail" && T.yesno_result_after_fail ? "yesno_result_after_fail" : "yesno_result") : "yesno_general"; // v4.3.1 결과 기다림·재도전 따로
  else if (w === "which" && !frame.forecast && (frame.options_ranked || frame.options || []).length >= 2) {
    const [a, b] = (frame.options_ranked || frame.options).map(cleanOption);
    return T.which.replace("{opt1}", a).replace("{gwa}", GWA_WA(a)).replace("{opt2}", b);
  } else if (w === "comfort" && T.comfort) key = "comfort";
  else if (w === "why" && T.why) key = "why";
  else if (w === "how") key = ["approach", "reunion", "continue", "progress", "newlove"].includes(tb) && T.how_love ? "how_love" : ["start", "job"].includes(tb) && T.how_result ? "how_result" : "how";
  if (area === "FORT" && T.fortune && (key === "default" || key === "yesno_general")) key = "fortune"; // 막연한 운세
  if (/\{q\}/.test(T[key]) && !shortQ(frame)) key = w === "yesno" ? "yesno_general" : "default";
  if (/\{q\}/.test(T[key]) && !shortQ(frame)) key = "default";
  return fill(T[key]);
}


// v2.3.4 시기 = 테스트를 본 날(한국 시간)의 달에서 센 실제 달. 같은 해면 'M월', 다음 해면 처음 한 번만 '내년 M월'
export function whenMonths(bucket, R, now = new Date(), thisYear = false) {
  const tz = R.tz || "Asia/Seoul";
  const ym = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "numeric" }).formatToParts(now);
  const Y = +ym.find((x) => x.type === "year").value, M = +ym.find((x) => x.type === "month").value;
  const offs = (R.months && R.months[bucket]) || null;
  if (!offs) return (R.labels_fallback || {})[bucket] || "";
  const at = (o) => { const t = M - 1 + o; return { y: Y + Math.floor(t / 12), m: (t % 12) + 1 }; };
  const ms = offs.map(at);
  if (bucket === "early" && thisYear && ms[0].y === Y && R.this_year_tpl) return R.this_year_tpl.replace("{a}", `${ms[0].m}월`);
  let yearSaid = false;
  const word = (x) => { const yr = x.y === Y ? "" : x.y === Y + 1 ? "내년 " : `${x.y}년 `; if (!yr || yearSaid) return `${x.m}월`; yearSaid = true; return `${yr}${x.m}월`; };
  const [a, b] = ms.map(word);
  return R.label_tpl[bucket].replace("{a}", a).replace("{b}", b || "");
}
// ④ 7쪽 '답 먼저' 한 줄
export function answerFirst({ frame, lean, picks, db, data = null, now = new Date() }) {
  if (!frame) return null;
  if (!lean) { // v4.3.1 점수표 없는 고민: 앞으로의 열쇠 카드의 힘으로(예고가 약속한 답을 빠뜨리지 않게)
    const G = db.forecast_general;
    if (!G || !data || !["yesno", "when"].includes(frame.want) && frame.area !== "FORT") return null;
    const fc = forceOf(picks[2], data);
    if (frame.want === "when") {
      const b = G.timing_bucket[fc], line = db.timing.general && db.timing.general[b];
      return line ? { kind: "timing", bucket: b, general: true, text: line.replace("{when}", whenMonths(b, db.timing_rule, now)) } : null;
    }
    return { kind: "forecast", general: true, force: fc, text: G[fc] };
  }
  const w = frame.want, tb = lean.table;
  if (w === "their_mind") {
    const t = tb === "progress" ? "approach" : tb;
    const line = db.their_mind[t] && db.their_mind[t][cardKey(picks[2])];
    return line ? { kind: "their_mind", text: line } : null;
  }
  if (w === "yesno") {
    const byArea = db.forecast_by_area && db.forecast_by_area[tb] && db.forecast_by_area[tb][frame.area]; // v4.3.1 시작·실행은 취업·시험·도전·생활별
    const src = byArea || db.forecast[tb];
    const f = src && src[lean.side] && src[lean.side][lean.strength];
    return f ? { kind: "forecast", text: f } : null;
  }
  if (w === "when") {
    const R = db.timing_rule, TT = db.timing_topic;
    const bucket = lean.side === "move" ? R.move[lean.strength] : R.stay;
    const topic = tb === "start" && ["JOB", "EDU"].includes(frame.area) ? TT.start_result : TT[tb] || TT.default;
    const line = db.timing[topic] && db.timing[topic][bucket];
    if (!line) return null;
    const thisYear = /올해|연말|이번 ?해/.test(`${frame.deadline || ""}`);
    const label = whenMonths(bucket, R, now, thisYear);
    return { kind: "timing", bucket, when: label, text: line.replace("{when}", label || "") };
  }
  return null;
}

function variantIndex(seed, n) { let h = 2166136261; for (const ch of String(seed)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; } return h % n; }
// v2.3.6 결제 전 흐림 예시 세트 고르기 — 연애는 연애 단계로, 그 밖은 영역(frame.area → cls.domain)으로
export function blurSetKey(frame, cls, B) {
  const P = B && B.pick; if (!P) return null;
  const area = (frame && frame.area) || (cls && cls.domain) || null;
  let k = null;
  if (area === "LOV" && frame && frame.love_status) k = P.love_status[frame.love_status];
  if (!k && area) k = P.area[area];
  k = k || P.default;
  return B.sets && B.sets[k] ? k : null;
}
// ③ 10쪽 순서 바꾸기: [카드1, 카드2, 중간 결과, 카드3(결제 전 뒷면), 5~10]
export function buildPagesV43(args) {
  const { base, frame = null, lean = null, name, paid = false, data, midDb, answerDb, cls = null, picks, now = new Date(), subDb = null } = args; // now: 테스트를 본 시각(시기 달 계산)
  const P = buildPagesV4(args);
  const V = data.copy.result.v43;
  const S = data.copy.result.secret3; // v2.3.2 3·4쪽 고정 문구(개발 secretThird.ts와 같은 키)
  const byNo = (n) => P.find((p) => p.page === n);
  const old1 = byNo(1), c1 = { ...byNo(2) }, c2 = { ...byNo(3) }, c3 = { ...byNo(4) };
  // 1쪽: 첫 번째 카드 + 맨 위 안내 문단
  c1.page = 1; c1.intro = S.intro.replaceAll("{name}", name); c1.back = null;
  c2.page = 2;
  // 3쪽: 두 장 중간 결과
  const mid = midParagraph({ picks, frame, cls, midDb, subDb });
  let firstPara = String(old1.body || "").split("\n\n").find((x) => x.includes("들려준 이야기") || x.includes("마음속으로 떠올린")) || "";
  const subP = frame && frame.sub_id && subDb && subDb.subs && subDb.subs[frame.sub_id] && (!frame.area || frame.area === subDb.subs[frame.sub_id].area) ? subDb.subs[frame.sub_id].phrase : null; // v2.3.8 세부 고민 이름
  const ap = frame && (subP || (V.area_phrases && (V.area_phrases[mid.key] || V.area_phrases[frame.area])));
  if (ap) firstPara = firstPara.replace(/진로와 자기계발에 대한 고민|직업과 커리어에 대한 고민|나 자신과 삶의 방향에 대한 고민|연애에 대한 고민|가족에 대한 고민|친구와 사회관계에 대한 고민|재정과 생활 안정에 대한 고민/, ap).replace(/고민(으로|로) 읽혔/, "고민으로 읽혔"); // 취업·시험·연애 세부는 세부 이름으로(v2.3.7)
  let box = String(old1.body || "").split("\n\n").find((x) => x.startsWith("**이번 고민에서")) || null;
  if (box && frame && frame.forecast) box = box.split("\n").filter((x) => !x.startsWith("◦ 선택지")).join("\n"); // 예측형 선택지는 화면에 보이지 않음
  const teaser = teaserLine({ frame, lean, name, data });
  // v2.3.2 3쪽 = 개발 현행 구성(secret3): 고민 읽기 → 고민 틀 상자 → 두 장이 보여 준 것 → 전환 문장 → same/split/general(+ 예고)
  const pair = !frame || frame.forecast ? null : (frame.options_ranked || frame.options || []).map(cleanOption).filter(Boolean);
  const two = lean && lean.cards && lean.cards.length >= 2 ? lean.cards.slice(0, 2) : null;
  let endKey = "general";
  if (pair && pair.length >= 2 && two) endKey = two[0].option === two[1].option ? "same" : "split";
  const endPara = S[endKey].replaceAll("{options}", pair ? `‘${pair[0]} / ${pair[1]}’` : "").replaceAll("{a}", pair ? pair[0] : "").replaceAll("{b}", pair ? pair[1] : ""); // v2.3.13 개발 데이터의 {options}(‘A / B’)도 받음
  const leads = S.change_leads || [];
  const changeLead = leads.length ? leads[variantIndex(name + (picks || []).map((p) => (p.card ? p.card.no : p.no)).join("-"), leads.length)] : null;
  const showTeaser = endKey === "general" && teaser; // 선택지 문단(same/split)에는 이미 '어느 쪽인지'가 들어 있어 예고를 겹쳐 쓰지 않음
  const p3 = { page: 3, title: S.worry_title.replaceAll("{name}", name), access: "무료", heading: S.worry_title.replaceAll("{name}", name),
    cards: [c1.card, c2.card, { position: c3.card && c3.card.position, face_down: true, alt: S.hidden_alt }],
    lead: firstPara.replace(/\*\*/g, ""), // 렌더러: 첫 문장 굵게·남색(디자인 가이드)
    body: [firstPara, box, mid.text ? `**${S.two_title}**\n${mid.text}` : null, changeLead, showTeaser ? `${endPara} ${teaser}` : endPara].filter((x) => x != null && x !== "").join("\n\n").replace(/\n{3,}/g, "\n\n"),
    end_key: endKey, mid_key: mid.key, merge_key: mid.merge_key, teaser: showTeaser ? teaser : null, next: S.next_button, back: "돌아가기" };
  // 4쪽: 세 번째 카드 — 결제 전 뒷면, 결제하면 뒤집힘
  c3.page = 4;
  const q = frame && frame.core_question ? String(frame.core_question).trim() : "";
  // v2.3.2 4쪽 예고: 선택지가 있으면 p4_options, 원문 질문만 있으면 p4_question, 둘 다 없으면 p4_general
  const ST4 = frame && frame.sub_id && data.copy.result.v43.sub_teasers ? data.copy.result.v43.sub_teasers[frame.sub_id] : null; // v2.3.14 세부 전용 4쪽 예고
  const userOptions = pair && pair.length >= 2 && !(frame && frame.forecast);
  const teaser4 = (ST4 && ST4.p4 && !userOptions ? ST4.p4 : pair && pair.length >= 2 ? S.p4_options.replaceAll("{a}", pair[0]).replaceAll("{b}", pair[1]) : q ? S.p4_question.replaceAll("{q}", q) : S.p4_general).replaceAll("{name}", name);
  c3.title = S.p4_title;
  if (!paid) Object.assign(c3, { card: { position: c3.card && c3.card.position, face_down: true, alt: S.hidden_alt }, says: null, body: null, question: null, locked: true, access: "유료", teaser: teaser4, note: S.p4_after_pay_note, next: S.p4_cta || c3.next });
  else c3.flip_on_open = true;
  const rest = P.filter((p) => p.page >= 5).map((p) => ({ ...p }));
  const p5 = rest.find((p) => p.page === 5);
  const BS = data.copy.result.blur_samples, bk = paid ? null : blurSetKey(frame, cls, BS);
  if (p5 && !paid) { p5.free = null; p5.locked = null; p5.body = null; p5.access = "유료"; p5.blur = (bk ? BS.sets[bk]["5"] : null) || (BS.locked5 || {}).text || null; }
  if (bk) for (const p of rest) if (p.page >= 6 && p.page <= 9 && BS.sets[bk][String(p.page)]) p.blur = BS.sets[bk][String(p.page)]; // 10쪽(쏘웰라)은 공통
  // 7쪽 '답 먼저' 한 줄(결제 후)
  const af = answerDb ? answerFirst({ frame, lean, picks, db: answerDb, data, now }) : null;
  const p7 = rest.find((p) => p.page === 7);
  if (p7 && paid && af && p7.body) {
    let L7 = p7.body.split("\n");
    if (af.kind === "forecast") { // v4.3.1 예측 답이 첫 줄이면 같은 뜻의 방향 제목('세 장은 ‘…흐름’ 쪽이에요' + 선택지 줄)은 뺌
      const i = L7.findIndex((x, k) => k < 8 && /^\*\*세 장은 .*쪽(이에요|입니다)\.\*\*$/.test(x));
      if (i >= 0) L7.splice(i, L7[i + 1] && L7[i + 1].startsWith("◦ ") ? 2 : 1);
    }
    const isMoney = !!(frame && (frame.money === true || frame.area === "FORT"));
    const mn = isMoney && answerDb.money_note ? `\n※ ${answerDb.money_note.text}` : ""; // v2.3.3 돈 고민: 예측 + 보장하지 않는다는 작은 글씨
    p7.body = `**${af.text}**${mn}\n\n${L7.join("\n")}`;
  }
  if (p7) p7.answer_first = af;
  const out = [c1, c2, p3, c3, ...rest];
  out.forEach((p, i) => { p.next = i === out.length - 1 ? null : p.next || "다음으로"; });
  return Object.assign(out, { v43: { mid, teaser, answer_first: af, blur_set: bk, sub_id: (frame && frame.sub_id) || null } });
}

// ⑨ A/B 배정 — 같은 사용자는 늘 같은 쪽(세션·사용자 id 해시)
export function variantOf(id, experiment = "placeholder_v43", arms = ["A", "B"]) {
  let h = 2166136261;
  for (const ch of `${experiment}:${id}`) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return arms[h % arms.length];
}
// ⑨ 결제 분석용 기록 한 줄(고민 원문은 넣지 않음)
export function eventFields({ id, worryText = "", frame = null, cls = null, lean = null, pages = null, paid = false, variant = null }) {
  const n = [...String(worryText)].length;
  return { id, len: n, long: n > 40, area: frame && frame.area, domain: cls && cls.domain, table: lean ? lean.table : frame && frame.table,
    want: frame && frame.want, love_status: frame && frame.love_status, stage: frame && frame.stage, control: frame && frame.control,
    forecast: !!(frame && frame.forecast), side: lean && lean.side, strength: lean && lean.strength,
    teaser: pages && pages.v43 ? pages.v43.teaser : null, answer_kind: pages && pages.v43 && pages.v43.answer_first ? pages.v43.answer_first.kind : null,
    mid_key: pages && pages.v43 ? pages.v43.mid.key : null, placeholder_variant: variant, paid,
    // v2.3.12 세부·점수표 규칙 측정용
    frame_id: frame && frame.frame_id || null, frame_fix: frame && frame.frame_fix ? frame.frame_fix.how : null, followup: frame && frame.followup ? frame.followup.answers.join(",") : null,
    sub_id: frame && frame.sub_id || null, love_topic: frame && frame.love_topic || null, table_fix: frame && frame.table_fix ? frame.table_fix.how : null, table_from: frame && frame.table_fix ? frame.table_fix.from : null };
}
