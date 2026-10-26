// 고민 분류(A) + 고민 틀(A2)을 AI 한 번 호출로 (owner 2026-10-26 "합치자").
// 두 프롬프트 원문(prompts.ts — 문서에서 sync_prompts.py로 그대로 옮긴 것)은 고치지 않고 이어 붙이기만 한다:
// 문서가 바뀌어 다시 동기화돼도 합친 프롬프트가 자동으로 따라간다.
// 출력은 {"classification": A 형식, "frame": A2 형식} — 각 절반은 기존 검증기(parseClassification·parseFrame)를 그대로 통과해야 쓴다.
// 사용자 입력은 A2용(비슷한 고민 예시 5개 + 고민)을 그대로 쓴다. A는 예시를 참고하지 말고 고민 글만 보라고 적어 둔다.
import { CLASSIFY_SYSTEM, FRAME_SYSTEM } from "./prompts";
import { buildMergedSystem, splitMerged } from "@/lib/tarot-glue/mergedPrompt.js";

export { splitMerged };

export const MERGED_CLASSIFY_SYSTEM = buildMergedSystem(CLASSIFY_SYSTEM, FRAME_SYSTEM);

/** 켜기: 기본 꺼짐(평가 통과 전). TAROT_MERGED_CLASSIFY=1 이면 켬. */
export const mergedClassifyEnabled = () => process.env.TAROT_MERGED_CLASSIFY === "1";
