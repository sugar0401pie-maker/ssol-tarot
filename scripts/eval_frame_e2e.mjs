// 4-(b) 끝까지 측정(2026-11-09): 실제 고민(판별 DB의 R-·R2- 익명판) 중 연애 50·직장 50건을 고민 틀 AI(A2)까지 실제로 돌려
// 세부 고민(sub_id)·점수표·영역을 정답과 비교한다. 같은 100건을 '의미 검색 + 글자 검색(지금)'과 '글자 검색만(예전)'으로 각각 돌린다(AI 200회).
//   실행: node --conditions=react-server --experimental-strip-types scripts/eval_frame_e2e.mjs [건수/영역=50]
//   필요: OPENAI_API_KEY, scripts/.cache/gold_v2.7_text-embedding-3-large_1024.json(eval_embed_retrieval.mjs가 만듦)
//   공정하게 하려고 시험 100건은 두 색인 모두에서 뺀다. 질문 임베딩은 캐시된 자기 벡터(서버와 같은 정리·모델)를 쓴다.
//   결과 전체(고민 글 포함)는 scripts/.cache/에만 남기고, 커밋하는 요약에는 id와 맞음/틀림만 적는다.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildIndex, voteTable, subCandidates } from "../lib/tarot/retrieve.js";
import { buildNormalizer } from "../lib/tarot/normalize.js";
import { buildFrameUserBlock, FEWSHOT_K } from "../lib/tarot/frameInput.js";
import { parseFrameV43, subPromptBlock } from "../lib/tarot/v43.js";
import { FRAME_SYSTEM } from "../lib/server/prompts.ts";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const PER = Number(process.argv[2] || 50);
const MODEL = process.env.TAROT_AI_MODEL || "gpt-5.6-luna";
const rows = fs.readFileSync(path.join(ROOT, "judge-db/data/frame_gold_v2.7.jsonl"), "utf8").trim().split("\n").map(JSON.parse);
const subDb = JSON.parse(fs.readFileSync(path.join(ROOT, "data/worry_subtopics.json"), "utf8"));
const norm = buildNormalizer(JSON.parse(fs.readFileSync(path.join(ROOT, "data/norm_dict.json"), "utf8")));
const V = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts/.cache/gold_v2.7_text-embedding-3-large_1024.json"), "utf8"));
const tableOf = (r) => (r.tables ?? [r.table ?? null])[0] ?? null;

// 고정 씨앗으로 고르기(다시 돌려도 같은 100건)
let seed = 20261109;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (pred, n) => rows.map((r, i) => [r, i]).filter(([r]) => /^R2?-/.test(r.id) && r.sub_id && pred(r)).map((x) => [rnd(), x]).sort((a, b) => a[0] - b[0]).slice(0, n).map((x) => x[1]);
const love = pick((r) => r.area === "LOV", PER);
const work = pick((r) => r.area === "CAR" || r.area === "JOB", PER);
const test = [...love.map((x) => [...x, "연애"]), ...work.map((x) => [...x, "직장"])];
const testIds = new Set(test.map(([r]) => r.id));
const keep = rows.map((_, i) => i).filter((i) => !testIds.has(rows[i].id));
const charIdx = buildIndex(keep.map((i) => rows[i]), { normalize: norm });
const dot = (a, b) => { let s = 0; for (let j = 0; j < a.length; j++) s += a[j] * b[j]; return s; };
const nb = (i, score) => { const r = rows[i]; return { id: r.id, score, text: r.text, table: tableOf(r), tables: r.tables, mode: r.mode ?? null, ranked: r.ranked ?? [], sub_id: r.sub_id ?? null, sub2: r.sub2 ?? null, area: r.area ?? null, want: r.want ?? null, love_status: r.love_status ?? null, love_topic: r.love_topic ?? null }; };

function neighbors(mode, q, qi) {
  if (mode === "char") return charIdx.nearest(q.text, 20);
  const cs = new Map(charIdx.nearest(q.text, 50).map((x) => [x.id, x.score]));
  return keep.map((i) => nb(i, 0.7 * dot(V[qi], V[i]) + 0.3 * (cs.get(rows[i].id) || 0))).sort((a, b) => b.score - a.score).slice(0, 20);
}

async function a2(user) {
  for (let t = 0; t < 2; t++) {
    try {
      const res = await fetch("https://api.openai.com/v1/responses", {
        method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({ model: MODEL, input: [{ role: "system", content: FRAME_SYSTEM }, { role: "user", content: user }], max_output_tokens: 800, store: false }),
        signal: AbortSignal.timeout(30000),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(`responses ${res.status} ${j?.error?.code ?? ""}`);
      const text = (j.output ?? []).flatMap((o) => o.content ?? []).filter((c) => c.type === "output_text").map((c) => c.text).join("");
      const p = parseFrameV43(text);
      if (p.frame) return { frame: p.frame, usage: j.usage };
    } catch (e) { if (t === 1) return { frame: null, err: String(e.message) }; }
  }
  return { frame: null, err: "parse" };
}

const out = [];
const jobs = [];
for (const mode of ["hybrid", "char"]) for (const [q, qi, grp] of test) jobs.push({ mode, q, qi, grp });
let k = 0, inTok = 0, outTok = 0;
async function worker() {
  while (k < jobs.length) {
    const { mode, q, qi, grp } = jobs[k++];
    const all = neighbors(mode, q, qi);
    const cands = subCandidates(all, 8);
    const user = `${subPromptBlock(cands, subDb)}\n\n${buildFrameUserBlock({ worryText: q.text, examples: all.slice(0, FEWSHOT_K) })}`;
    const r = await a2(user);
    inTok += r.usage?.input_tokens ?? 0; outTok += r.usage?.output_tokens ?? 0;
    const f = r.frame ?? {};
    out.push({ mode, grp, id: q.id, gold: { sub_id: q.sub_id, sub2: q.sub2 ?? null, table: q.tables ?? [tableOf(q)], area: q.area }, pred: { sub_id: f.sub_id ?? null, table: f.table ?? null, area: f.area ?? null }, candHit: cands.includes(q.sub_id), vote: voteTable(all.slice(0, FEWSHOT_K))?.table ?? null, err: r.err ?? null });
    if (out.length % 20 === 0) console.error(`${out.length}/${jobs.length}`);
  }
}
await Promise.all(Array.from({ length: 6 }, worker));

const pct = (a, b) => (b ? `${((a / b) * 100).toFixed(0)}% (${a}/${b})` : "-");
const summary = {};
for (const mode of ["hybrid", "char"]) for (const grp of ["연애", "직장", "전체"]) {
  const xs = out.filter((o) => o.mode === mode && (grp === "전체" || o.grp === grp));
  summary[`${mode === "hybrid" ? "의미+글자(지금)" : "글자만(예전)"} · ${grp}`] = {
    "세부 고민 정답": pct(xs.filter((o) => o.pred.sub_id === o.gold.sub_id).length, xs.length),
    "세부 고민 정답(2순위 정답 포함)": pct(xs.filter((o) => o.pred.sub_id && [o.gold.sub_id, o.gold.sub2].includes(o.pred.sub_id)).length, xs.length),
    "정답이 후보 8개 안": pct(xs.filter((o) => o.candHit).length, xs.length),
    "점수표 정답": pct(xs.filter((o) => o.gold.table.includes(o.pred.table)).length, xs.length),
    "영역 정답": pct(xs.filter((o) => o.pred.area === o.gold.area).length, xs.length),
    "AI 실패": xs.filter((o) => o.err).length,
  };
}
console.log(`모델 ${MODEL} · 연애 ${love.length} + 직장 ${work.length} · 토큰 입력 ${inTok} / 출력 ${outTok}`);
console.table(summary);
fs.mkdirSync(path.join(ROOT, "scripts/.cache"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "scripts/.cache/frame_e2e_detail.json"), JSON.stringify(out, null, 1));
fs.writeFileSync(path.join(ROOT, `judge-db/eval/frame_e2e_${new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10)}.json`), JSON.stringify({ model: MODEL, n: test.length, tokens: { input: inTok, output: outTok }, summary, rows: out.map(({ mode, grp, id, gold, pred, candHit, err }) => ({ mode, grp, id, gold, pred, candHit, err })) }, null, 1));
