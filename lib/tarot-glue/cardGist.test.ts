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
