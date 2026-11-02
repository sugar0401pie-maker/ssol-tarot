import { test } from "node:test";
import assert from "node:assert/strict";
import { applyCardGist, cardGistLine, toConnective } from "./cardGist.ts";

const R = (clause: string, option = "사귀기") => `${clause}라, ‘${option}’ 쪽을 가리켜요.`;
const lean = {
  option: "사귀기",
  cards: [
    { option: "사귀기", reason: R("오해가 걷혀 서로의 마음이 또렷해지는 카드") },
    { option: "사귀기", reason: R("새 단계를 가볍게 시작할 힘이 있는 카드") },
    { option: "사귀기", reason: R("숨겨진 마음이 드러나 확신을 얻을 수 있는 카드") },
  ],
};

test("카드 종합 한 문장: 결론 쪽 카드 앞의 두 장, 결론 이름은 넣지 않음", () => {
  const s = cardGistLine(lean);
  assert.equal(s, "카드 내용을 종합하면 오해가 걷혀 서로의 마음이 또렷해지고, 새 단계를 가볍게 시작할 힘이 있는 모양입니다.");
  assert.doesNotMatch(String(s), /사귀기/);
});

test("다른 쪽을 가리키는 카드·바꿀 수 없는 카드('~하라는')는 건너뛴다, 없으면 null", () => {
  const l = { option: "A", cards: [{ option: "B", reason: R("멈추는 편이 나은 상태", "B") }, { option: "A", reason: R("지금은 기다리라는 카드", "A") }, { option: "A", reason: R("속도를 늦출 때", "A") }] };
  assert.equal(cardGistLine(l), "카드 내용을 종합하면 속도를 늦출 때인 모양입니다.");
  assert.equal(cardGistLine(null), null);
  assert.equal(cardGistLine({ option: "A", cards: [] }), null);
});

test("연결형 바꾸기: 불규칙 포함", () => {
  assert.equal(toConnective("가벼운"), "가볍고");
  assert.equal(toConnective("편이 나은"), "편이 낫고");
  assert.equal(toConnective("활력이 줄어든"), "활력이 줄어들고");
  assert.equal(toConnective("부족한"), "부족하고");
  assert.equal(toConnective("살필"), "살피고");
});

test("결제 전: 5쪽 카드별 목록을 빼고 첫 줄 뒤에 종합 문장, 결제 후: 목록은 그대로 두고 문장만", () => {
  const T = "세 장을 종합하면 이렇습니다";
  const free = `## 질문에, 세 장이 답했어요\n\n오래 붙들어 온 그 질문에, 세 장은 생각보다 분명한 답을 내놓았어요.\n\n${T}\n◦ 지나온 길 — a`;
  const [unpaid] = applyCardGist([{ page: 5, free }], lean, T, { hideSummary: true });
  assert.doesNotMatch(unpaid.free, /◦|세 장을 종합하면 이렇습니다/);
  assert.match(unpaid.free, /답을 내놓았어요\. 카드 내용을 종합하면 .+ 모양입니다\.$/);
  const [paid] = applyCardGist([{ page: 5, body: `${free}\n\n**결론**` }], lean, T, { hideSummary: false });
  assert.match(paid.body, /모양입니다\.\n\n세 장을 종합하면 이렇습니다\n◦ 지나온 길 — a\n\n\*\*결론\*\*$/);
});

import { personalizeBlur } from "./v4.ts";
test("블러 고정 예시: 민준님·예시 카드 이름을 이 사람 것으로(겹치는 이름도 안전하게)", () => {
  const t = "민준님은 ‘바위 위의 쉼’ → ‘지키는 자리’ → ‘품어 주는 품’";
  assert.equal(personalizeBlur(t, "과곽이", ["품어 주는 품", "첫 물장구", "고요히 바라보기"]), "과곽이님은 ‘품어 주는 품’ → ‘첫 물장구’ → ‘고요히 바라보기’");
  assert.equal(personalizeBlur("민준님", "", []), "당신");
});

import { twoCardGist } from "./cardGist.ts";
test("3쪽 두 장 종합 한 문장: 같은 쪽 / 다른 쪽, 세 번째 카드는 쓰지 않음", () => {
  const R2 = (c: string, o: string) => `${c}라, ‘${o}’ 쪽을 가리켜요.`;
  const same = { cards: [{ option: "남기", reason: R2("서두르지 않고 혼자 생각을 정리하며 기다리는 카드", "남기") }, { option: "남기", reason: R2("변화가 아직 낯설어 예전 자리를 지키고 싶은 상태", "남기") }, { option: "이직", reason: R2("새 단계를 시작할 힘이 있는 카드", "이직") }] };
  assert.equal(twoCardGist(same), "두 장을 종합하면 서두르지 않고 혼자 생각을 정리하며 기다리고, 변화가 아직 낯설어 예전 자리를 지키고 싶은 모양이에요.");
  const split = { cards: [{ option: "이직", reason: R2("가진 역량으로 새 자리를 직접 열 수 있는 카드", "이직") }, { option: "남기", reason: R2("지금 자리에서 받는 안정과 보살핌을 누리는 카드", "남기") }] };
  assert.equal(twoCardGist(split), "두 장을 종합하면 가진 역량으로 새 자리를 직접 열 수 있고, 한편으로는 지금 자리에서 받는 안정과 보살핌을 누리는 모양이에요.");
  assert.doesNotMatch(String(twoCardGist(same)), /새 단계/);
  assert.equal(twoCardGist(null), null);
});

import { keyLine } from "./secretThird.ts";
test("3쪽 '세 번째 카드는 앞으로의 열쇠예요.'만 굵게·남색 문단으로", () => {
  assert.equal(keyLine("하지만 답은 아직 정해지지 않았어요. 세 번째 카드는 앞으로의 열쇠예요. 앞으로…"), "!! 하지만 답은 아직 정해지지 않았어요. **세 번째 카드는 앞으로의 열쇠예요.** 앞으로…");
  assert.equal(keyLine("두 장이 서로 다른 쪽을 가리키고 있어요."), "두 장이 서로 다른 쪽을 가리키고 있어요.");
});
