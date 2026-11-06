// 영문판 decision — 계산은 한국어 원본(lib/tarot/decision.js) 그대로, 화면 말만 영어(기획 README '코드에서 바꿀 곳').
export * from "../tarot/decision.js";
export const SIDE_WORD = { move: "moving", stay: "staying" };
export const STRENGTH_WORD = { strong: "clearly", clear: "", slight: "a little more" };
export const cleanOption = (o) => String(o || "").replace(/\s*\((?:implied|암시)\)\s*$/, "").trim();
// v4.2 카드별 이유 한 줄: "{reason}, so it points toward ‘{option}’." (이유 문장 DB는 이 틀에 맞춰 번역됨)
export function reasonLine(clause, option) {
  const m = String(clause || "").trim().replace(/[.]$/, "");
  return `${m}, so it points toward ‘${option}’.`;
}
export function reasonFallback(meaning, side) {
  const m = String(meaning || "").trim().replace(/[.]$/, "");
  return `${m}, so it points toward ${SIDE_WORD[side]}.`;
}

// 영문판 lean: 계산은 원본 그대로. 원본이 한국어 틀로 만든 카드별 이유(reason)만 영어 틀로 다시 만들고,
// 영어 고민 틀의 " (implied)" 표시는 원본 cleanOption이 모르므로 미리 뗀다.
import { lean as leanKo } from "../tarot/decision.js";
const cleanFrame = (frame) => {
  if (!frame) return frame;
  const c = (a) => (Array.isArray(a) ? a.map(cleanOption) : a);
  const ax = frame.option_axis && typeof frame.option_axis.move === "string" ? { ...frame.option_axis, move: cleanOption(frame.option_axis.move), stay: cleanOption(frame.option_axis.stay) } : frame.option_axis;
  return { ...frame, options_ranked: c(frame.options_ranked), options: c(frame.options), option_axis: ax };
};
export function lean(args) {
  const out = leanKo({ ...args, frame: cleanFrame(args.frame) });
  const tb = args.tables.types[args.type];
  out.cards = out.cards.map((c) => {
    const clause = tb.reasons && tb.reasons[c.key] ? tb.reasons[c.key] : null;
    return { ...c, reason: clause ? reasonLine(clause, c.option) : null };
  });
  return out;
}
