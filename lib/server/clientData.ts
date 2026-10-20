import "server-only";
import data from "@/data/tarot_data.json";

// 브라우저로 보내는 데이터는 화면 문구와 공개 카드 정보뿐이다. tarot_data.json 전체(실천·처방·마무리 같은
// 유료 DB 문장 포함)를 클라이언트 번들에 넣지 않으려고, 서버 컴포넌트가 필요한 부분만 골라 props로 넘긴다.
export function clientCopy() {
  // 8번 쏘웰라 안내(cta_chat)는 유료 구간 문구라 결제 연동 전에는 보내지 않는다.
  const copy: Partial<typeof data.copy> = { ...data.copy };
  delete copy.cta_chat;
  return copy as Omit<typeof data.copy, "cta_chat">;
}

// 인트로에 지나가는 바다 친구 21종(캐릭터 20 + 바다의 노인). 21번 단체 카드는 제외.
export function introFriends() {
  return data.cards
    .filter((c) => c.no !== 21)
    .map((c) => ({ name: c.name, character: c.character, image: `/images/tarot/${c.image.file}` }));
}

export const PICK_COUNT = data.deck.pick_count;
