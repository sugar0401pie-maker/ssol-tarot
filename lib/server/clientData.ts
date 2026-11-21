import "server-only";
import { bundleFor } from "@/lib/i18n/bundle";
import type { Locale } from "@/lib/i18n/locale";
import { stripMemo } from "@/lib/i18n/stripMemo";
import followupDb from "@/data/followup_questions.json";

// 브라우저로 보내는 데이터는 화면 문구와 공개 카드 정보뿐이다. tarot_data.json 전체(실천·처방·마무리 같은
// 유료 DB 문장 포함)를 클라이언트 번들에 넣지 않으려고, 서버 컴포넌트가 필요한 부분만 골라 props로 넘긴다.
// 영문판(2026-11-05)은 같은 모양의 영어 데이터(lib/i18n/bundle.ts — 빠진 문구는 임시 문구로 채움).
type Copy = ReturnType<typeof bundleFor>["data"]["copy"];
export function clientCopy(locale: Locale = "ko") {
  // 8번 쏘웰라 안내(cta_chat)는 유료 구간 문구라 결제 연동 전에는 보내지 않는다.
  // 메모 칸(owner·Claude 초안 등 설명)은 빼고 보낸다(owner 2026-11-21) — 페이지 소스에 남지 않게.
  const copy: Partial<Copy> = stripMemo({ ...bundleFor(locale).data.copy });
  delete copy.cta_chat;
  return copy as Omit<Copy, "cta_chat">;
}

// 인트로에서 도는 카드 22장(카드 이름·그림만 — 해석 문장 없음).
export function introFriends(locale: Locale = "ko") {
  return bundleFor(locale).data.cards.map((c) => ({ name: c.name, character: c.character, image: `/images/tarot/${c.image.file}` }));
}

export const PICK_COUNT = bundleFor("ko").data.deck.pick_count;

// 짧은 고민 다시 묻기(followup_questions.json): 화면이 쓰는 질문·보기(id·글자·다음 질문)만 보낸다(owner 2026-11-21 — 메모·서버용 칸은 빼고).
export type ClientFollowup = { max_questions: number; questions: Record<string, { ask: string; options: { id: string; label: string; next?: string }[] }> };
export function clientFollowup(): ClientFollowup {
  const db = followupDb as unknown as { max_questions?: number; questions: Record<string, { ask: string; options: { id: string; label: string; next?: string }[] }> };
  const questions: ClientFollowup["questions"] = {};
  for (const [k, q] of Object.entries(db.questions)) questions[k] = { ask: q.ask, options: q.options.map((o) => ({ id: o.id, label: o.label, ...(o.next ? { next: o.next } : {}) })) };
  return { max_questions: db.max_questions || 2, questions };
}
