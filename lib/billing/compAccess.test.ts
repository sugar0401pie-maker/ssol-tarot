import { test } from "node:test";
import assert from "node:assert/strict";
import { hasCompAccess } from "./compAccess.ts";

const G = [{ email: "owner-test@ssolwellnesshouse.com", until: "2026-11-03T00:00:00+09:00", note: "" }];
test("목록의 계정은 기간 안에서만, 다른 계정·빈 값은 절대 안 됨", () => {
  assert.equal(hasCompAccess("owner-test@ssolwellnesshouse.com", new Date("2026-11-02T23:59:59+09:00"), G), true);
  assert.equal(hasCompAccess(" Owner-Test@SsolWellnessHouse.com ", new Date("2026-11-02T12:00:00+09:00"), G), true);
  assert.equal(hasCompAccess("owner-test@ssolwellnesshouse.com", new Date("2026-11-03T00:00:00+09:00"), G), false);
  assert.equal(hasCompAccess("someone@gmail.com", new Date("2026-11-02T12:00:00+09:00"), G), false);
  assert.equal(hasCompAccess(null, new Date("2026-11-02T12:00:00+09:00"), G), false);
  assert.equal(hasCompAccess("", new Date("2026-11-02T12:00:00+09:00"), G), false);
});

test("끝나는 날 없는(until: null) 계정은 언제나, 실제 목록의 무제한 계정 확인", () => {
  const U = [{ email: "a@b.com", until: null, note: "" }];
  assert.equal(hasCompAccess("a@b.com", new Date("2030-01-01T00:00:00+09:00"), U), true);
  assert.equal(hasCompAccess("x@b.com", new Date("2030-01-01T00:00:00+09:00"), U), false);
  assert.equal(hasCompAccess("seotaiji0124@naver.com", new Date("2027-06-01T00:00:00+09:00")), true);
  assert.equal(hasCompAccess("owner-test@ssolwellnesshouse.com", new Date("2027-06-01T00:00:00+09:00")), false);
});
