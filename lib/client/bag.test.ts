import { test } from "node:test";
import assert from "node:assert/strict";
import { nextFromBag } from "./bag.ts";

test("한 바퀴(21명) 동안 같은 친구가 두 번 나오지 않는다", () => {
  let bag: number[] = [], last: number | null = null;
  const seen = new Set<number>();
  for (let i = 0; i < 21; i++) {
    const r = nextFromBag(bag, 21, last);
    assert.ok(!seen.has(r.pick));
    seen.add(r.pick); bag = r.bag; last = r.pick;
  }
  assert.equal(seen.size, 21);
});

test("바퀴가 바뀔 때 바로 앞 친구와 겹치지 않는다", () => {
  let bag: number[] = [], last: number | null = null;
  for (let i = 0; i < 21 * 200; i++) {
    const r = nextFromBag(bag, 21, last);
    assert.notEqual(r.pick, last);
    bag = r.bag; last = r.pick;
  }
});
