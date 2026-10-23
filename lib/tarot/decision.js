// v4.0 (새로) 결정형 고민의 방향 계산 — 규칙 R3·R6·R9·R10 (Python 시안 proto/lean.py v2를 옮김)
//   점수표: 02_데이터/decision_tables.json (v3: 표 10개 × 카드 22장 × 정/역 = 44칸, 칸마다 [기울기 점수, 이 표에서의 뜻])
//   자리 가중치 지나온 길 1 · 지금의 흐름 1 · 앞으로의 열쇠 2, 합 ≥ 0 → 움직이는 쪽(move), < 0 → 머무는 쪽(stay). 평균(기준값)은 빼지 않음.
//   강도: |합| ≥ 3 뚜렷(strong) · ≥ 1.5 분명(clear) · 그 아래 조금 더(slight). AI는 이 결론을 바꾸지 못하고 이유만 씀.
// v4.1 변경(고민 틀 A2 v4.6):
//   - 점수표 10개: approach·reunion·progress·continue·newlove·job·start·move·express(표현)·boundary(경계). '일반 행동(act)'은 없음.
//   - 새 frame 형식 {table, decision_source, mode, rank_reason, options_ranked, ...}:
//       mode "axis": options_ranked = [+ 쪽, − 쪽] → 합 ≥ 0이면 [0], 아니면 [1]
//       mode "rank": options_ranked = AI 추천 순위 → 카드 +면 1순위([0]), −면 2순위([1]). 3순위 이하는 결론이 되지 않음.
//     옛 형식(worry_type·options·option_axis)도 계속 받음.
//   - lean()은 conclusion(결론 선택지)·other(반대 선택지)·mode·pick(0|1)를 함께 돌려줌(option = conclusion, 예전 이름 유지).
//   - 새 형식에서 table이 null이면 방향 계산 안 함(qsub_map으로 넘어가지 않음). 폭력 확인(violence)이면 방향 끔.
//   - secondOpinion: 유사 정답 투표 1순위 표가 A2 표와 다르면 강도를 한 단계 낮추고 review_log를 돌려줌.
import { josa } from "./josa.js";

export const SIDE_WORD = { move: "움직이는", stay: "머무는" };
export const STRENGTH_WORD = { strong: "뚜렷해요", clear: "분명해요", slight: "조금 더 커요" };
export const cleanOption = (o) => String(o || "").replace(/\s*\(암시\)\s*$/, "").trim();
export const TABLE_NAMES = ["approach", "reunion", "progress", "continue", "newlove", "job", "start", "move", "express", "boundary"];
export const MODES = ["axis", "rank"];

const cardKey = (p) => {
  const no = p.card ? p.card.no : p.no;
  return `${no}_${p.reversed ? "rev" : "up"}`;
};

// 새 형식(v4.6) frame인가: options_ranked·mode·decision_source 중 하나라도 있으면 새 형식
export const isNewFrame = (frame) => !!(frame && (Array.isArray(frame.options_ranked) || "mode" in frame || "decision_source" in frame));
// 방향을 계산하는 frame인가 — 새 형식: table이 있고 선택지 2개 이상 / 옛 형식: worry_type "decision"
export function isDecisionFrame(frame) {
  if (!frame) return false;
  if (isNewFrame(frame)) return !!frame.table && Array.isArray(frame.options_ranked) && frame.options_ranked.length >= 2;
  return frame.worry_type === "decision";
}

// 어느 점수표로 계산할지: A2 고민 틀의 table → (옛 형식·frame 없음일 때만) 연애 세부 유형 qsub_map → 없으면 null(방향 계산 안 함)
//   커리어(CAR) 등 그 밖의 주제는 영역만으로 표를 짐작하지 않음 — A2의 frame.table만 믿음
//   v4.1: 새 형식 frame이 table=null이면 null(A2가 '방향 없음'으로 판단 — 폭력 확인 등). safety.violence면 null(방향 끔)
export function pickTable({ frame = null, cls = null, tables, safety = null }) {
  const T = tables.types;
  if (safety && safety.violence) return null;
  if (frame && frame.table && T[frame.table]) return frame.table;
  if (isNewFrame(frame) && frame.table === null) return null;
  if (cls && cls.qsub && Object.prototype.hasOwnProperty.call(tables.qsub_map || {}, cls.qsub)) {
    const t = tables.qsub_map[cls.qsub];
    return t && T[t] ? t : null;
  }
  return null; // CAR·DIR·REL 등: frame.table이 없으면 계산하지 않음
}

// frame에서 [+ 쪽(1순위), − 쪽(2순위)] 선택지 이름과 mode를 꺼냄. 없으면 null
export function optionPair(frame) {
  if (!frame) return null;
  if (Array.isArray(frame.options_ranked) && frame.options_ranked.length >= 2)
    return { mode: frame.mode === "rank" ? "rank" : "axis", first: cleanOption(frame.options_ranked[0]), second: cleanOption(frame.options_ranked[1]), rest: frame.options_ranked.slice(2).map(cleanOption) };
  const ax = frame.option_axis;
  if (ax && ax.move && ax.stay) return { mode: "axis", first: cleanOption(ax.move), second: cleanOption(ax.stay), rest: [] };
  return null;
}

// picks: buildPages와 같은 picks([{card:{no}, reversed}]) 또는 [{no, reversed}] — 지나온 길·지금의 흐름·앞으로의 열쇠 순
// type: 점수표 이름(TABLE_NAMES)
// frame(선택): 새 형식 options_ranked(mode axis/rank) 또는 옛 형식 option_axis에서 선택지 이름을 가져옴. 없으면 표의 기본 이름(예: '지금 자리에 남기')
export function lean({ picks, type, tables, money = undefined, name = "", frame = null }) {
  const tb = tables.types[type];
  if (!tb) throw new Error(`알 수 없는 점수표: ${type}`);
  const R = tables.rule, W = R.weights;
  const keys = picks.map(cardKey);
  const sc = keys.map((k) => { const v = tb.scores[k]; if (!v) throw new Error(`${type} 표에 ${k} 없음`); return v; });
  const raw = sc.reduce((a, s, i) => a + W[i] * s[0], 0);
  const side = raw >= R.move_if_sum_gte ? "move" : "stay";
  const strength = Math.abs(raw) >= R.strong_abs_gte ? "strong" : Math.abs(raw) >= R.clear_abs_gte ? "clear" : "slight";
  const pair = optionPair(frame);
  const pick = side === "move" ? 0 : 1; // axis: [+, −] / rank: [1순위, 2순위]
  const conclusion = pair ? (pick === 0 ? pair.first : pair.second) : tb[side];
  const other = pair ? (pick === 0 ? pair.second : pair.first) : tb[side === "move" ? "stay" : "move"];
  const out = {
    table: type, side, strength, score: raw,
    mode: pair ? pair.mode : "axis", pick,
    with_condition: tables.stance[keys[2]] === "reshape",
    conclusion, option: conclusion, other,
    cards: sc.map((s, i) => {
      // v4.2: 카드별 이유 문장 DB(types.<표>.reasons) — 5쪽·7쪽에 같은 문장(무료·유료 해석이 갈리지 않게)
      const option = s[0] > 0 ? (pair ? pair.first : tb.move) : (pair ? pair.second : tb.stay);
      const clause = tb.reasons && tb.reasons[keys[i]] ? tb.reasons[keys[i]] : null;
      return { position: R.positions[i], key: keys[i], score: s[0], weight: W[i], meaning: s[1], option, reason: clause ? reasonLine(clause, option) : null };
    }),
  };
  if (pair && pair.rest.length) out.not_concluded = pair.rest; // rank 3순위 이하 — 결론이 되지 않음
  const isMoney = money === undefined ? !!(frame && frame.money === true) : !!money;
  if (isMoney) out.small_note = tables.money.note.replaceAll("{name}", name);
  return out;
}

// ---- 두 번째 의견(v4.1) ----
// 유사 정답 투표(retrieve.voteTable) 1순위 표(simTable)가 A2 표(frameTable)와 다르면 결론 강도를 한 단계 낮춤
//   strong → clear, clear → slight, slight는 그대로. 같으면 그대로. 사용자 화면에는 결론 하나만(낮아진 강도로).
//   다르면 review_log 레코드(고민 id·A2 표·유사도 표·점수)를 돌려줌 — 운영 로그(검수 대기)에 쌓음.
export const LOWER = { strong: "clear", clear: "slight", slight: "slight" };
//   minShare(v4.1 CSO 2차 기본 0.6 = decision_tables.json second_opinion.min_share): 투표 1순위 비율이 이 값보다 낮으면 낮추지 않음(로그만 — below_min_share)
export const DEFAULT_MIN_SHARE = 0.6;
export const minShareOf = (tables) => (tables && tables.second_opinion && typeof tables.second_opinion.min_share === "number" ? tables.second_opinion.min_share : DEFAULT_MIN_SHARE);
export function secondOpinion({ frameTable, simTable, strength = null, worryId = null, simShare = null, simScore = null, score = null, minShare = DEFAULT_MIN_SHARE }) {
  if (simTable === undefined) return { strength, lowered: false, disagree: false, review_log: null };
  const a = frameTable ?? null, b = simTable ?? null;
  if (a === b) return { strength, lowered: false, disagree: false, review_log: null };
  if (minShare > 0 && (simShare ?? 0) < minShare)
    return { strength, lowered: false, disagree: true, review_log: { worry_id: worryId, frame_table: a, sim_table: b, sim_share: simShare, sim_score: simScore, lean_score: score, strength_before: strength, strength_after: strength, below_min_share: true, at: new Date().toISOString() } };
  const next = strength ? LOWER[strength] || strength : strength;
  return {
    strength: next, lowered: !!strength && next !== strength, disagree: true,
    review_log: { worry_id: worryId, frame_table: a, sim_table: b, sim_share: simShare, sim_score: simScore, lean_score: score, strength_before: strength, strength_after: next, at: new Date().toISOString() },
  };
}
// lean 결과에 두 번째 의견을 반영(강도만 바꿈 — 쪽·선택지는 그대로)
export function applySecondOpinion(L, so) {
  if (!L || !so || !so.lowered) return L;
  return { ...L, strength: so.strength, strength_before: L.strength, second_opinion: { sim_table: so.review_log.sim_table } };
}

// v4.2 카드별 이유 한 줄: "{reason DB}라, ‘{그 카드 쪽 선택지}’ 쪽을 가리켜요."
export function reasonLine(clause, option) {
  const m = String(clause || "").trim();
  return `${m}${josa(m, ["이라", "라"])}, ‘${option}’ 쪽을 가리켜요.`;
}
// C의 reasons가 없거나 검증에 걸렸을 때 5쪽 카드별 한 줄: "{뜻}이라/라, {움직이는/머무는} 쪽을 가리켜요."
export function reasonFallback(meaning, side) {
  const m = String(meaning || "").trim();
  return `${m}${josa(m, ["이라", "라"])}, ${SIDE_WORD[side]} 쪽을 가리켜요.`;
}
export const cardSide = (score) => (score > 0 ? "move" : "stay");
