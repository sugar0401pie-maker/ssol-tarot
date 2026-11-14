import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeUtm, utmFromSearch, storedUtm, UTM_MAX_AGE_MS } from "./utm.ts";

test("주소에서 utm 읽기: source가 없으면 없음, 빈 값은 ''", () => {
  assert.deepEqual(utmFromSearch("?utm_source=x&utm_campaign=nov&utm_content=reel1"), { source: "x", medium: "", campaign: "nov", content: "reel1", term: "" });
  assert.equal(utmFromSearch("?utm_campaign=nov"), null);
  assert.equal(utmFromSearch(""), null);
});

test("값 검사: 알 수 없는 칸·제어 문자 버림, 100자로 자름", () => {
  const u = sanitizeUtm({ source: "x\n", campaign: "a".repeat(300), evil: "y", content: 3 })!;
  assert.equal(u.source, "x");
  assert.equal(u.campaign.length, 100);
  assert.equal(u.content, "");
  assert.equal("evil" in u, false);
  assert.equal(sanitizeUtm("x"), null);
});

test("보관한 값은 30일까지만", () => {
  const now = 1_800_000_000_000;
  const raw = (at: number) => JSON.stringify({ utm: { source: "x" }, at });
  assert.equal(storedUtm(raw(now - 1000), now)?.source, "x");
  assert.equal(storedUtm(raw(now - UTM_MAX_AGE_MS - 1), now), null);
  assert.equal(storedUtm("깨진 값", now), null);
  assert.equal(storedUtm(null, now), null);
});
