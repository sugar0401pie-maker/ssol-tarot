// v2.3.9 임베딩 검색 요청서 5번 — 글자 검색 / 임베딩 / 하이브리드(0.7·0.3)를 같은 5겹 교차 검증으로 잰다.
//   대상: 판별 DB v2.7의 실제 고민(R-·R2-). 겹마다 그 겹의 실제 고민은 색인에서 빼고 질문으로만 쓴다.
//   지표: 점수표 1위(이웃 5개 투표) · 세부 고민 1위 · 세부 후보 8개 안(이웃 20개 → subCandidates)
//   실행: OPENAI_API_KEY=… node scripts/eval_embed_retrieval.mjs [모델=text-embedding-3-small]
//   색인 임베딩은 scripts/.cache/에 저장(커밋 안 함). 질문 글은 판별 DB의 익명화 문장뿐 — 고객 원문 아님.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildIndex, voteTable, subCandidates } from "../lib/tarot/retrieve.js";
import { buildNormalizer } from "../lib/tarot/normalize.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const MODEL = process.argv[2] || "text-embedding-3-small";
// DIM=1024 처럼 주면 그 길이로 줄여 받는다(text-embedding-3 모델만 — 저장 용량 줄이기)
const DIM = process.env.DIM ? Number(process.env.DIM) : null;
// SUBN=10 처럼 주면 세부 후보 개수를 바꿔 잰다(기본 8 — 서버 SUB_CANDIDATES와 같게)
const SUBN = Number(process.env.SUBN || 8);
const rows = fs.readFileSync(path.join(ROOT, "judge-db/data/frame_gold_v2.9.jsonl"), "utf8").trim().split("\n").map(JSON.parse);
const norm = buildNormalizer(JSON.parse(fs.readFileSync(path.join(ROOT, "data/norm_dict.json"), "utf8")));
const tableOf = (r) => (r.tables ?? [r.table ?? null])[0] ?? null;

async function embedAll(texts) {
  const out = [];
  for (let i = 0; i < texts.length; i += 256) {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: MODEL, input: texts.slice(i, i + 256), ...(DIM ? { dimensions: DIM } : {}) }),
    });
    if (!res.ok) throw new Error(`embeddings ${res.status}`);
    const j = await res.json();
    for (const d of j.data) out.push(d.embedding);
  }
  return out;
}
const unit = (v) => { const n = Math.hypot(...v) || 1; return v.map((x) => x / n); };
const cacheDir = path.join(ROOT, "scripts/.cache"); fs.mkdirSync(cacheDir, { recursive: true });
const cacheFile = path.join(cacheDir, `gold_v2.7_${MODEL}${DIM ? `_${DIM}` : ""}.json`);
let V;
if (fs.existsSync(cacheFile)) V = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
else { V = (await embedAll(rows.map((r) => norm(r.text)))).map(unit); fs.writeFileSync(cacheFile, JSON.stringify(V)); }

const real = rows.map((r, i) => [r, i]).filter(([r]) => /^R2?-/.test(r.id));
const fold = new Map(real.map(([r], k) => [r.id, k % 5]));
const dot = (a, b) => { let s = 0; for (let j = 0; j < a.length; j++) s += a[j] * b[j]; return s; };
const nb = (i, s) => ({ id: rows[i].id, score: s, text: rows[i].text, table: tableOf(rows[i]), tables: rows[i].tables, sub_id: rows[i].sub_id ?? null, sub2: rows[i].sub2 ?? null });

function run(mode, wEmb = 0.7) {
  let t1 = 0, s1 = 0, s8 = 0, n = 0, nSub = 0;
  for (let f = 0; f < 5; f++) {
    const keep = rows.map((r, i) => i).filter((i) => fold.get(rows[i].id) !== f);
    const charIdx = buildIndex(keep.map((i) => rows[i]), { normalize: norm });
    const pos = new Map(keep.map((i) => [rows[i].id, i]));
    for (const [q, qi] of real) {
      if (fold.get(q.id) !== f) continue;
      let top;
      if (mode === "char") top = charIdx.nearest(q.text, 20);
      else {
        const cs = mode === "hybrid" ? new Map(charIdx.nearest(q.text, 50).map((x) => [x.id, x.score])) : null;
        top = keep.map((i) => nb(i, (mode === "hybrid" ? wEmb : 1) * dot(V[qi], V[i]) + (cs ? (1 - wEmb) * (cs.get(rows[i].id) || 0) : 0)))
          .sort((a, b) => b.score - a.score).slice(0, 20);
      }
      void pos;
      n++;
      if (voteTable(top.slice(0, 5)).table === tableOf(q)) t1++;
      if (q.sub_id) { nSub++; const c = subCandidates(top, SUBN); if (c[0] === q.sub_id) s1++; if (c.includes(q.sub_id)) s8++; }
    }
  }
  const p = (x, d) => `${((x / d) * 100).toFixed(1)}%`;
  return { "점수표 1위": p(t1, n), "세부 고민 1위": p(s1, nSub), [`세부 후보 ${SUBN}개 안`]: p(s8, nSub) };
}
const out = { "글자 검색(지금)": run("char"), [`임베딩(${MODEL}${DIM ? ` ${DIM}` : ""})`]: run("emb") };
for (const w of (process.env.W || "0.5,0.7,0.85").split(",").map(Number)) out[`하이브리드 ${w}/${(1 - w).toFixed(2)}`] = run("hybrid", w);
console.log(`실제 고민 ${real.length}건 · 5겹 교차 검증 · 색인 ${rows.length}줄`);
console.table(out);
