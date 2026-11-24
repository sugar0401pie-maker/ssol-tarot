import { test } from "node:test";
import assert from "node:assert/strict";
import { pickFreeLines, isLongWorry } from "./freeLines.ts";

test("C 응답에서 free_lines 꺼내기(v3.7 2안)", () => {
  assert.deepEqual(pickFreeLines('{"now":{},"free_lines":{"p1":" 가 ","p2":"나"}}'), { p1: "가", p2: "나" });
  assert.deepEqual(pickFreeLines('```json\n{"free_lines":{"p1":"가"}}\n```'), { p1: "가", p2: "" });
  assert.equal(pickFreeLines('{"free_lines":null}'), null);
  assert.equal(pickFreeLines("JSON 아님"), null);
  assert.equal(pickFreeLines('{"free_lines":{"p1":3}}'), null);
  assert.equal(pickFreeLines(`{"free_lines":{"p1":"${"가".repeat(500)}"}}`)!.p1.length, 200);
});

test("41자 이상만 긴 고민", () => {
  assert.equal(isLongWorry("가".repeat(41), 41), true);
  assert.equal(isLongWorry("가".repeat(40), 41), false);
  assert.equal(isLongWorry(null, 41), false);
});
