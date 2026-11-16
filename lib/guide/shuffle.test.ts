import { test } from "node:test";
import assert from "node:assert/strict";
import { shuffleTexts, shuffleJsonLd, FAQ } from "./shuffle.ts";
import { INDEX_TITLE, INDEX_DESC, INDEX_H1 } from "../cards/content.ts";

const BAD = /운명|예언|맞힌다|맞혀|반드시|틀림없/;

test("셔플 안내·카드 모아 보기 글에 금지어 없음, 검색어 포함", () => {
  for (const t of [...shuffleTexts(), INDEX_TITLE, INDEX_DESC, INDEX_H1]) assert.ok(!BAD.test(t), t);
  const all = shuffleTexts().join(" ");
  for (const w of ["타로", "셔플", "3장", "정방향", "역방향"]) assert.ok(all.includes(w), w);
  assert.ok(!INDEX_TITLE.includes("바다 친구들"));
});

test("구조화 데이터 FAQ = 화면 FAQ", () => {
  const g = shuffleJsonLd("https://x")["@graph"].find((n: { "@type": string }) => n["@type"] === "FAQPage") as { mainEntity: { name: string }[] };
  assert.deepEqual(g.mainEntity.map((q) => q.name), FAQ.map((f) => f.q));
});
