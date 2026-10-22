import { test } from "node:test";
import assert from "node:assert/strict";
import { isPasswordValid, passwordChecks } from "./password.ts";

test("비밀번호 규칙: 8자 이상 + 대문자 + 특수문자(쏘웰라와 같음)", () => {
  assert.equal(isPasswordValid("Abcdefg!"), true);
  assert.equal(isPasswordValid("abcdefg!"), false);
  assert.equal(isPasswordValid("Abcdefgh"), false);
  assert.equal(isPasswordValid("Ab!"), false);
  assert.deepEqual(passwordChecks(""), { length: false, upper: false, special: false });
});
