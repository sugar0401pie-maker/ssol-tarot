import { test } from "node:test";
import assert from "node:assert/strict";
import { aboutDescription, aboutJsonLd, faqGroups, INTRO, H1, atAGlance, steps } from "./content.ts";

const all = () => [H1, INTRO, aboutDescription("990원"), ...atAGlance("990원").flat(), ...steps("990원").map((s) => `${s.before ?? ""}${s.strong}${s.rest}`), ...faqGroups("990원").flatMap((g) => g.items.flatMap((f) => [f.q, f.a]))].join("\n");

test("공개 소개 문구에 근거 표시·확인 표시가 남지 않는다", () => {
  const t = all();
  for (const bad of ["⚠️", "⏸", "자료", "쪽)", "예언", "운명"]) assert.ok(!t.includes(bad), bad);
});

test("JSON-LD FAQ는 화면 FAQ와 글자까지 같다", () => {
  const ld = aboutJsonLd("https://x", "990원") as { "@graph": { "@type": string; mainEntity?: { name: string; acceptedAnswer: { text: string } }[] }[] };
  const faq = ld["@graph"].find((n) => n["@type"] === "FAQPage")!.mainEntity!;
  const screen = faqGroups("990원").flatMap((g) => g.items);
  assert.deepEqual(faq.map((f) => [f.name, f.acceptedAnswer.text]), screen.map((f) => [f.q, f.a]));
  assert.ok(!JSON.stringify(ld).includes("offers"));
});

test("가격은 넘겨준 값으로 바뀐다(할인 종료 대비)", () => {
  assert.ok(aboutDescription("1,900원").includes("전체 리포트(1,900원)"));
  assert.ok(faqGroups("1,900원")[0].items.find((f) => f.q === "어떻게 이용하나요?")!.a.includes("1,900원이에요"));
});

test("v2.1 정정 반영(112·메이저 카드·개인정보·환불 FAQ)", () => {
  const t = all();
  assert.ok(t.includes("112·119"));
  assert.ok(t.includes("타로 메이저 카드 22장"));
  assert.ok(!t.includes("대어 본 해석"));
  const qs = faqGroups("990원").flatMap((g) => g.items.map((f) => f.q));
  assert.ok(qs.includes("내가 쓴 고민은 어떻게 쓰이나요?") && qs.includes("환불이 되나요?"));
});

