import { test } from "node:test";
import assert from "node:assert/strict";
import { lineAt } from "./rotate.ts";

test("안내 문구는 3초마다 다음 줄, 끝나면 처음으로", () => {
  const L = ["a", "b", "c"];
  assert.equal(lineAt(L, 0), "a");
  assert.equal(lineAt(L, 2999), "a");
  assert.equal(lineAt(L, 3000), "b");
  assert.equal(lineAt(L, 9000), "a");
  assert.equal(lineAt([], 5000), "");
});
