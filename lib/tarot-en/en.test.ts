// 영문판 결과 파이프라인 검사(2026-11-06): 영문 세션은 영어 패키지(lib/tarot-en)를 쓰고, 화면으로 가는 글에 한국어가 섞이지 않는다.
//   남아도 되는 한국어 = 화면이 해석하는 내부 표시뿐(쪽 접근 표시 무료/유료, [카드 이미지 3장], [[읽기 지도: …(역방향)]]).
import { test } from "node:test";
import assert from "node:assert/strict";
import { decide, buildUnpaidPages, buildPaidPages, sanitizeUnpaid, sanitizePaid, buildCUserBlock, buildDUserBlock, buildE1UserBlock, buildE2UserBlock } from "../tarot-glue/v4.ts";
import { bundleFor } from "../i18n/bundle.ts";
import { picksFromSlots, createShuffle } from "../tarot/deck.js";
import { parseC, parseE, parseFrame, fixInventedDays, ruleHitsV4, v10Hits } from "./validateV4.js";
import { pkg } from "../tarot-glue/pkg.ts";

const { data } = bundleFor("en");
const sh = createShuffle(data);
const want = [{ id: data.cards[10].id, r: true }, { id: data.cards[1].id, r: false }, { id: data.cards[13].id, r: false }];
want.forEach((p) => (sh.reversed[p.id] = p.r));
const picks = picksFromSlots(sh, want.map((p) => sh.order.indexOf(p.id)), data);
const cls = { domain: "CAR", emotions: ["ANX", "CON"], need: "REST", self_focus: false, crisis_level: "none", violence: false, off_topic: false, confidence: 0.9, qtype: "choice" };
const frame = { table: "job", decision_source: "explicit", mode: "axis", rank_reason: null, worry_type: "decision", options_ranked: ["Take the new offer", "Stay at my company"], core_question: "Should I take the new job offer?", hidden_question: null, deadline: "by the end of next month", duration: null, money: false, user_words: ["offer"], confidence: "high" };
const safety = { level: "none", violence: false, fear: false } as const;
const MARKERS = /^(무료|유료|일부 무료)$|\[카드 이미지 3장\]|\[\[읽기 지도:|\(역방향\)/;

function visibleHangul(v: unknown, out: string[] = []): string[] {
  if (typeof v === "string") v.split("\n").forEach((line) => { const t = line.replace(/\[\[읽기 지도:[^\]]*\]\]/g, "").replace(/\[카드 이미지 3장\]/g, ""); if (/[가-힣]/.test(t) && !MARKERS.test(t.trim())) out.push(t); });
  else if (Array.isArray(v)) v.forEach((x) => visibleHangul(x, out));
  else if (v && typeof v === "object") Object.values(v).forEach((x) => visibleHangul(x, out));
  return out;
}

test("영문 세션은 영어 패키지 모듈을 고른다", () => {
  assert.notEqual(pkg("en").validate.parseC, pkg("ko").validate.parseC);
  assert.equal(pkg(undefined).validate.parseC, pkg("ko").validate.parseC);
});

for (const f of [frame, null]) {
  test(`영문 결과 쪽·AI 입력에 한국어 글이 없다(${f ? "결정형" : "비결정형"})`, () => {
    const d = decide({ frame: f, cls, picks, name: "Jamie", locale: "en" });
    if (f) assert.ok(d.lean && /^(Take the new offer|Stay at my company)$/.test(d.lean.option));
    const U = sanitizeUnpaid(buildUnpaidPages({ name: "Jamie", cls, picks, safety, worryText: "Should I take the new job offer?", frame: f, lean: d.lean, C: null, locale: "en" }), "en");
    const P = sanitizePaid(buildPaidPages({ name: "Jamie", cls, picks, safety, worryText: "Should I take the new job offer?", frame: f, lean: d.lean, C: null, sa: null, E: null, locale: "en" }), { locale: "en" });
    assert.deepEqual(visibleHangul(U), []);
    assert.deepEqual(visibleHangul(P), []);
    const blocks = [buildCUserBlock, buildE1UserBlock, buildE2UserBlock].map((fn) => fn({ name: "Jamie", worryText: "x", cls, picks, frame: f, lean: d.lean, locale: "en" }));
    blocks.push(buildDUserBlock({ name: "Jamie", worryText: "x", cls, picks, frame: f, lean: d.lean, safety, locale: "en" }));
    assert.deepEqual(visibleHangul(blocks), []);
    // 결제 전에는 세 번째 카드 이름이 응답에 없다(한국어판과 같은 규칙)
    assert.ok(!JSON.stringify(U).includes(String(picks[2].card.name)));
  });
}

test("영문 검증기: 문장 틀·금지어·한국어 섞임", () => {
  assert.deepEqual(parseFrame(frame).errors, []);
  assert.ok(parseFrame({ ...frame, core_question: "Should I take it" }).errors.length > 0);
  assert.ok(ruleHitsV4("The decision is yours.").length > 0);
  assert.ok(ruleHitsV4("이건 한국어예요").some((x) => x.startsWith("한국어")));
  assert.deepEqual(ruleHitsV4("Write down what you'd miss at your company."), []);
  assert.ok(v10Hits("Notice something about it.").length > 0);
  assert.deepEqual(v10Hits("Write down something: the commute."), []);
  assert.deepEqual(fixInventedDays("Ask them on Monday.", { worryText: "" }).text, "Ask them one day this week.");
  assert.deepEqual(fixInventedDays("Ask them on Friday.", { worryText: "the deadline is Friday" }).hits, []);
});

test("영문 E1: head 틀과 hedge 금지", () => {
  const d = decide({ frame, cls, picks, name: "Jamie", locale: "en" });
  const opt = d.lean!.option;
  const body = `The Road So Far shows how long you've weighed the ${"offer"} and why it keeps coming back. The Current Now shows the pressure you feel at work each week. The Key Ahead is the strongest reason and it points the same way. That said, the doubts are real, so name them before you answer by the end of next month.`;
  const E1 = { direction: { head: `The three cards point to ‘${opt}’.`, lean: opt, body, flow: { head: `Going with ‘${opt}’ settles the question you keep circling.`, body: "Within the next 1–2 months the pressure around the offer drops. In 3–4 months the new routine at the new place feels like yours." }, if_then: ["If the pay holds, the side becomes even clearer.", "If the team changes, it's time to rethink the side."], decide_by: "Which matters more to you by the end of next month?", plan: { when: "this week", where: "at home", how: "Write down the three things you'd miss most about your company and the offer." } } };
  const ok = parseE(E1, { lean: d.lean, frame, part: "E1" });
  assert.deepEqual(ok.errors, []);
  const bad = parseE({ direction: { ...E1.direction, head: `It might be ‘${opt}’.` } }, { lean: d.lean, frame, part: "E1" });
  assert.ok(bad.errors.some((x) => x.includes("direction.head")));
  assert.ok(bad.errors.some((x) => x.startsWith("R4")));
});

test("영문 C: 결정형 teaser는 결론을 드러내지 않는다", () => {
  const d = decide({ frame, cls, picks, name: "Jamie", locale: "en" });
  const r = parseC({ teaser_headline: "Take the new offer, the three cards answered", teaser_lead: "Jamie, you've held onto that question for a long time, and the three cards gave a clearer answer than you might expect." }, { decision: true, strength: d.lean!.strength, frame, lean: d.lean });
  assert.ok(r.errors.some((x) => x.includes("결론")));
});
