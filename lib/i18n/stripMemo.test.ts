import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { isMemoKey, stripMemo } from "./stripMemo.ts";

const read = (p: string) => JSON.parse(fs.readFileSync(new URL(p, import.meta.url), "utf8"));
const MEMO_WORDS = /owner|claude|초안|대표님|CSO|개발 원문|확인 필요/i;
const strings = (o: unknown, out: string[] = []): string[] => {
  if (typeof o === "string") out.push(o);
  else if (Array.isArray(o)) o.forEach((v) => strings(v, out));
  else if (o && typeof o === "object") Object.values(o).forEach((v) => strings(v, out));
  return out;
};

test("브라우저로 보내는 문구에 메모 말(owner·Claude·초안·대표님…)이 남지 않는다(owner 2026-11-21)", () => {
  for (const p of ["../../data/tarot_data.json", "../../data/en/tarot_data.json"]) {
    const left = strings(stripMemo(read(p).copy)).filter((s) => MEMO_WORDS.test(s));
    assert.deepEqual(left, [], p);
  }
});

test("화면에 쓰는 칸은 남긴다", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- JSON 데이터 확인용
  const c = stripMemo(read("../../data/tarot_data.json").copy) as Record<string, any>;
  assert.ok(c.result.secret3.pick_note);
  assert.ok(c.share_card.sheet_note);
  assert.ok(c.safety.watch_note);
  assert.ok(c.worry.footnote);
  assert.equal(c.share_card.kakao_rule, undefined);
  assert.equal(c.result.secret3._source, undefined);
  assert.equal(c.result.secret3.note, undefined);
  for (const k of ["note", "footnote", "watch_note", "sheet_note", "pick_note", "p4_after_pay_note"]) assert.equal(isMemoKey(k), false, k);
});
