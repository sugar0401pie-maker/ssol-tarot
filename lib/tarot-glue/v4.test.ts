import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { decide, buildCUserBlock, buildUnpaidPages, sanitizeUnpaid } from "./v4.ts";
import { picksFromSlots, createShuffle } from "../tarot/deck.js";
import { parseFrame, parseC } from "../tarot/validateV4.js";
import { screenText, mergeSafety } from "../tarot/safety.js";

const data = JSON.parse(fs.readFileSync(new URL("../../data/tarot_data.json", import.meta.url), "utf8"));
const FX = new URL("../tarot/fixtures/도현/", import.meta.url);
const readJ = (f: string) => JSON.parse(fs.readFileSync(new URL(f, FX), "utf8"));
const cs = readJ("case.json");
const sh = createShuffle(data);
cs.picks.forEach((p: { id: string; reversed: boolean }) => (sh.reversed[p.id] = p.reversed));
const picks = picksFromSlots(sh, cs.picks.map((p: { id: string }) => sh.order.indexOf(p.id)), data);
const { frame } = parseFrame(readJ("A2_out.json"));
const safety = mergeSafety(screenText(cs.worry, data.safety_keywords), cs.ai);

test("도현님(이직 결정형): 방향이 '현재 회사에 남기'로 계산된다", () => {
  const d = decide({ frame, cls: cs.ai, picks, name: cs.name });
  assert.equal(d.decision, true);
  assert.equal(d.lean?.option, "현재 회사에 남기");
  assert.equal(d.lean?.side, "stay");
});

test("고민 틀이 없으면 비결정형", () => {
  assert.deepEqual(decide({ frame: null, cls: cs.ai, picks, name: cs.name }), { decision: false, lean: null });
});

test("C 입력에 고민 틀과 방향이 들어가고, 미작성이면 null", () => {
  const { lean } = decide({ frame, cls: cs.ai, picks, name: cs.name });
  const block = buildCUserBlock({ name: cs.name, worryText: cs.worry, cls: cs.ai, picks, frame, lean })!;
  assert.match(block, /worry_frame=\{/);
  assert.match(block, /direction_lean=\{"decision":true,"side":"stay","option":"현재 회사에 남기"/);
  assert.ok(block.trim().endsWith("</user_data>"));
  assert.equal(buildCUserBlock({ name: cs.name, worryText: null, cls: null, picks, frame: null, lean: null }), null);
});

test("결제 전 응답에는 결론과 유료 본문이 없다", () => {
  const { decision, lean } = decide({ frame, cls: cs.ai, picks, name: cs.name });
  const C = parseC(readJ("C_out.json"), { decision, strength: lean?.strength, frame, lean, violence: safety.violence });
  const raw = buildUnpaidPages({ name: cs.name, cls: cs.ai, picks, safety, worryText: cs.worry, frame, lean, C });
  assert.equal(raw.length, 11);
  assert.ok(raw[4].locked, "원본 5쪽에는 locked(결론)가 들어 있음 — 그래서 거르는 함수가 필요");
  const out = sanitizeUnpaid(raw);
  const text = JSON.stringify(out);
  assert.ok(!("locked" in out[4]) && !("combo" in out[4]) && !("map" in out[4]));
  assert.ok(!text.includes("세 장을 합치면"), "결론 문장이 새면 안 됨");
  assert.ok(!text.includes("C_out") && !text.includes("[[읽기 지도"), "읽기 지도(점수)는 결제 전에 안 보냄");
  assert.equal(out[4].body, null);
  for (const p of out.slice(5)) assert.equal(p.body, null);
  assert.ok(out[4].free.startsWith("## "), "5쪽 무료 부분(teaser)은 남음");
  assert.ok(out[1].body && out[1].card.name);
});

test("고민 미작성(분류·틀·C 없음)도 11쪽이 끊기지 않는다", () => {
  const out = sanitizeUnpaid(buildUnpaidPages({ name: "지수", cls: null, picks, safety: { level: "none", violence: false, fear: false }, worryText: "", frame: null, lean: null, C: null }));
  assert.equal(out.length, 11);
  assert.ok(out[0].body && out[4].free);
});
