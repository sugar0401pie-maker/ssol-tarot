// v4.3 실제 고민 정답을 판별 DB에 넣는 것이 도움이 되는지 확인(5겹 교차 검증)
//   A: 지금(합성 정답 490건만 색인) / B: 합성 490 + 실제 고민(다른 4/5) / 지표: 비슷한 예시 투표 1순위 = 정답 표, 예시 5개 안에 정답 표가 있는지,
//   두 번째 의견이 강도를 낮춘 경우 실서비스 A2 표가 실제로 틀린 비율(높을수록 두 번째 의견이 쓸모 있음)
// 실행: node run_eval_real.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildIndex, voteTable } from "../03_코드/retrieve.js";
const here = path.dirname(fileURLToPath(import.meta.url));
const J = (f) => fs.readFileSync(path.join(here, f), "utf8").trim().split("\n").map(JSON.parse);
const gold = J("data/frame_gold_v1.jsonl");
const real = J("data/real_worries_2026-11_labels_anon_v1.jsonl").map((r) => ({ id: r.id, text: r.text, tables: [r.table ?? null], label: r.table ?? null, ai: r.ai_table ?? null }));
function run(make) {
  let top1 = 0, hit5 = 0, down = 0, downWrong = 0, keep = 0, keepWrong = 0;
  for (let f = 0; f < 5; f++) {
    const idx = make(f);
    real.forEach((q, k) => {
      if (k % 5 !== f) return;
      const nb = idx.nearest(q.text, 5), v = voteTable(nb);
      if (v.table === q.label) top1++;
      if (nb.some((n) => n.table === q.label)) hit5++;
      const lowered = v.table !== q.ai && v.share >= 0.6, wrong = q.ai !== q.label;
      if (lowered) { down++; if (wrong) downWrong++; } else { keep++; if (wrong) keepWrong++; }
    });
  }
  const n = real.length, p = (x) => `${(x * 100).toFixed(1)}%`;
  return { "투표 1순위 정답": p(top1 / n), "예시 5개 안에 정답 표": p(hit5 / n), "강도 낮춘 비율": p(down / n), "낮췄을 때 A2가 실제로 틀림": p(downWrong / down), "안 낮췄을 때 A2 틀림": p(keepWrong / keep) };
}
const A = run(() => buildIndex(gold));
const B = run((f) => buildIndex([...gold, ...real.filter((_, k) => k % 5 !== f)]));
const ok = real.filter((q) => q.ai === q.label).length;
console.log(`실제 고민 ${real.length}건 · 실서비스 A2 점수표 일치 ${(ok / real.length * 100).toFixed(1)}%`);
console.table({ "A 지금(합성 490)": A, "B 합성 + 실제": B });
