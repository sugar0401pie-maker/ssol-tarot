// v4.0 (새로) 결정형 고민의 방향 계산 — 규칙 R3·R6·R9·R10 (Python 시안 proto/lean.py v2를 옮김)
//   점수표: 02_데이터/decision_tables.json (질문 유형 8개 × 카드 22장 × 정/역 = 44칸, 칸마다 [기울기 점수, 이 표에서의 뜻])
//   자리 가중치 지나온 길 1 · 지금의 흐름 1 · 앞으로의 열쇠 2, 합 ≥ 0 → 움직이는 쪽(move), < 0 → 머무는 쪽(stay). 평균(기준값)은 빼지 않음.
//   강도: |합| ≥ 3 뚜렷(strong) · ≥ 1.5 분명(clear) · 그 아래 조금 더(slight). AI는 이 결론을 바꾸지 못하고 이유만 씀.
import { josa } from "./josa.js";

export const SIDE_WORD = { move: "움직이는", stay: "머무는" };
export const STRENGTH_WORD = { strong: "뚜렷해요", clear: "분명해요", slight: "조금 더 커요" };
export const cleanOption = (o) => String(o || "").replace(/\s*\(암시\)\s*$/, "").trim();

const cardKey = (p) => {
  const no = p.card ? p.card.no : p.no;
  return `${no}_${p.reversed ? "rev" : "up"}`;
};

// 어느 점수표로 계산할지: A2 고민 틀의 table → (없으면) 연애 세부 유형 qsub_map → 없으면 null(방향 계산 안 함)
//   커리어(CAR) 등 그 밖의 주제는 영역만으로 표를 짐작하지 않음 — A2의 frame.table만 믿음
export function pickTable({ frame = null, cls = null, tables }) {
  const T = tables.types;
  if (frame && frame.table && T[frame.table]) return frame.table;
  if (cls && cls.qsub && Object.prototype.hasOwnProperty.call(tables.qsub_map || {}, cls.qsub)) {
    const t = tables.qsub_map[cls.qsub];
    return t && T[t] ? t : null;
  }
  return null; // CAR·DIR·REL 등: frame.table이 없으면 계산하지 않음
}

// picks: buildPages와 같은 picks([{card:{no}, reversed}]) 또는 [{no, reversed}] — 지나온 길·지금의 흐름·앞으로의 열쇠 순
// type: 점수표 이름(job/start/move/approach/reunion/progress/continue/newlove)
// frame(선택): option_axis에서 선택지 이름을 가져옴. 없으면 표의 기본 이름(예: '지금 자리에 남기')
export function lean({ picks, type, tables, money = undefined, name = "", frame = null }) {
  const tb = tables.types[type];
  if (!tb) throw new Error(`알 수 없는 점수표: ${type}`);
  const R = tables.rule, W = R.weights;
  const keys = picks.map(cardKey);
  const sc = keys.map((k) => { const v = tb.scores[k]; if (!v) throw new Error(`${type} 표에 ${k} 없음`); return v; });
  const raw = sc.reduce((a, s, i) => a + W[i] * s[0], 0);
  const side = raw >= R.move_if_sum_gte ? "move" : "stay";
  const strength = Math.abs(raw) >= R.strong_abs_gte ? "strong" : Math.abs(raw) >= R.clear_abs_gte ? "clear" : "slight";
  const axis = frame && frame.option_axis;
  const option = axis && axis[side] ? cleanOption(axis[side]) : tb[side];
  const out = {
    table: type, side, strength, score: raw,
    with_condition: tables.stance[keys[2]] === "reshape",
    option,
    other: axis && axis[side === "move" ? "stay" : "move"] ? cleanOption(axis[side === "move" ? "stay" : "move"]) : tb[side === "move" ? "stay" : "move"],
    cards: sc.map((s, i) => ({ position: R.positions[i], score: s[0], weight: W[i], meaning: s[1] })),
  };
  const isMoney = money === undefined ? !!(frame && frame.money === true) : !!money;
  if (isMoney) out.small_note = tables.money.note.replaceAll("{name}", name);
  return out;
}

// C의 reasons가 없거나 검증에 걸렸을 때 5쪽 카드별 한 줄: "{뜻}이라/라, {움직이는/머무는} 쪽을 가리켜요."
export function reasonFallback(meaning, side) {
  const m = String(meaning || "").trim();
  return `${m}${josa(m, ["이라", "라"])}, ${SIDE_WORD[side]} 쪽을 가리켜요.`;
}
export const cardSide = (score) => (score > 0 ? "move" : "stay");
