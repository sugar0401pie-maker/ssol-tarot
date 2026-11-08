import { test } from "node:test";
import assert from "node:assert/strict";
import { toF16, fromF16, unit, decodeIndex, hybridTop } from "./embedSearch.ts";

test("16비트 실수 저장 왕복(임베딩 값 범위)", () => {
  for (const x of [0, 0.5, -0.031, 0.0007, -0.2, 1]) assert.ok(Math.abs(fromF16(toF16(x)) - x) < 1e-3, String(x));
});

test("색인 디코드 + 섞은 점수 순위", () => {
  const dim = 4;
  const rows = [[1, 0, 0, 0], [0, 1, 0, 0], [0.7, 0.7, 0, 0]];
  const buf = new Uint16Array(rows.flat().map(toF16));
  const vecs = decodeIndex(new Uint8Array(buf.buffer), dim);
  assert.equal(vecs.length, 3);
  const q = unit([1, 0.1, 0, 0]);
  const top = hybridTop(q, vecs, ["a", "b", "c"], new Map(), 2);
  assert.deepEqual(top.map((t) => t.i), [0, 2]);
  // 글자 점수가 크면 순위가 바뀔 수 있다
  const top2 = hybridTop(q, vecs, ["a", "b", "c"], new Map([["b", 1]]), 1, 0.5);
  assert.equal(top2[0].i, 1);
});
