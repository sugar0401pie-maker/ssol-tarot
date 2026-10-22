// v4.1 (새로) 고민 틀(A2) 호출 앞뒤 — few-shot 예시 붙이기 + 두 번째 의견
//   1) prepareFrameCall: 고민 글과 가장 비슷한 판별 DB 정답 5개(retrieve.findSimilar)를 찾아 A2 사용자 입력에 붙임
//   2) A2 결과 parseFrame → pickTable → lean
//   3) afterFrame: 같은 이웃의 점수 가중 투표 1순위 표가 A2 표와 다르면 강도 한 단계 낮춤 + review_log (decision.secondOpinion)
//   시스템 프롬프트는 01_설계/ai-prompts-tarot-v4.md의 A2 블록(v4.6) 그대로.
import { findSimilar, voteTable } from "./retrieve.js";
import { secondOpinion, applySecondOpinion, minShareOf } from "./decision.js";

export const FEWSHOT_K = 5;
export const FEWSHOT_HEAD = "[비슷한 고민의 정답 예시 — 점수표 고르기와 선택지 순서만 참고합니다. 선택지·질문의 낱말은 이번 고민 원문에서 가져옵니다]";
export const FEWSHOT_NOTE = "아래 예시는 점수표·줄 세우기 방식을 보여 주는 것입니다. 선택지 문구는 따라 쓰지 말고 이번 고민 원문의 말로 쓰세요.";
export const exampleAnswer = (ex) => {
  const table = ex.table !== undefined ? ex.table : Array.isArray(ex.tables) ? ex.tables[0] ?? null : null;
  return { table, mode: table ? ex.mode || "axis" : null, options_ranked: table ? (ex.ranked || ex.options_ranked || []) : [] };
};

// A2 사용자 입력: 예시(고민 글 + 정답 table·mode·options_ranked) 5개 + 이번 고민. 예시가 없으면 이번 고민만(예전과 같음)
export function buildFrameUserBlock({ worryText, examples = [] }) {
  const L = [];
  if (examples && examples.length) {
    L.push(FEWSHOT_HEAD, FEWSHOT_NOTE);
    examples.forEach((ex, i) => {
      L.push(`<example n="${i + 1}">`, `<worry>${String(ex.text || "").trim()}</worry>`, `<answer>${JSON.stringify(exampleAnswer(ex))}</answer>`, "</example>");
    });
    L.push("", "[이번 고민 — 이 글의 고민 틀을 출력 형식대로 정리합니다]");
  }
  L.push(`<worry>${String(worryText || "").trim()}</worry>`);
  return L.join("\n");
}

// A2 호출 준비: 이웃 찾기 → 사용자 입력 + 투표(두 번째 의견용). excludeId = 평가 때 자기 자신 빼기
export function prepareFrameCall({ worryText, k = FEWSHOT_K, excludeId = null, index = null }) {
  const neighbors = findSimilar(worryText, { k, excludeId, index });
  return { user: buildFrameUserBlock({ worryText, examples: neighbors }), neighbors, vote: voteTable(neighbors) };
}

// A2 결과가 나온 뒤: 두 번째 의견 반영. lean이 없으면(방향 계산 안 함) 강도는 없지만 표가 다르면 review_log만 남김
export function afterFrame({ frame, lean = null, vote, worryId = null, tables = null, minShare = minShareOf(tables) }) {
  if (!vote || vote.table === undefined) return { lean, review_log: null, second_opinion: null };
  const so = secondOpinion({ frameTable: frame ? frame.table ?? null : null, simTable: vote.table, strength: lean ? lean.strength : null,
    worryId, simShare: vote.share, simScore: vote.top_score, score: lean ? lean.score : null, minShare });
  return { lean: applySecondOpinion(lean, so), review_log: so.review_log, second_opinion: so };
}
