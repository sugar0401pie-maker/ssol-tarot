import { test } from "node:test";
import assert from "node:assert/strict";
import { oauthErrorFromUrl } from "./oauthError.ts";

test("OAuth 실패 이유를 화면 문장으로(없으면 null)", () => {
  assert.equal(oauthErrorFromUrl({ search: "?next=/test", hash: "" }), null);
  assert.match(oauthErrorFromUrl({ search: "?error=server_error&error_description=Error+getting+user+email+from+external+provider", hash: "" })!, /이메일.*\(Error getting user email/);
  assert.match(oauthErrorFromUrl({ search: "", hash: "#error=access_denied&error_description=denied" })!, /\(denied\)/);
});
