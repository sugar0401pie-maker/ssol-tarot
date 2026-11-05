import { test } from "node:test";
import assert from "node:assert/strict";
import { GUEST_DEVICE_LIMIT, GUEST_IP_LIMIT, GUEST_RESULT_YEAR_FROM, clientIp, deviceId, guestLimitReached, guestResultCutoffs, guestYearRetentionActive } from "./guestLimit.ts";

const hdr = (o: Record<string, string>) => ({ get: (k: string) => o[k] ?? null });

test("같은 기기 5번, 같은 IP 20번이면 막는다", () => {
  assert.equal(GUEST_DEVICE_LIMIT, 5);
  assert.equal(GUEST_IP_LIMIT, 20);
  assert.equal(guestLimitReached({ device: 4, ip: 19 }), false);
  assert.equal(guestLimitReached({ device: 5, ip: 0 }), true);
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

test("결과 보관: 시행일 전에 만든 결과는 7일, 시행일부터 만든 결과는 1년", () => {
  const day = 24 * 60 * 60 * 1000;
  // 시행일 전: 지금과 같은 7일 기준
  const before = new Date("2026-11-20T12:00:00+09:00");
  const a = guestResultCutoffs(before);
  assert.equal(a.shortBefore.getTime(), before.getTime() - 7 * day);
  // 시행일 한참 뒤: 7일 기준은 시행일에서 멈춤(시행일 뒤에 만든 결과는 7일로 지우지 않음), 1년 기준이 따로
  const after = new Date("2027-03-01T00:00:00+09:00");
  const b = guestResultCutoffs(after);
  assert.equal(b.shortBefore.getTime(), GUEST_RESULT_YEAR_FROM.getTime());
  assert.equal(b.longBefore.getTime(), after.getTime() - 365 * day);
  assert.equal(guestYearRetentionActive(before), false);
  assert.equal(guestYearRetentionActive(after), true);
});

