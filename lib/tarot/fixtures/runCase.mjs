// v4.0 (새로) 예시 입력 폴더(fixtures/<이름>/)로 v4 전체 흐름을 재현 — test_tarot.mjs와 demo_pipeline.mjs가 함께 씀
// v4.1: A2_out.json은 옛 형식(option_axis)·새 형식(v4.6 options_ranked·mode) 모두 받음. opts.index(retrieve.buildIndex)를 주면
//   few-shot 입력(A2 사용자 입력)과 두 번째 의견(강도 낮춤·review_log)까지 재현. safety(watch)는 마지막 쪽 작은 글씨로.
//   case.json(원문·분류·뽑은 카드) + A2_out.json(고민 틀) + C_out.json + D_out.json + E_out.json → { picks, frame, lean, C, E, unpaid, paid, safety }
import fs from "node:fs";
import path from "node:path";
import { createShuffle, picksFromSlots } from "../deck.js";
import { screenText, mergeSafety } from "../safety.js";
import { buildPages, parseStoryApply } from "../assembleReport.js";
import { lean as leanOf, pickTable, isDecisionFrame } from "../decision.js";
import { prepareFrameCall, afterFrame } from "../frameInput.js";
import { parseFrame, parseC, parseE, mergeE, overlapWarnings, actionsOf } from "../validateV4.js";
import { todayFromDb } from "../pagesV4.js";
import { buildPagesV4 } from "../pagesV4.js";

const readJ = (f) => (fs.existsSync(f) ? (t => JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1)))(fs.readFileSync(f, "utf8")) : null);

export function runCase(dir, data, tables, { index = null, a2File = "A2_out.json" } = {}) {
  const cs = readJ(path.join(dir, "case.json"));
  const safety = mergeSafety(screenText(cs.worry || "", data.safety_keywords), cs.ai);
  const sh = createShuffle(data);
  cs.picks.forEach((p) => (sh.reversed[p.id] = p.reversed));
  const picks = picksFromSlots(sh, cs.picks.map((p) => sh.order.indexOf(p.id)), data);
  const prep = index && cs.worry ? prepareFrameCall({ worryText: cs.worry, index, excludeId: cs.id || null }) : null; // A2 사용자 입력(예시 5개)
  const { frame, errors: frameErr } = parseFrame(readJ(path.join(dir, a2File)));
  const table = frame ? pickTable({ frame, cls: cs.ai, tables, safety }) : null;
  const decision = !!(table && isDecisionFrame(frame));
  let lean = decision ? leanOf({ picks, type: table, tables, name: cs.name, frame }) : null;
  let review_log = null, second_opinion = null;
  if (prep) ({ lean, review_log, second_opinion } = afterFrame({ frame, lean, vote: prep.vote, worryId: cs.key, tables }));
  const cPath = fs.existsSync(path.join(dir, "C_out_v42.json")) ? "C_out_v42.json" : "C_out.json"; // v4.2: C는 카드별 이유를 쓰지 않음
  const C = parseC(readJ(path.join(dir, cPath)), { decision, strength: lean && lean.strength, frame, lean, violence: safety.violence });
  const sa = parseStoryApply(readJ(path.join(dir, "D_out.json")) || {}, { violence: safety.violence });
  // v4.2: E1_out.json(7쪽) + E2_out.json(8·9쪽)가 있으면 둘로, 없으면 옛 E_out.json 한 번 호출
  const eo = { lean, frame, violence: safety.violence, worryText: cs.worry || "" };
  let E;
  if (fs.existsSync(path.join(dir, "E1_out.json"))) {
    const e1 = parseE(readJ(path.join(dir, "E1_out.json")), { ...eo, part: "E1" }), e2 = parseE(readJ(path.join(dir, "E2_out.json")), { ...eo, part: "E2" });
    E = { E: e1.E || e2.E ? mergeE(e1.E, e2.E) : null, errors: [...e1.errors.map((x) => `E1 ${x}`), ...e2.errors.map((x) => `E2 ${x}`)], warnings: [...e1.warnings, ...e2.warnings] };
  } else {
    const Eraw = readJ(path.join(dir, "E_out.json"));
    E = Eraw ? parseE(Eraw, eo) : { E: null, errors: ["E 없음"], warnings: [] };
  }
  const keyCard = { no: picks[2].card.no, reversed: !!picks[2].reversed };
  E.overlaps = overlapWarnings(actionsOf(E.E, todayFromDb(data, keyCard, lean))); // ① 행동 겹침 경고
  const args = { name: cs.name, cls: cs.ai, picks, data, links: C.links, safety, story: sa.story, apply: sa.apply, key: sa.key, storyHead: sa.storyHead, applyHead: sa.applyHead, worryText: cs.worry };
  const v4 = (paid) => buildPagesV4({ base: buildPages({ ...args, paid }), frame, lean, C, E: E.E, name: cs.name, paid, data, safety });
  return { cs, picks, safety, frame, frameErr, table, lean, C, sa, E, prep, review_log, second_opinion, unpaid: v4(false), paid: v4(true) };
}
