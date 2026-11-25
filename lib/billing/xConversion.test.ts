import { test } from "node:test";
import assert from "node:assert/strict";
import { buildXConversionBody, clientIp, parseTwclid } from "./xConversion.ts";

test("twclid 쿠키: JSON·그대로·없음", () => {
  const json = encodeURIComponent(JSON.stringify({ timestamp: 1, twclid: "abcDEF123_-x" }));
  assert.equal(parseTwclid(`a=1; _twclid=${json}; b=2`), "abcDEF123_-x");
  assert.equal(parseTwclid("_twclid=plainvalue123"), "plainvalue123");
  assert.equal(parseTwclid("other=1"), null);
  assert.equal(parseTwclid("_twclid=<script>"), null);
});

test("IP는 첫 번째 값만", () => {
  assert.equal(clientIp("203.0.113.5, 10.0.0.1"), "203.0.113.5");
  assert.equal(clientIp(""), null);
});

test("본문: 식별자 없으면 보내지 않고, 이메일·고민은 넣지 않는다", () => {
  const base = { eventId: "tw-rk3w9-abc12", orderId: "o-1", amount: 990, currency: "KRW" as const, time: new Date("2026-11-25T00:00:00Z") };
  assert.equal(buildXConversionBody(base), null);
  assert.equal(buildXConversionBody({ ...base, ip: "203.0.113.5" }), null); // 브라우저 정보 없이 IP만은 안 됨
  const b = buildXConversionBody({ ...base, ip: "203.0.113.5", userAgent: "UA", twclid: "tw123456" }) as { conversions: Record<string, unknown>[] };
  const c = b.conversions[0];
  assert.equal(c.event_id, "tw-rk3w9-abc12");
  assert.equal(c.conversion_id, "o-1");
  assert.equal(c.value, 990);
  assert.deepEqual(c.identifiers, [{ twclid: "tw123456", ip_address: "203.0.113.5", user_agent: "UA" }]);
  assert.ok(!JSON.stringify(b).includes("email"));
});
