// v4.0 (새로) 예시 입력 폴더(fixtures/<이름>/)로 v4 전체 흐름을 재현 — test_tarot.mjs와 demo_pipeline.mjs가 함께 씀
//   case.json(원문·분류·뽑은 카드) + A2_out.json(고민 틀) + C_out.json + D_out.json + E_out.json → { picks, frame, lean, C, E, unpaid, paid, safety }
import fs from "node:fs";
import path from "node:path";
import { createShuffle, picksFromSlots } from "../deck.js";
import { screenText, mergeSafety } from "../safety.js";
import { buildPages, parseStoryApply } from "../assembleReport.js";
import { lean as leanOf, pickTable } from "../decision.js";
import { parseFrame, parseC, parseE } from "../validateV4.js";
import { buildPagesV4 } from "../pagesV4.js";

const readJ = (f) => (fs.existsSync(f) ? (t => JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1)))(fs.readFileSync(f, "utf8")) : null);

export function runCase(dir, data, tables) {
  const cs = readJ(path.join(dir, "case.json"));
  const safety = mergeSafety(screenText(cs.worry || "", data.safety_keywords), cs.ai);
  const sh = createShuffle(data);
  cs.picks.forEach((p) => (sh.reversed[p.id] = p.reversed));
  const picks = picksFromSlots(sh, cs.picks.map((p) => sh.order.indexOf(p.id)), data);
  const { frame, errors: frameErr } = parseFrame(readJ(path.join(dir, "A2_out.json")));
  const table = frame ? pickTable({ frame, cls: cs.ai, tables }) : null;
  const decision = !!(frame && frame.worry_type === "decision" && table);
  const lean = decision ? leanOf({ picks, type: table, tables, name: cs.name, frame }) : null;
  const C = parseC(readJ(path.join(dir, "C_out.json")), { decision, strength: lean && lean.strength, frame, lean, violence: safety.violence });
  const sa = parseStoryApply(readJ(path.join(dir, "D_out.json")) || {}, { violence: safety.violence });
  const Eraw = readJ(path.join(dir, "E_out.json"));
  const E = Eraw ? parseE(Eraw, { lean, frame, violence: safety.violence }) : { E: null, errors: ["E 없음"] };
  const args = { name: cs.name, cls: cs.ai, picks, data, links: C.links, safety, story: sa.story, apply: sa.apply, key: sa.key, storyHead: sa.storyHead, applyHead: sa.applyHead, worryText: cs.worry };
  const v4 = (paid) => buildPagesV4({ base: buildPages({ ...args, paid }), frame, lean, C, E: E.E, name: cs.name, paid, data });
  return { cs, picks, safety, frame, frameErr, table, lean, C, sa, E, unpaid: v4(false), paid: v4(true) };
}
