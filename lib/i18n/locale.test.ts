import { test } from "node:test";
import assert from "node:assert/strict";
import { localePath, splitLocale, toLocale } from "./locale.ts";

test("localePath", () => {
  assert.equal(localePath("/", "en"), "/en");
  assert.equal(localePath("/worry", "en"), "/en/worry");
  assert.equal(localePath("/result/a/3", "en"), "/en/result/a/3");
  assert.equal(localePath("/?start=1", "en"), "/en?start=1");
  assert.equal(localePath("/en/worry", "en"), "/en/worry");
  assert.equal(localePath("/worry", "ko"), "/worry");
  assert.equal(localePath("https://x.com/a", "en"), "https://x.com/a");
  assert.equal(localePath("/entry", "en"), "/en/entry");
});
test("splitLocale", () => {
  assert.deepEqual(splitLocale("/en"), { locale: "en", path: "/" });
  assert.deepEqual(splitLocale("/en/draw"), { locale: "en", path: "/draw" });
  assert.deepEqual(splitLocale("/entry"), { locale: "ko", path: "/entry" });
  assert.deepEqual(splitLocale("/draw"), { locale: "ko", path: "/draw" });
});
test("toLocale: 모르는 값은 한국어", () => {
  assert.equal(toLocale(null), "ko");
  assert.equal(toLocale("en"), "en");
  assert.equal(toLocale("fr"), "ko");
});
