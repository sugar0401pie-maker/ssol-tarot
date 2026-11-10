// v2.3.11 점수표 규칙 효과 — 글자 조각 검색(5겹 교차)만으로 비교. AI(A2) 없이 잰 하한선.
//   A: 비슷한 예시 투표로 점수표  ·  B: 세부 1위 → 세부 점수표 규칙(고르기면 투표가 허용 안일 때만 그대로)
import fs from "fs"; import path from "path"; import { fileURLToPath } from "url";
import { buildIndex, voteTable, subCandidates } from "../03_코드/retrieve.js";
import { buildNormalizer } from "../03_코드/normalize.js";
const here = path.dirname(fileURLToPath(import.meta.url));
const gold = fs.readFileSync(path.join(here, "data/frame_gold_v2.7.jsonl"), "utf8").trim().split("\n").map(JSON.parse);
const SUB = JSON.parse(fs.readFileSync(path.join(here, "../02_데이터/worry_subtopics.json"), "utf8")).subs;
const norm = buildNormalizer(JSON.parse(fs.readFileSync(path.join(here, "../02_데이터/norm_dict.json"), "utf8")));
const ruleTable = (sub, vote) => { const r = SUB[sub] && SUB[sub].table_rule; if (!r) return vote; if (r.mode === "fixed") return r.default; if (r.mode === "none") return null; return r.allowed.includes(vote) ? vote : r.default; };
const real = (g) => g.id.startsWith("R-") || g.id.startsWith("R2-");
const res = { all: { n: 0, A: 0, B: 0, sub1: 0, Bsub: 0, nsub: 0 }, real: { n: 0, A: 0, B: 0, sub1: 0, Bsub: 0, nsub: 0 } };
const K = 5;
for (let f = 0; f < K; f++) {
  const train = gold.filter((_, i) => i % K !== f), test = gold.filter((_, i) => i % K === f);
  const idx = buildIndex(train, { normalize: norm });
  for (const g of test) {
    const want = (g.tables || [null])[0], nb = idx.nearest(g.text, 20);
    const vote = voteTable(nb).table ?? null, s1 = subCandidates(nb, 8)[0] || null, rb = ruleTable(s1, vote);
    for (const k of real(g) ? ["all", "real"] : ["all"]) {
      const o = res[k]; o.n++; if (vote === want) o.A++; if (rb === want) o.B++;
      if (g.sub_id) { o.nsub++; if (s1 === g.sub_id) { o.sub1++; if (ruleTable(g.sub_id, vote) === want) o.Bsub++; } }
    }
  }
}
const p = (a, b) => (b ? (100 * a / b).toFixed(1) + "%" : "-");
const rows = {};
for (const [k, o] of Object.entries(res)) rows[k === "all" ? `정답 예시 전체(${o.n})` : `실제 고민만(${o.n})`] = { "A 투표 점수표": p(o.A, o.n), "B 세부→규칙 점수표": p(o.B, o.n), "세부 1위 맞음": p(o.sub1, o.nsub), "세부가 맞을 때 B 점수표": p(o.Bsub, o.sub1) };
console.table(rows);
