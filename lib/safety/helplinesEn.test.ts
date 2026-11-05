import { test } from "node:test";
import assert from "node:assert/strict";
import { helplinesFor, fillHelplines, telOf } from "./helplinesEn.ts";

test("모르는 나라·나라 정보 없음 → 국제 안내(빈칸 없음)", () => {
  for (const c of [null, "", "ZZ", "kr"]) {
    const h = helplinesFor(c);
    for (const v of Object.values(h)) assert.ok(v && v.length > 3);
  }
});
test("자리 채우기: 다른 자리는 그대로", () => {
  const h = helplinesFor("US");
  assert.equal(fillHelplines("Call {emergency} now, {nickname}.", h), "Call 911 now, {nickname}.");
  assert.ok(!/\{crisis_line\}/.test(fillHelplines("{crisis_line} is there.", helplinesFor("GB"))));
});
test("전화 번호 고르기", () => {
  assert.equal(telOf("988 (call or text)"), "988");
  assert.equal(telOf("Samaritans, 116 123"), "116123");
  assert.equal(telOf("your local emergency number"), null);
});
