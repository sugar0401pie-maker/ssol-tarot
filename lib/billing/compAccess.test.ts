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
