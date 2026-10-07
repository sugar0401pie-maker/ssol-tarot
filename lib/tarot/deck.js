// v1.1 카드 뽑기 — 22장 전체를 무작위로 섞고, 사용자가 직접 3장을 뽑는다.
// 섞기는 서버에서 합니다. 화면에는 뒷면 22장(자리 번호 0~21)만 보내고,
// 어느 자리에 어떤 카드가 있는지는 서버만 압니다(개발자 도구로 미리 보는 것 방지).
import { randomInt, randomUUID } from "node:crypto";

const cryptoRng = (n) => randomInt(n); // 0 이상 n 미만 정수

// Fisher–Yates. rng는 테스트에서 주입할 수 있게 열어 둠.
export function shuffleDeck(data, rng = cryptoRng) {
  const order = data.cards.map((c) => c.id);
  for (let i = order.length - 1; i > 0; i--) {
    const j = rng(i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

// "다시 섞을게요"를 누를 때마다 새로 호출 → 새 shuffleId. 이전 셔플은 폐기.
// v1.8 역방향: 카드마다 data.deck.reversed_rate(기본 0.3) 확률로 역방향. 뒷면이 위아래 대칭이라 뽑기 전엔 알 수 없음.
export function drawOrientation(data, rng = cryptoRng) {
  const rate = data.deck.reversed_rate ?? 0;
  return Object.fromEntries(data.cards.map((c) => [c.id, rng(1000) < Math.round(rate * 1000)]));
}

export function createShuffle(data, { rng = cryptoRng, idFn = randomUUID } = {}) {
  return { shuffleId: idFn(), order: shuffleDeck(data, rng), reversed: drawOrientation(data, rng), createdAt: new Date().toISOString() };
}

// 사용자가 누른 자리(slot) → 카드. 이미 뽑은 자리·범위 밖·4장째는 거부.
export function pickSlot(shuffle, pickedSlots, slot, data) {
  const max = data.deck.pick_count;
  if (!Number.isInteger(slot) || slot < 0 || slot >= shuffle.order.length) throw new Error(`잘못된 자리: ${slot}`);
  if (pickedSlots.includes(slot)) throw new Error("이미 뽑은 카드입니다");
  if (pickedSlots.length >= max) throw new Error(`카드는 ${max}장까지만 뽑을 수 있습니다`);
  const id = shuffle.order[slot];
  const card = data.cards.find((c) => c.id === id);
  const position = data.positions.slice().sort((a, b) => a.order - b.order)[pickedSlots.length];
  const reversed = Boolean(shuffle.reversed && shuffle.reversed[id]);
  return { slot, card, reversed, position: position.code, positionName: position.name, isLast: pickedSlots.length + 1 === max };
}

// 3장을 다 뽑은 뒤 결과 조립용 picks 배열로 변환
export function picksFromSlots(shuffle, slots, data) {
  const out = [];
  const taken = [];
  for (const s of slots) { out.push(pickSlot(shuffle, taken, s, data)); taken.push(s); }
  if (out.length !== data.deck.pick_count) throw new Error("카드 3장이 필요합니다");
  return out.map(({ card, reversed, position, positionName }) => ({ card, reversed, position, positionName }));
}

// 대기 화면 문구: "{닉네임}님의 타로 결과를 분석하고 있어요... (3초 경과)"
export function loadingText(data, nickname, seconds) {
  const l = data.copy.loading;
  return `${l.message.replace("{nickname}", nickname)} ${l.elapsed.replace("{seconds}", String(seconds))}`;
}
