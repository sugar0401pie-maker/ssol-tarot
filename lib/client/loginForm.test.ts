import { test } from "node:test";
import assert from "node:assert/strict";
import { safeNext, checkLoginInput } from "./loginForm.ts";

test("돌아갈 주소는 우리 앱 안의 경로만", () => {
  assert.equal(safeNext("/result/abc"), "/result/abc");
  assert.equal(safeNext(null), "/");
  assert.equal(safeNext(""), "/");
  assert.equal(safeNext("https://evil.example"), "/");
  assert.equal(safeNext("//evil.example"), "/");
  assert.equal(safeNext("/\\evil.example"), "/");
});

test("입력 검사", () => {
  assert.equal(checkLoginInput("", "x"), "이메일을 입력해 주세요.");
  assert.equal(checkLoginInput("abc", "x"), "이메일 형식을 확인해 주세요.");
  assert.equal(checkLoginInput("a@b.co", ""), "비밀번호를 입력해 주세요.");
  assert.equal(checkLoginInput(" a@b.co ", "pw"), null);
});
