// v2.3.9 판별 DB 의미 검색 색인 만들기 — 판별 DB(frame_gold)를 바꿀 때마다 다시 돌린다(비용 약 40원).
//   OPENAI_API_KEY=… node scripts/build_embed_index.mjs
// 결과: judge-db/data/frame_gold_v2.8.emb.f16.bin(1,024차원 16비트 실수, 줄 순서대로) + .emb.meta.json(모델·차원·줄 id 목록)
// 서버(lib/server/embedSearch.ts)는 meta의 id 목록이 판별 DB와 다르면 색인을 쓰지 않고 글자 검색만 쓴다.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildNormalizer } from "../lib/tarot/normalize.js";
import { toF16, unit } from "../lib/tarot-glue/embedSearch.ts";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const GOLD = "judge-db/data/frame_gold_v2.8.jsonl";
const MODEL = process.env.TAROT_EMBED_MODEL || "text-embedding-3-large";
const DIM = Number(process.env.TAROT_EMBED_DIM || 1024);
const rows = fs.readFileSync(path.join(ROOT, GOLD), "utf8").trim().split("\n").map(JSON.parse);
const norm = buildNormalizer(JSON.parse(fs.readFileSync(path.join(ROOT, "data/norm_dict.json"), "utf8")));
const texts = rows.map((r) => norm(r.text));
const vecs = [];
for (let i = 0; i < texts.length; i += 256) {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: MODEL, input: texts.slice(i, i + 256), dimensions: DIM }),
  });
  if (!res.ok) throw new Error(`embeddings ${res.status}`);
  for (const d of (await res.json()).data) vecs.push(unit(d.embedding));
}
const out = new Uint16Array(vecs.length * DIM);
vecs.forEach((v, r) => v.forEach((x, j) => (out[r * DIM + j] = toF16(x))));
const base = path.join(ROOT, GOLD.replace(/\.jsonl$/, ""));
fs.writeFileSync(`${base}.emb.f16.bin`, Buffer.from(out.buffer));
fs.writeFileSync(`${base}.emb.meta.json`, JSON.stringify({ model: MODEL, dim: DIM, gold: GOLD, normalized: true, built: new Date().toISOString().slice(0, 10), ids: rows.map((r) => r.id) }));
console.log(`${vecs.length}줄 · ${MODEL} ${DIM}차원 · ${(out.byteLength / 1e6).toFixed(1)}MB`);
