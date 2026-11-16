import { test } from "node:test";
import assert from "node:assert/strict";
import { homeMeta } from "./home.ts";

test("첫 화면 검색 문구: 할인 기간 990원, 끝나면 1,900원, 금지어 없음", () => {
  const nov = homeMeta(new Date("2026-11-16T12:00:00+09:00"));
  assert.ok(nov.description.includes("990원에 알려드려요"));
  assert.ok(homeMeta(new Date("2026-12-01T00:00:00+09:00")).description.includes("1,900원에 알려드려요"));
  for (const t of Object.values(nov)) assert.ok(!/운명|예언|맞힌다|맞혀/.test(t), t);
});
