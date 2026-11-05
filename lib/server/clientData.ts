import "server-only";
import { bundleFor } from "@/lib/i18n/bundle";
import type { Locale } from "@/lib/i18n/locale";

// 브라우저로 보내는 데이터는 화면 문구와 공개 카드 정보뿐이다. tarot_data.json 전체(실천·처방·마무리 같은
// 유료 DB 문장 포함)를 클라이언트 번들에 넣지 않으려고, 서버 컴포넌트가 필요한 부분만 골라 props로 넘긴다.
// 영문판(2026-11-05)은 같은 모양의 영어 데이터(lib/i18n/bundle.ts — 빠진 문구는 임시 문구로 채움).
type Copy = ReturnType<typeof bundleFor>["data"]["copy"];
export function clientCopy(locale: Locale = "ko") {
  // 8번 쏘웰라 안내(cta_chat)는 유료 구간 문구라 결제 연동 전에는 보내지 않는다.
  const copy: Partial<Copy> = { ...bundleFor(locale).data.copy };
  delete copy.cta_chat;
  return copy as Omit<Copy, "cta_chat">;
}

// 인트로에서 도는 카드 22장(카드 이름·그림만 — 해석 문장 없음).
export function introFriends(locale: Locale = "ko") {
  return bundleFor(locale).data.cards.map((c) => ({ name: c.name, character: c.character, image: `/images/tarot/${c.image.file}` }));
}

export const PICK_COUNT = bundleFor("ko").data.deck.pick_count;
