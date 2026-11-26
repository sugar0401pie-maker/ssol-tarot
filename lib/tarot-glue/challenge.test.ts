// 9쪽 작심삼일 챌린지 · 10쪽 쏘웰라 대화 화면(owner 2026-11-26)
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildChallenge } from "../tarot/challenge.js";
import { CDB, mergeAiChallenge, toReportChallenge, applyStored, sowellaChat, dbChallengeInput } from "./challenge.ts";
import data from "../../data/tarot_data.json" with { type: "json" };

const ui = (data.copy.result as unknown as { challenge_ui: Record<string, unknown> }).challenge_ui;
const base = () => buildChallenge({ subId: "WK-QUIT", branchKind: "상태", card2: "12_up", card3: "20_up" }, CDB);
const good = {
  day1: { title: "그만두고 싶은 이유 적기", text: "회사를 그만두고 싶은 이유를 세 줄로 적어 두세요." },
  day2: { title: "회사 밖 모임 한 번 가 보기", text: "회사 사람이 아닌 사람들이 모이는 원데이 클래스에 한 번 가 보세요." },
  day3: { title: "다녀온 뒤 마음 정리하기", text: "모임에 다녀온 뒤 회사 생각이 어떻게 달라졌는지 한 줄로 적어요." },
  week: { title: "모임 사람과 차 한잔하기", text: "모임에서 이야기가 통한 사람에게 이번 주 안에 차 한잔하자고 말해 보세요." },
  month: { title: "모임에서 작은 역할 맡기", text: "한 달 동안 그 모임에 나가며 작은 역할 하나를 맡아 보세요." },
};

test("AI 다섯 칸이 모두 맞으면 다섯 칸 모두 AI 문장, 고민 줄(tie)은 붙이지 않는다", () => {
  const m = mergeAiChallenge(base(), good);
  assert.deepEqual(Object.values(m.ai), [true, true, true, true, true]);
  assert.equal(m.ch.days[1].title, good.day2.title);
  assert.equal(m.ch.days[1].tie, undefined);
  assert.ok(m.ch.days[1].proof, "인증샷 아이디어는 DB 그대로");
});

test("떨어진 칸(너무 김·영어·금지어·없음)은 DB 문장 그대로", () => {
  const b = base();
  const bad = { ...good, day1: { title: "x", text: "짧음." }, day3: { title: "Write it down now", text: good.day3.text }, week: null };
  const m = mergeAiChallenge(b, bad);
  assert.equal(m.ai.day1, false);
  assert.equal(m.ai.day3, false);
  assert.equal(m.ai.week, false);
  assert.equal(m.ch.days[0].text, b.days[0].text);
  assert.equal(m.ai.day2, true);
  assert.deepEqual(mergeAiChallenge(b, null).ch.days, b.days, "AI가 없으면 DB 그대로");
});

test("report.challenge = 쏘웰라가 읽는 모양(day1~month: title·description)", () => {
  const rc = toReportChallenge(base());
  for (const k of ["day1", "day2", "day3", "week", "month"]) {
    assert.ok(typeof rc[k].title === "string" && rc[k].title.length > 0, k);
    assert.ok(typeof rc[k].description === "string" && rc[k].description.length > 0, k);
  }
  assert.equal(rc.source, "tarot");
  const json = JSON.stringify(rc);
  assert.ok(!/@/.test(json), "이메일 없음");
});

test("저장된 AI 칸은 다시 열 때 같은 문장으로(applyStored)", () => {
  const m = mergeAiChallenge(base(), good);
  const again = applyStored(base(), toReportChallenge(m.ch, m.ai));
  assert.deepEqual(again.days.map((d) => d.title ?? null), m.ch.days.map((d) => d.title ?? null));
  assert.equal(applyStored(base(), null).days[0].text, base().days[0].text);
});

test("10쪽 대화: 사용자 고민 한 줄 → 쏘웰라가 챌린지를 물음 → 사용자 답(owner 문구 3개 중 1개, 결과마다 고정)", () => {
  const ch = base();
  const worry = "회사를 그만두고 싶은데 연봉이 걸려서 계속 망설여져요. 어떻게 해야 할까요?\n둘째 줄";
  const c1 = sowellaChat({ name: "도현", worryText: worry, ch, ui, seed: "abc" });
  assert.deepEqual(c1.map((m) => m.from), ["user", "sowella", "user"]);
  assert.ok(c1[0].text.endsWith("…") && c1[0].text.length <= 29, "고민은 한 줄로 짧게");
  assert.ok(c1[1].text.includes("도현님") && c1[1].text.includes(ch.days[1].title!));
  assert.ok((ui.user_replies as string[]).includes(c1[2].text));
  assert.deepEqual(sowellaChat({ name: "도현", worryText: worry, ch, ui, seed: "abc" }), c1, "같은 결과는 같은 답");
  const none = sowellaChat({ name: "", worryText: "", ch, ui, seed: "x" });
  assert.ok(none[0].text.length > 0, "고민을 안 썼으면 영역 예시 질문");
});

test("E2 입력 db_challenge에는 활동과 다섯 칸 기본 문장", () => {
  const i = dbChallengeInput(base()) as Record<string, unknown>;
  for (const k of ["activity", "day1", "day2", "day3", "week", "month"]) assert.ok(k in i, k);
});
