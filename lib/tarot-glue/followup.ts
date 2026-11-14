// v2.3.14 짧은 고민에 다시 묻기 — 서버·화면이 같이 쓰는 순수 부분(owner 2026-11-14 "1·2 하자", 기획 권장대로 A/B).
//   질문·답은 data/followup_questions.json(패키지 그대로), 질문 순서는 패키지 lib/tarot/followup.js(nextQuestion).
//   A/B: 결과 번호로 반씩 나눈다 — "B"만 질문을 보여 준다. 결제율은 결과 번호로 다시 계산할 수 있어 따로 저장하지 않는다.
import { createHash } from "node:crypto";
import { nextQuestion, needsFollowup } from "../tarot/followup.js";
import fq from "../../data/followup_questions.json" with { type: "json" };

export const FOLLOWUP_DB = fq;
export type FollowupAnswer = { q: string; id: string };

/** 결과 번호로 고정되는 A/B 칸. "B" = 다시 묻기를 보여 줌. 모두에게 보이게 바꾸려면 FOLLOWUP_ALL = true. */
export const FOLLOWUP_ALL = false;
export function followupArm(sessionId: string): "A" | "B" {
  if (FOLLOWUP_ALL) return "B";
  return createHash("sha256").update(`followup:${sessionId}`).digest()[0] % 2 === 0 ? "A" : "B";
}

/** 이 고민에 다시 묻기를 보여 줄지(짧은 글 · 위기 아님 · B칸). 한국어판만. */
export function shouldAskFollowup(sessionId: string, worry: string, { urgent, locale }: { urgent: boolean; locale: string }): boolean {
  return locale === "ko" && followupArm(sessionId) === "B" && needsFollowup(worry, FOLLOWUP_DB, { urgent });
}

/** 화면이 보낸 답 목록을 질문 순서대로 다시 따라가며 검사한다. 맞지 않으면 null(= 건너뛴 것처럼 처리). */
export function checkAnswers(raw: unknown): FollowupAnswer[] | null {
  if (!Array.isArray(raw)) return null;
  const out: FollowupAnswer[] = [];
  for (const a of raw) {
    const q = nextQuestion(FOLLOWUP_DB, out);
    if (!q || !a || typeof a !== "object") return null;
    const { q: key, id } = a as { q?: unknown; id?: unknown };
    if (key !== q.key || !q.options.some((o: { id: string }) => o.id === id)) return null;
    out.push({ q: key, id: id as string });
  }
  return out;
}
