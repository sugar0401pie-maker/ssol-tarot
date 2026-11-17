import { test } from "node:test";
import assert from "node:assert/strict";
import { PAGE_META, pageMeta } from "./pages.ts";
import { CARD_PAGES, hasForbidden } from "../cards/content.ts";

test("검색 문구 표: 공개 페이지 28곳, 카드 22장 모두 있음", () => {
  assert.equal(Object.keys(PAGE_META).length, 28);
  for (const p of ["/", "/about", "/tarot-shuffle", "/tarot-three-card", "/cards", "/legal"]) assert.ok(PAGE_META[p], p);
  for (const c of CARD_PAGES) assert.ok(PAGE_META[`/cards/${c.slug}`], c.slug);
});

test("검색 문구: 가격은 지금 가격으로(할인 990원 → 12월 1,900원), 금지어 없음, 실천 약속 없음(카드 페이지)", () => {
  const nov = new Date("2026-11-16T12:00:00+09:00");
  const dec = new Date("2026-12-01T00:00:00+09:00");
  assert.ok(pageMeta("/", nov)!.title.startsWith("990원 타로"));
  assert.ok(pageMeta("/", dec)!.title.startsWith("1,900원 타로"));
  for (const p of Object.keys(PAGE_META)) {
    for (const t of Object.values(pageMeta(p, dec)!)) {
      assert.ok(!t.includes("{price}") && !t.includes("990원"), `${p} ${t}`);
      assert.ok(!hasForbidden(t), `${p} ${t}`);
      if (p.startsWith("/cards")) assert.ok(!/실천까지 확인|오늘의 실천/.test(t), `${p} ${t}`);
    }
  }
  assert.ok(pageMeta("/cards/wheel-of-fortune")!.title.includes("운명의 수레바퀴"));
  assert.equal(pageMeta("/nope"), null);
});
