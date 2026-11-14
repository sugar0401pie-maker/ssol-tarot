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
