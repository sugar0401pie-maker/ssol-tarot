import { test } from "node:test";
import assert from "node:assert/strict";
import { hasAuthCookie } from "./authCookie.ts";

test("로그인 쿠키가 있을 때만 Supabase 도구를 불러온다", () => {
  assert.equal(hasAuthCookie(""), false);
  assert.equal(hasAuthCookie("ssol_x=1; theme=dark"), false);
  assert.equal(hasAuthCookie("sb-abcd-auth-token=base64-xyz"), true);
  assert.equal(hasAuthCookie("a=1; sb-abcd-auth-token.0=part; sb-abcd-auth-token.1=part"), true);
  assert.equal(hasAuthCookie("xsb-abcd-auth-token=1"), false, "이름 앞에 다른 글자가 붙으면 아님");
});
