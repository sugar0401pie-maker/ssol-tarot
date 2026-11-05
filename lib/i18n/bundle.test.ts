/* eslint-disable @typescript-eslint/no-explicit-any */
import { test } from "node:test";
import assert from "node:assert/strict";
import { bundleFor, worryLimits } from "./bundle.ts";
import { fillMissing, interimKeysUsed, EN_INTERIM_COPY } from "./enInterim.ts";
import en from "../../data/en/tarot_data.json" with { type: "json" };

test("고민 글자 수: 한국어 10~300, 영어 20~600(owner 2026-11-05)", () => {
  assert.deepEqual(worryLimits("ko"), { min: 10, max: 300 });
  assert.deepEqual(worryLimits("en"), { min: 20, max: 600 });
});
test("한국어 묶음은 한국어 데이터 그대로", () => {
  assert.equal(bundleFor("ko").data.cards[0].name, "첫 물장구");
  assert.equal(bundleFor("en").data.cards[0].name, "The First Splash");
});
test("임시 문구는 빠진 키만 채우고 데이터 값을 덮지 않는다", () => {
  assert.deepEqual(fillMissing({ a: "x", b: { c: 1 } }, { a: "y", b: { c: 2, d: 3 }, e: 4 }), { a: "x", b: { c: 1, d: 3 }, e: 4 });
  const c = bundleFor("en").data.copy as any;
  assert.equal(c.worry.max_len, 600);
  assert.ok(c.result.secret3.intro);
});
test("영어 화면 문구에 한글이 남지 않는다(임시 문구 포함)", () => {
  assert.ok(!/[가-힣]/.test(JSON.stringify(EN_INTERIM_COPY)));
  const c = bundleFor("en").data.copy as any;
  for (const k of ["intro", "welcome", "experience", "first_time", "worry", "shuffle", "pick", "loading", "safety"]) {
    const text = JSON.stringify(c[k] ?? {}).replace(/"(rule|note|[a-z_]*_rule|[a-z_]*_note)":"(?:[^"\\]|\\.)*"/g, "");
    assert.ok(!/[가-힣]/.test(text), `copy.${k}에 한글`);
  }
});
test("아직 임시 문구로 채우는 키 목록(기획 번역이 오면 줄어든다)", () => {
  const left = interimKeysUsed((en as any).copy);
  assert.ok(left.length > 0); // 지금은 있음 — 0이 되면 이 테스트를 '0이어야 한다'로 바꾼다
});
