import { test } from "node:test";
import assert from "node:assert/strict";
import { claimVisit } from "./visit.ts";

const mem = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};

test("같은 탭 묶음에서는 한 번만 센다", () => {
  const s = mem();
  assert.equal(claimVisit(s), true);
  assert.equal(claimVisit(s), false);
});

test("저장소가 없거나 막히면 세지 않는다", () => {
  assert.equal(claimVisit(null), false);
  assert.equal(claimVisit({ getItem: () => { throw new Error("blocked"); }, setItem: () => {} }), false);
});
