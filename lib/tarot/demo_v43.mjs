// v4.3 예시 2건(실제 고민 R-118·R-202) — 결제 전 1~4쪽 + 결제 후 4·7쪽 맨 위. A2·A 출력은 v4.7 기준으로 손으로 쓴 예시(가상 카드)
// 실행: node demo_v43.mjs → 01_설계/example-reports/v43-예시1.md, v43-예시2.md
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildPages } from "./assembleReport.js";
import { lean as leanOf } from "./decision.js";
import { parseFrame } from "./validateV4.js";
import { normalizeFrameV43, applyForecastOptions, buildPagesV43, eventFields, variantOf } from "./v43.js";
const here = path.dirname(fileURLToPath(import.meta.url));
const R = (f) => JSON.parse(fs.readFileSync(path.join(here, "../../data", f), "utf8"));
const data = R("tarot_data.json"), tables = R("decision_tables.json"), midDb = R("mid_result_db.json"), answerDb = R("answer_first_db.json");
const byNo = Object.fromEntries(data.cards.map((c) => [c.no, c]));
const POS = data.positions.map((p) => [p.code, p.name]);
const mk = (spec) => spec.map(([no, r], i) => ({ card: byNo[no], reversed: !!r, position: POS[i][0], positionName: POS[i][1] }));
const CASES = [
  { key: "v43-예시1", id: "R-118", name: "하늘", worry: "썸타다가 연락이 끊긴 사람이 있는데 그 사람이 지금 연락하는 여자가 있는지랑 나랑 다시 잘 될 가능성이 있는지 궁금해",
    cls: { domain: "LOV", emotions: ["ANX", "HUR"], need: "CONNECT", qtype: "other_mind", self_focus: false },
    a2: { table: "reunion", decision_source: "implicit", mode: "axis", rank_reason: null, worry_type: "relationship_question", options_ranked: ["다시 연락해 보기 (암시)", "연락하지 않고 정리하기 (암시)"],
      core_question: "그 사람과 다시 잘 될 수 있을까요?", hidden_question: "그 사람 곁에 지금 다른 사람이 있을까요?", deadline: null, duration: null, money: false, user_words: ["썸타다가 연락이 끊긴 사람", "다시 잘 될 가능성"],
      want: "their_mind", love_status: "some", stage: "after_fail", control: "other", area: "LOV", confidence: "high" },
    picks: [[6, 1], [18, 0], [8, 1]] },
  { key: "v43-예시2", id: "R-202", name: "민서", worry: "나이는 점점 먹어가는데 아직 취업을 못했어요. 올해 안으로 취업이 가능할까요?",
    cls: { domain: "DIR", emotions: ["ANX", "CON"], need: "START", qtype: "yesno", self_focus: false },
    a2: { table: "start", decision_source: "implicit", mode: "axis", rank_reason: null, worry_type: "situation", options_ranked: ["다음을 향해 준비 시작하기 (암시)", "잠시 쉬며 때를 기다리기 (암시)"],
      core_question: "올해 안으로 취업할 수 있을까요?", hidden_question: null, deadline: "올해 안으로", duration: null, money: false, user_words: ["나이는 점점 먹어가는데", "올해 안으로 취업"],
      want: "yesno", love_status: null, stage: "before", control: "outside", area: "JOB", confidence: "high" },
    picks: [[0, 1], [12, 0], [17, 0]] },
];
const out = [];
for (const c of CASES) {
  let frame = normalizeFrameV43(parseFrame(c.a2).frame, c.cls);
  frame = applyForecastOptions(frame, tables);
  const picks = mk(c.picks);
  const L = leanOf({ picks, type: frame.table, tables, name: c.name, frame });
  const run = (paid) => buildPagesV43({ base: buildPages({ name: c.name, cls: c.cls, picks, data, paid, worryText: c.worry }), frame, lean: L, C: null, E: null, name: c.name, paid, data, midDb, answerDb, cls: c.cls, picks, now: new Date("2026-11-06T10:00:00+09:00") });
  const U = run(false), Pd = run(true);
  const md = [`> 예시(실제 고민 ${c.id}, 카드는 가상). v4.3 — 고민 틀 want '${frame.want}'${frame.love_status ? `, 연애 단계 '${frame.love_status}'` : ""}, 영역 '${frame.area}' → 점수표 ${L.table}, 선택지 ${frame.forecast ? "예측형(될 흐름/어려운 흐름)" : "기본"} · 방향 ‘${L.option}’(${L.strength}) · 중간 결과 문장 묶음 ${U.v43.mid.key}`, "",
    `**고민:** ${c.worry}`, ""];
  for (const p of U.slice(0, 4)) {
    md.push(`## ${p.page}쪽 · ${p.title} (${p.locked ? "결제 전 — 카드 뒷면" : "무료"})`, "");
    if (p.intro) md.push(`[맨 위 안내] ${p.intro}`, "");
    if (p.card && !p.card.face_down) md.push(`[카드] ${p.card.position} · ${p.card.name}${p.card.reversed ? " (역방향)" : ""}`, "");
    if (p.cards) md.push(`[카드] ${p.cards.map((x) => (x.face_down ? `${x.position} — 뒷면` : `${x.name}${x.reversed ? "(역)" : ""}`)).join(" · ")}`, "");
    if (p.heading) md.push(`### ${p.heading}`, "");
    if (p.says) md.push("카드는 이렇게 말해요", "", ...p.says, "");
    if (p.question) md.push(`### ${p.question}`, "");
    if (p.body) md.push(p.body, "");
    if (p.locked) md.push(`[예고] ${p.teaser}`, `[작은 글씨] ${p.note}`, "[결제 카드]", "");
    md.push(`[버튼] ${p.next || ""}`, "", "---", "");
  }
  md.push(`## 결제 후 4쪽 — 카드가 뒤집힘: ${Pd[3].card.name}${Pd[3].card.reversed ? " (역방향)" : ""}`, "", `## 결제 후 7쪽 맨 위 (답 먼저 · ${Pd.v43.answer_first ? Pd.v43.answer_first.kind : "없음"})`, "", Pd[6].body.split("\n").slice(0, 8).join("\n"), "", "---", "",
    "결제 분석 기록(eventFields):", "```json", JSON.stringify(eventFields({ id: c.id, worryText: c.worry, frame, cls: c.cls, lean: L, pages: Pd, paid: true, variant: variantOf(c.id) })), "```");
  fs.writeFileSync(path.join(here, "../01_설계/example-reports", `${c.key}.md`), md.join("\n"));
  out.push(c.key);
}
console.log("생성:", out.join(", "));
