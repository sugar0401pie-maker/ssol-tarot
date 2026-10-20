import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { parseClassification, classificationForReport } from "./classification.ts";

const data = JSON.parse(fs.readFileSync(new URL("../../data/tarot_data.json", import.meta.url), "utf8"));
const ok = { domain: "LOV", emotions: ["HUR", "LON"], need: "CONNECT", self_focus: false, crisis_level: "none", violence: false, off_topic: false, confidence: 0.8 };

test("올바른 분류는 그대로 받는다", () => {
  const c = parseClassification(JSON.stringify(ok), data);
  assert.equal(c?.domain, "LOV");
  assert.deepEqual(c?.emotions, ["HUR", "LON"]);
});

test("코드 펜스로 감싸도 받는다", () => {
  assert.ok(parseClassification("```json\n" + JSON.stringify(ok) + "\n```", data));
});

test("JSON이 아니면 실패", () => {
  assert.equal(parseClassification("고민이 연애 쪽이에요", data), null);
});

test("알 수 없는 영역·감정 3개는 실패", () => {
  assert.equal(parseClassification(JSON.stringify({ ...ok, domain: "XXX" }), data), null);
  assert.equal(parseClassification(JSON.stringify({ ...ok, emotions: ["HUR", "LON", "ANX"] }), data), null);
});

test("안전 판단이 빠지거나 이상하면 실패로 본다(none으로 받아들이지 않음)", () => {
  const noCrisis: Partial<typeof ok> = { ...ok };
  delete noCrisis.crisis_level;
  assert.equal(parseClassification(JSON.stringify(noCrisis), data), null);
  assert.equal(parseClassification(JSON.stringify({ ...ok, crisis_level: "fine" }), data), null);
  assert.equal(parseClassification(JSON.stringify({ ...ok, violence: "no" }), data), null);
});

test("urgent·violence는 그대로 전달된다", () => {
  const c = parseClassification(JSON.stringify({ ...ok, crisis_level: "urgent", violence: true }), data);
  assert.equal(c?.crisis_level, "urgent");
  assert.equal(c?.violence, true);
});

test("off_topic이면 결과 조립에는 미작성 모드(null)로", () => {
  const c = parseClassification(JSON.stringify({ ...ok, off_topic: true }), data);
  assert.equal(classificationForReport(c), null);
  assert.ok(classificationForReport(parseClassification(JSON.stringify(ok), data)));
});

test("v4 선택 칸(qtype·qsub·duration 등)을 버리지 않는다, 모르는 qsub는 null", () => {
  const c = parseClassification(JSON.stringify({ ...ok, qtype: "other_mind", qsub: "OM-REPLY", duration: "recent", locus: "other", urgency: "none" }), data);
  assert.equal(c?.qtype, "other_mind");
  assert.equal(c?.qsub, "OM-REPLY");
  assert.equal(c?.duration, "recent");
  assert.equal(parseClassification(JSON.stringify({ ...ok, qsub: "XX-NOPE" }), data)?.qsub, null);
  assert.equal(parseClassification(JSON.stringify({ ...ok, qtype: "weird" }), data), null);
});
