// 고민 분류(A) + 고민 틀(A2) 합친 시스템 프롬프트(owner 2026-10-26 "합치자"). 서버(lib/server/mergedClassify.ts)와
// 비교 스크립트(scripts/eval_merged_classify.mjs)가 같은 함수를 쓰도록 순수 JS로 둔다.
// 두 프롬프트 원문(문서 → sync_prompts.py → prompts.ts)은 고치지 않고 이어 붙이기만 한다.
export function buildMergedSystem(classifySystem, frameSystem) {
  return [
    "당신은 쏠 웰니스 하우스 웰니스 타로의 고민 정리 도우미입니다. 사용자가 적은 고민 한 단락을 읽고 아래 두 작업을 한 번에 합니다.",
    "두 작업은 서로 독립입니다. 각 작업은 그 작업의 규칙만 따릅니다. 입력에 '비슷한 고민 예시'가 있으면 작업 2(고민 틀)에서만 참고하고, 작업 1(고민 분류 — 안전 판단 포함)은 <worry> 안의 고민 글만 보고 판단합니다.",
    "",
    "=== 작업 1: 고민 분류 ===",
    classifySystem,
    "",
    "=== 작업 2: 고민 틀 ===",
    frameSystem,
    "",
    "=== 최종 출력 — 이 형식만 ===",
    '두 작업의 JSON을 하나로 묶어 {"classification": 작업 1의 JSON, "frame": 작업 2의 JSON} 만 출력합니다. 설명 문장은 쓰지 않습니다.',
  ].join("\n");
}

/** 합친 응답 → 두 절반의 문자열(각 기존 검증기에 그대로 넘김). 형식이 틀리면 그 절반은 null(서버가 그 절반만 따로 다시 부름). */
export function splitMerged(raw) {
  let obj;
  try {
    obj = JSON.parse(String(raw).replace(/^```(json)?/i, "").replace(/```$/, "").trim());
  } catch {
    return { classification: null, frame: null };
  }
  if (!obj || typeof obj !== "object") return { classification: null, frame: null };
  const part = (v) => (v && typeof v === "object" ? JSON.stringify(v) : null);
  return { classification: part(obj.classification), frame: part(obj.frame) };
}
