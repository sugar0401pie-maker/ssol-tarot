import { test } from "node:test";
import assert from "node:assert/strict";
import { GUEST_DEVICE_LIMIT, GUEST_IP_LIMIT, clientIp, deviceId, guestLimitReached } from "./guestLimit.ts";

const hdr = (o: Record<string, string>) => ({ get: (k: string) => o[k] ?? null });

test("같은 기기 3번, 같은 IP 20번이면 막는다", () => {
  assert.equal(GUEST_DEVICE_LIMIT, 3);
  assert.equal(GUEST_IP_LIMIT, 20);
  assert.equal(guestLimitReached({ device: 2, ip: 19 }), false);
  assert.equal(guestLimitReached({ device: 3, ip: 0 }), true);
  assert.equal(guestLimitReached({ device: 0, ip: 20 }), true);
});

test("한쪽을 셀 수 없으면 다른 쪽만 보고, 둘 다 셀 수 없으면 막는다", () => {
  assert.equal(guestLimitReached({ device: null, ip: 5 }), false);
  assert.equal(guestLimitReached({ device: 1, ip: null }), false);
  assert.equal(guestLimitReached({ device: null, ip: null }), true);
});

test("IP는 x-forwarded-for의 첫 값, 기기 값은 형식이 맞을 때만", () => {
  assert.equal(clientIp(hdr({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" })), "1.2.3.4");
  assert.equal(clientIp(hdr({ "x-real-ip": "5.6.7.8" })), "5.6.7.8");
  assert.equal(clientIp(hdr({})), null);
  assert.equal(deviceId(hdr({ "x-tarot-device": "abcdef0123456789abcd" })), "abcdef0123456789abcd");
  assert.equal(deviceId(hdr({ "x-tarot-device": "짧음" })), null);
});
