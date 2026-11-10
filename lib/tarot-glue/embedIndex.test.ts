import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { EMBED_MODEL_DEFAULT, EMBED_DIM_DEFAULT } from "./embedSearch.ts";

// 판별 DB(frame_gold_v2.7.jsonl)를 고치고 의미 검색 색인을 다시 만들지 않으면, 서버는 조용히 글자 검색만 쓴다.
// 그걸 배포 전에 드러내려는 테스트 — 실패하면 `node scripts/build_embed_index.mjs`로 색인을 다시 만든다(약 40원).
const GOLD = "judge-db/data/frame_gold_v2.7.jsonl";
const META = "judge-db/data/frame_gold_v2.7.emb.meta.json";
const BIN = "judge-db/data/frame_gold_v2.7.emb.f16.bin";

test("의미 검색 색인이 지금 판별 DB·모델·차원과 맞는다", () => {
  const ids = fs.readFileSync(GOLD, "utf8").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l).id);
  const meta = JSON.parse(fs.readFileSync(META, "utf8"));
  assert.equal(meta.model, EMBED_MODEL_DEFAULT, "색인 모델이 서버 기본 모델과 다름");
  assert.equal(meta.dim, EMBED_DIM_DEFAULT, "색인 차원이 서버 기본 차원과 다름");
  assert.equal(meta.ids.length, ids.length, "판별 DB 줄 수가 바뀜 — 색인을 다시 만드세요");
  const firstDiff = ids.findIndex((id: string, i: number) => id !== meta.ids[i]);
  assert.equal(firstDiff, -1, `판별 DB ${firstDiff + 1}번째 줄 id가 색인과 다름 — 색인을 다시 만드세요`);
  assert.equal(fs.statSync(BIN).size, ids.length * meta.dim * 2, "색인 파일 크기가 줄 수 × 차원과 맞지 않음");
});
