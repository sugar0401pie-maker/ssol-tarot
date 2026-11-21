import { test } from "node:test";
import assert from "node:assert/strict";
import { homeMeta } from "./home.ts";

test("첫 화면 검색 문구: 설명은 990원 고정 문구(owner 2026-11-21), 금지어 없음", () => {
  const nov = homeMeta(new Date("2026-11-16T12:00:00+09:00"));
  assert.ok(nov.description.includes("단돈 990원에"));
  assert.ok(homeMeta(new Date("2026-12-01T00:00:00+09:00")).description.includes("단돈 990원에"));
  for (const t of Object.values(nov)) assert.ok(!/운명|예언|맞힌다|맞혀/.test(t), t);
});
