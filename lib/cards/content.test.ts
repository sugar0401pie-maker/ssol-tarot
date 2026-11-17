import { test } from "node:test";
import assert from "node:assert/strict";
import { CARD_PAGES, cardBySlug, cardTexts, hasForbidden, neighbors } from "./content.ts";
import data from "../../data/tarot_data.json" with { type: "json" };

test("카드 소개 페이지: 22장, 주소가 겹치지 않고 모든 칸이 채워짐", () => {
  assert.equal(CARD_PAGES.length, 22);
  assert.equal(new Set(CARD_PAGES.map((c) => c.slug)).size, 22);
  for (const c of CARD_PAGES) {
    assert.match(c.slug, /^[a-z0-9-]+$/);
    assert.equal(cardBySlug(c.slug), c);
    for (const s of [c.upright, c.reversed]) assert.ok(s.core && s.overview && s.desc && s.keywords.length, `${c.no}`);
  }
  assert.equal(neighbors(CARD_PAGES[0]).prev.no, 21);
  assert.equal(neighbors(CARD_PAGES[21]).next.no, 0);
});

test("카드 소개 페이지: '운명·예언·맞힌다'를 쓰지 않고, 결제 리포트용 처방·성향·변화 신호 문장은 싣지 않음", () => {
  for (const c of CARD_PAGES) for (const t of cardTexts(c)) assert.ok(!hasForbidden(t), `${c.no} ${t}`);
  assert.equal(cardBySlug("wheel-of-fortune")?.arcanaKo, "운명의 수레바퀴");
  assert.ok(hasForbidden("운명이 정해져 있어요"));
  const cards = data.cards as unknown as { no: number; tendency?: string; signs?: string[]; direct?: Record<string, { how?: string }> }[];
  for (const raw of cards) {
    const all = cardTexts(CARD_PAGES[raw.no]).join("\n");
    const paid = [raw.tendency, ...(raw.signs || []), ...Object.values(raw.direct || {}).map((d) => d?.how)].filter((x): x is string => Boolean(x));
    for (const p of paid) assert.ok(!all.includes(p), `${raw.no} 유료 문장 노출: ${p.slice(0, 30)}`);
  }
});
