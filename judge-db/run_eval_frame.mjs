// 쏠 타로 고민 틀(A2) 평가기 v0.1 (패키지 v4.1, Node 18+, 외부 패키지 없음) — 세트 T6(eval/T6_frame.jsonl, 490건)
//   node run_eval_frame.mjs                               (a) 유사도만 1순위 정확도(leave-one-out) + (c) 두 번째 의견 불일치 비율(기본 A2 결과 = eval/preds_T6_v46.jsonl)
//   node run_eval_frame.mjs sim [k]                        (a)만, 이웃 수 k(기본 5)
//   node run_eval_frame.mjs model ./model_adapter_example.mjs [최대 문항]
//                                                          (b) 실제 모델로 A2 v4.6 호출(사용자 입력 = 비슷한 정답 5개 + 고민, 자기 자신 제외) → eval/preds_frame_<시각>.jsonl
//   node run_eval_frame.mjs score <preds.jsonl>            (b) A2 결과 채점(표 정확도, 방향 줌/안 줌) + (c) 두 번째 의견
// 정답: gold.tables(1순위 표, 2순위 인정 — null 포함), gold.mode, gold.ranked. 예측 파일 한 줄 = {id, pred: {table, mode, options_ranked}}
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(here, "..");
const { buildIndex, voteTable } = await import(path.join(ROOT, "03_코드/retrieve.js"));
const { prepareFrameCall } = await import(path.join(ROOT, "03_코드/frameInput.js"));
const { parseFrame } = await import(path.join(ROOT, "03_코드/validateV4.js"));
const { secondOpinion, minShareOf } = await import(path.join(ROOT, "03_코드/decision.js"));
const MIN_SHARE = minShareOf(JSON.parse(fs.readFileSync(path.join(ROOT, "02_데이터/decision_tables.json"), "utf8"))); // second_opinion.min_share
const readJsonl = (f) => fs.readFileSync(f, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
const pct = (a, b) => (b ? `${((a / b) * 100).toFixed(1)}% (${a}/${b})` : "-");

const T6 = readJsonl(path.join(here, "eval/T6_frame.jsonl"));
const GOLD = readJsonl(path.join(here, "data/frame_gold_v1.jsonl")); // 색인 원천(T6와 같은 490건 — 그래서 반드시 자기 자신 제외)
const index = buildIndex(GOLD);
const K = 5;
const goldTables = (x) => (x.gold.tables || []).map((t) => t ?? null);
const gives = (t) => t !== null && t !== undefined; // 방향을 주는가
const SETS = [...new Set(T6.map((x) => x.set))];

// (a) 유사도만: 이웃 k개(자기 자신 제외) 점수 가중 투표 1순위 표가 정답 표(2순위 인정) 안에 있는가
function simOnly(k = K) {
  return T6.map((x) => {
    const nb = index.nearest(x.text, k, { excludeId: x.id });
    const v = voteTable(nb);
    return { x, nb, vote: v, ok: goldTables(x).includes(v.table), nn1: goldTables(x).includes(nb[0] ? nb[0].table : undefined) };
  });
}
function reportSim(R, k) {
  console.log(`(a) 유사도만 1순위 표 정확도 — 글자 2~4그램 TF-IDF, 이웃 ${k}개 점수 가중 투표, leave-one-out`);
  console.log(`  전체 ${pct(R.filter((r) => r.ok).length, R.length)} · 가장 가까운 1개만 ${pct(R.filter((r) => r.nn1).length, R.length)}`);
  for (const s of SETS) { const S = R.filter((r) => r.x.set === s); console.log(`  [${s}] ${pct(S.filter((r) => r.ok).length, S.length)}`); }
  const dirOk = R.filter((r) => gives(r.vote.table) === goldTables(r.x).some(gives)).length;
  console.log(`  방향 줌/안 줌 일치 ${pct(dirOk, R.length)}`);
  const conf = {};
  R.filter((r) => !r.ok).forEach((r) => { const k2 = `${r.x.gold.tables[0]}→${r.vote.table}`; conf[k2] = (conf[k2] || 0) + 1; });
  console.log("  헷갈림 상위:", Object.entries(conf).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([a, b]) => `${a} ${b}`).join(" · "));
}

// (b) A2 결과 채점
function scorePreds(preds) {
  const byId = Object.fromEntries(T6.map((x) => [x.id, x]));
  const rows = preds.filter((p) => byId[p.id]).map((p) => ({ x: byId[p.id], p: p.pred }));
  const ok = rows.filter((r) => r.p);
  console.log(`(b) A2 결과 채점 ${rows.length}문항 · 형식 실패 ${rows.length - ok.length}`);
  const tOk = (r) => goldTables(r.x).includes(r.p.table ?? null);
  console.log(`  점수표 맞음(2순위 인정) ${pct(ok.filter(tOk).length, ok.length)}`);
  for (const s of SETS) { const S = ok.filter((r) => r.x.set === s); if (S.length) console.log(`  [${s}] ${pct(S.filter(tOk).length, S.length)}`); }
  const g = ok.filter((r) => goldTables(r.x).some(gives)), n = ok.filter((r) => !goldTables(r.x).some(gives));
  console.log(`  방향 줌/안 줌: 정답이 방향을 줄 때 줌 ${pct(g.filter((r) => gives(r.p.table)).length, g.length)} · 정답이 null일 때 안 줌 ${pct(n.filter((r) => !gives(r.p.table)).length, n.length)}`);
  const m = ok.filter((r) => gives(r.p.table) && r.x.gold.mode && tOk(r));
  console.log(`  mode 맞음(표가 맞은 것 중) ${pct(m.filter((r) => r.p.mode === r.x.gold.mode).length, m.length)}`);
  return ok;
}

// (c) 두 번째 의견: A2 표 vs 유사도 투표 1순위 표가 다른 비율 — 다르면 강도를 한 단계 낮춤
function reportSecond(ok, R) {
  const sim = Object.fromEntries(R.map((r) => [r.x.id, r.vote]));
  const rows = ok.map((r) => {
    const v = sim[r.x.id];
    const so = secondOpinion({ frameTable: r.p.table ?? null, simTable: v.table, strength: gives(r.p.table) ? "strong" : null, worryId: r.x.id, simShare: v.share, minShare: MIN_SHARE });
    return { ...r, v, so, a2ok: goldTables(r.x).includes(r.p.table ?? null), simok: goldTables(r.x).includes(v.table) };
  });
  const dis0 = rows.filter((r) => r.so.disagree), dis = dis0.filter((r) => !(r.so.review_log && r.so.review_log.below_min_share)), low = rows.filter((r) => r.so.lowered);
  console.log(`(c) 두 번째 의견(min_share ${MIN_SHARE}) — A2 표 ≠ 유사도 표(모든 비율) ${pct(dis0.length, rows.length)} · 비율 ≥ ${MIN_SHARE}이고 다름 ${pct(dis.length, rows.length)} · 강도 한 단계 낮춤 ${pct(low.length, rows.length)}`);
  console.log(`  불일치 중 A2가 틀린 것(낮춘 게 맞았던 경우) ${pct(dis.filter((r) => !r.a2ok).length, dis.length)} · A2가 맞은 것(괜히 낮춘 경우) ${pct(dis.filter((r) => r.a2ok).length, dis.length)}`);
  const wrong = rows.filter((r) => !r.a2ok);
  console.log(`  A2가 틀린 ${wrong.length}건 중 두 번째 의견이 걸러 낸 것(비율 ≥ ${MIN_SHARE}) ${pct(wrong.filter((r) => dis.includes(r)).length, wrong.length)}`);
  for (const th of [0, 0.5, 0.6, 0.7]) { // 투표 비율 하한별 비교
    const d = dis0.filter((r) => r.v.share >= th);
    console.log(`  (참고) 투표 비율 ≥ ${th}일 때만 낮추면: 불일치 ${pct(d.length, rows.length)} · 그중 A2가 틀린 것 ${pct(d.filter((r) => !r.a2ok).length, d.length)}`);
  }
  const logs = dis.map((r) => r.so.review_log);
  console.log(`  review_log ${logs.length}건 예: ${JSON.stringify(logs[0] || null)}`);
}

const mode = process.argv[2] || "all";
if (mode === "all" || mode === "sim") {
  const k = Number(process.argv[3] || K);
  const R = simOnly(k);
  reportSim(R, k);
  if (mode === "all") {
    const def = path.join(here, "eval/preds_T6_v46.jsonl");
    if (fs.existsSync(def)) {
      console.log(`\n[A2 결과 = ${path.relative(here, def)} — v4.6 고민 틀 기존 시험 결과(few-shot 붙이기 전)]`);
      reportSecond(scorePreds(readJsonl(def)), R);
    } else console.log("(c)는 A2 결과 파일이 필요: node run_eval_frame.mjs score <preds.jsonl>");
  }
} else if (mode === "model") {
  const adapter = await import(path.resolve(process.argv[3]));
  const md = fs.readFileSync(path.join(ROOT, "01_설계/ai-prompts-tarot-v4.md"), "utf8");
  const sys = md.split("## A2 ·")[1].split("```text")[1].split("```")[0].trim();
  const rows = T6.slice(0, Number(process.argv[4] || 1e9));
  const out = path.join(here, "eval", `preds_frame_${Date.now()}.jsonl`);
  console.log(`모델 호출 ${rows.length}문항(사용자 입력 = 비슷한 정답 ${K}개 + 고민, 자기 자신 제외) → ${out}`);
  for (const x of rows) {
    const { user } = prepareFrameCall({ worryText: x.text, excludeId: x.id, index });
    let raw = "", pred = null, err = null;
    for (let t = 0; t < 2 && !pred; t++) { // 운영과 같이 1회 재시도
      try { raw = await adapter.callModel({ system: sys, user }); const r = parseFrame(raw); err = r.errors; pred = r.frame ? { table: r.frame.table, mode: r.frame.mode, options_ranked: r.frame.options_ranked } : null; } catch (e) { err = [String(e.message || e)]; }
    }
    fs.appendFileSync(out, JSON.stringify({ id: x.id, set: "T6", pred, err: pred ? null : err, raw: pred ? undefined : raw }) + "\n");
  }
  console.log("끝 — 채점: node run_eval_frame.mjs score", path.relative(here, out));
} else if (mode === "score") {
  const R = simOnly(K);
  reportSecond(scorePreds(readJsonl(path.resolve(process.argv[3]))), R);
} else {
  console.log("사용법: node run_eval_frame.mjs [all] | sim [k] | model <어댑터.mjs> [최대] | score <preds.jsonl>");
}
