// v2.3.14 — 글자 조각 검색만으로(AI 없이) 세부 1위 · 결과 틀 · 후보 8개 안 · 후보 틀 안. 5겹 교차.
import fs from "fs"; import path from "path"; import { fileURLToPath } from "url";
import { buildIndex, subCandidates } from "../03_코드/retrieve.js";
import { buildNormalizer } from "../03_코드/normalize.js";
const here = path.dirname(fileURLToPath(import.meta.url));
const gold = fs.readFileSync(path.join(here, "data/frame_gold_v2.9.jsonl"), "utf8").trim().split("\n").map(JSON.parse).filter((g) => g.sub_id);
const DB = JSON.parse(fs.readFileSync(path.join(here, "../02_데이터/worry_subtopics.json"), "utf8")), S = DB.subs;
const norm = buildNormalizer(JSON.parse(fs.readFileSync(path.join(here, "../02_데이터/norm_dict.json"), "utf8")));
const real = (g) => /^R\d?-/.test(g.id);
const res = {}; const add = (k, f) => { const o = (res[k] ||= { n: 0, sub1: 0, frame1: 0, cand8: 0, candFrame: 0, frames: 0 }); o.n++; for (const [a, b] of Object.entries(f)) o[a] += b; };
const K = 5;
for (let f = 0; f < K; f++) {
  const idx = buildIndex(gold.filter((_, i) => i % K !== f), { normalize: norm });
  for (const g of gold.filter((_, i) => i % K === f)) {
    const c = subCandidates(idx.nearest(g.text, 20), 8), fr = [...new Set(c.map((k) => S[k].frame))], gf = S[g.sub_id].frame;
    const r = { sub1: +(c[0] === g.sub_id), frame1: +(c[0] && S[c[0]].frame === gf), cand8: +c.includes(g.sub_id), candFrame: +fr.includes(gf), frames: fr.length };
    add("정답 예시 전체", r); if (real(g)) add("실제 고민만", r);
  }
}
const p = (a, b) => (100 * a / b).toFixed(1) + "%";
console.table(Object.fromEntries(Object.entries(res).map(([k, o]) => [`${k}(${o.n})`, { "세부 1위": p(o.sub1, o.n), "결과 틀 1위": p(o.frame1, o.n), "정답 세부가 후보 8개 안": p(o.cand8, o.n), "정답 틀이 후보 틀 안": p(o.candFrame, o.n), "후보 틀 수(평균)": (o.frames / o.n).toFixed(1) }])));
