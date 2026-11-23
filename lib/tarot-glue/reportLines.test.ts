import { test } from "node:test";
import assert from "node:assert/strict";
import { replaceThirdSentence, aliasText, fixQuoted, namesFor, typeOf, applyReportLines } from "./reportLines.ts";

test("셋째 문장만 바꾸고, 굵은 글씨·짧은 문단은 그대로", () => {
  assert.equal(replaceThirdSentence("**하나예요.** 둘이에요. 셋입니다.", "새 문장입니다."), "**하나예요.** 둘이에요. 새 문장입니다.");
  assert.equal(replaceThirdSentence("하나. 둘.", "새."), "하나. 둘.");
  assert.equal(replaceThirdSentence("하나. 둘. **셋.**", "새."), "하나. 둘. **셋.**");
});

test("별칭 바꾸기: 조사를 받침에 맞추고 '쪽 쪽'을 겹치지 않는다", () => {
  const n = { full: "먼저 연락하기", alias: "먼저 연락" };
  assert.equal(aliasText("‘먼저 연락하기’를 고르면 먼저 연락하기가 쉬워요.", n, false), "‘먼저 연락’을 고르면 먼저 연락이 쉬워요.");
  assert.equal(aliasText("‘먼저 연락하기’를 하고 ‘먼저 연락하기’로", n, true), "‘먼저 연락하기’를 하고 ‘먼저 연락’으로");
  const o = { full: "지금 자리에 머무는 흐름", alias: "머무는 쪽" };
  assert.equal(aliasText("‘지금 자리에 머무는 흐름’ 쪽을 가리켜요.", o, false), "‘머무는 쪽’을 가리켜요.");
  assert.equal(fixQuoted("지금은 ‘현재 회사에 남기’이에요.", "현재 회사에 남기"), "지금은 ‘현재 회사에 남기’예요.");
});

test("고민 유형: 사용자가 쓴 선택지는 별칭을 만들지 않고, 예측 선택지는 DB 별칭", () => {
  const lean = { table: "job", side: "stay", option: "지금 자리에 머무는 흐름", other: "옮기는 일이 이뤄지는 흐름" };
  assert.deepEqual(namesFor({ frame: { decision_source: "implicit", forecast: true, want: "yesno", table: "job" }, lean }).map((x) => x.alias), ["옮겨지는 쪽", "머무는 쪽"]);
  assert.deepEqual(namesFor({ frame: { decision_source: "explicit", options: ["a", "b"], table: "job" }, lean: { ...lean, option: "a", other: "b" } }), []);
  assert.equal(typeOf(null), "SITUATION");
  assert.equal(typeOf({ options: ["a", "b"], table: "job" }), "CHOICE"); // 예전 틀(decision_source 없음)
});

test("결제 전에는 1·2쪽 영역 문장·고민 인용만 — 5쪽 이후는 손대지 않는다", () => {
  const pages = [
    { page: 1, body: "**하나예요.** 둘이에요. 셋입니다." },
    { page: 3, body: "!! **읽었어요.** 이어서." },
    { page: 5, body: "## 제목\n\n생각보다 분명한 답을 내놓았어요." },
  ];
  const picks = [{ card: { no: 0 }, reversed: false }, { card: { no: 1 }, reversed: false }, { card: { no: 2 }, reversed: false }] as never;
  const out = applyReportLines(pages, { paid: false, frame: null, lean: null, picks, cls: null, safety: null, worryText: "이직할까요", tables: {} });
  assert.equal(out[2].body, pages[2].body);
  assert.match(String(out[1].body), /이직할까요/); // 고민 틀이 없으면 고민 한 번 인용
  const out2 = applyReportLines(pages, { paid: false, frame: { sub_id: "WK-QUIT", confidence: "high" }, lean: null, picks, cls: null, safety: null, worryText: "이직할까요", tables: {} });
  assert.notEqual(out2[0].body, pages[0].body); // 직장 · 옮길지 셋째 문장
  const out3 = applyReportLines(pages, { paid: false, frame: { sub_id: "WK-QUIT", confidence: "high" }, lean: null, picks, cls: null, safety: { level: "watch" }, worryText: "x", tables: {} });
  assert.equal(out3[0].body, pages[0].body); // 안전 주의면 공통 문장
});

test("분석 칸: 고민 유형·카드 모양·영역 문장(owner 2026-11-15)", async () => {
  const { analysisFields } = await import("./reportLines.ts");
  const none = analysisFields({ frame: null, lean: null });
  assert.deepEqual(none, { worry_type: "SITUATION", card_pattern: null, area_variant: "COMMON", sub2: null, deep: null, sub_id: null, confidence: null });
  const lean = { side: "move", cards: [{ score: 2 }, { score: 1 }, { score: 3 }] };
  assert.equal(analysisFields({ frame: { table: "job", want: "which" }, lean }).card_pattern, "ALL");
  assert.equal(analysisFields({ frame: null, lean: { side: "move", cards: [{ score: -1 }, { score: -2 }, { score: 2 }] } }).card_pattern, "KEY_ALONE");
  // 안전 주의·폭력이면 영역 문장 없이 공통
  assert.equal(analysisFields({ frame: { sub_id: "WK-MOVE" }, lean: null, safety: { level: "watch" } }).area_variant, "COMMON");
});

test("v3.1 앞단 강조: 1쪽 덧줄·2쪽 기저 생각·3쪽 신호/묻는 꼴 줄, 세기 2면 '더 세게' 장면 문장", async () => {
  const { deepOf, analysisFields, REPORT_LINES } = await import("./reportLines.ts");
  const picks = [{ card: { no: 5 }, reversed: false }, { card: { no: 9 }, reversed: false }, { card: { no: 2 }, reversed: false }] as never;
  const frame = { sub_id: "WK-QUIT", confidence: "high" };
  const pages = [
    { page: 1, body: "**하나예요.** 둘이에요. 셋입니다." },
    { page: 2, body: "**하나예요.** 둘이에요. 셋입니다." },
    { page: 3, body: "!! **읽었어요.** 이어서.\n\n다음 문단." },
  ];
  const hard = "회사 그만둘지 3년째 고민돼요 너무 지쳤어요";
  const d = deepOf({ frame, picks, safety: null, worryText: hard })!;
  assert.equal(d.level, 2);
  const out = applyReportLines(pages, { paid: false, frame, lean: null, picks, cls: null, safety: null, worryText: hard, tables: {} });
  assert.ok(String(out[0].body).endsWith(d.page1_tail) && d.page1_tail);
  assert.ok(String(out[1].body).endsWith(d.page2_thought) && d.page2_thought.startsWith("이 카드가 짚는 건"));
  const strong = REPORT_LINES.scene_strong["5_up"];
  const v = Object.keys(strong).find((k) => String(out[0].body).includes(strong[k].now));
  assert.ok(v, "세기 2면 scene_strong");
  const c3 = String(out[2].body).split("\n\n");
  assert.equal(c3[1], d.page3_signal); // 고민 읽기 바로 아래 신호 줄
  // 안전 주의·확신 낮음·세부 없음이면 아무것도 안 붙음
  assert.equal(deepOf({ frame, picks, safety: { level: "watch" }, worryText: hard })!.level, 0);
  assert.equal(deepOf({ frame: { ...frame, confidence: "low" }, picks, safety: null, worryText: hard })!.level, 0);
  assert.equal(deepOf({ frame: {}, picks, safety: null, worryText: hard }), null);
  // 2순위 세부가 다른 묶음이면 3쪽 줄 출처가 2순위
  const d2 = deepOf({ frame: { ...frame, sub2: "MN-WHEN" }, picks, safety: null, worryText: "회사 그만둘까요 돈이 걱정" })!;
  assert.equal(d2.source, "second");
  const a = analysisFields({ frame: { ...frame, sub2: "MN-WHEN" }, lean: null, picks, worryText: hard });
  assert.equal(a.sub2, "MN-WHEN"); assert.equal(a.deep?.deep_level, 2);
});

test("더 세게 신호 넓힘(owner 2026-11-16, CSO 판정은 유지)", async () => {
  const { intensityOf } = await import("../tarot/deepRead.js");
  const DR = (await import("../../data/deep_read.json", { with: { type: "json" } })).default;
  for (const x of ["회사 그만둘까요 그냥 다닐까요", "헤어진 남친과 다시 만나고파", "지금 하는 일이 저랑 안 맞는 것 같아요", "앞으로 뭘 해야 할지 모르겠어요"]) assert.equal(intensityOf(x, {}, DR).level, 2, x);
  // CSO 판정 '지금 정도' — 사정 없는 시기 질문·설렘·해 보고 싶다
  for (const x of ["이직 언제 될까요", "둘 다 너무너무 하고 싶은데 붙을 수 있을까요?", "이상형인 사람과 사귀어 보고 싶어요"]) assert.equal(intensityOf(x, {}, DR).level, 1, x);
});
