// v4.1 (새로) 비슷한 고민 정답 찾기 — 고민 틀(A2) few-shot 예시 붙이기 + 두 번째 의견(유사도 투표)
//   정답 원천: 08_판별DB/data/frame_gold_v1.jsonl (490건, {id, text, tables, mode, ranked})
//   방법: 외부 라이브러리 없이 글자 2~4그램 TF-IDF 코사인. 운영에서 임베딩으로 바꿀 때는 findSimilar 하나만 바꾸면 됨(setRetriever).
//   평가 때는 자기 자신을 빼고 찾음(leave-one-out: excludeId).
//
//   const idx = buildIndex(rows);            // rows = frame_gold 줄들
//   idx.nearest(text, 5, { excludeId })      // → [{ id, score, text, table, tables, mode, ranked }] 점수 높은 순
//   nearest(text, 5, { excludeId })          // 마지막으로 만든 색인으로 찾음(같은 결과)
//   voteTable(neighbors)                     // → { table, share, votes } 점수 가중 투표
//   findSimilar(text, { k, excludeId })      // 운영 진입점 — 기본은 TF-IDF, setRetriever(fn)로 임베딩 검색 등으로 바꿈

const NMIN = 2, NMAX = 4;
// 띄어쓰기·문장부호는 공백 하나로(띄어쓰기 차이에 덜 민감하게), 영문은 소문자
export const normText = (t) => String(t || "").toLowerCase().replace(/[\s.,!?~…·"'“”‘’()[\]{}:;ㅋㅎㅠㅜ^]+/g, " ").trim();
export function grams(text, nmin = NMIN, nmax = NMAX) {
  const s = normText(text), m = new Map();
  for (let n = nmin; n <= nmax; n++) for (let i = 0; i + n <= s.length; i++) {
    const g = s.slice(i, i + n);
    if (g.trim().length < n - 1) continue; // 공백만 많은 조각은 뺌
    m.set(g, (m.get(g) || 0) + 1);
  }
  return m;
}

const tableOf = (r) => (Array.isArray(r.tables) ? r.tables[0] ?? null : r.table ?? null);

export function buildIndex(rows) {
  const docs = rows.map((r) => ({ row: r, g: grams(r.text) }));
  const df = new Map();
  docs.forEach((d) => d.g.forEach((_, k) => df.set(k, (df.get(k) || 0) + 1)));
  const N = docs.length;
  const idf = (k) => Math.log((N + 1) / ((df.get(k) || 0) + 1)) + 1;
  const vec = (g) => { const v = new Map(); let nn = 0; g.forEach((c, k) => { const w = (1 + Math.log(c)) * idf(k); v.set(k, w); nn += w * w; }); nn = Math.sqrt(nn) || 1; v.forEach((w, k) => v.set(k, w / nn)); return v; };
  docs.forEach((d) => { d.v = vec(d.g); });
  const index = {
    size: N,
    nearest(text, k = 5, { excludeId = null } = {}) {
      const q = vec(grams(text));
      const scored = [];
      for (const d of docs) {
        if (excludeId != null && d.row.id === excludeId) continue;
        let s = 0; const [a, b] = q.size < d.v.size ? [q, d.v] : [d.v, q];
        a.forEach((w, key) => { const x = b.get(key); if (x) s += w * x; });
        scored.push({ id: d.row.id, score: s, text: d.row.text, table: tableOf(d.row), tables: d.row.tables ?? [d.row.table ?? null], mode: d.row.mode ?? null, ranked: d.row.ranked ?? d.row.options_ranked ?? [] });
      }
      scored.sort((x, y) => y.score - x.score || String(x.id).localeCompare(String(y.id)));
      return scored.slice(0, k);
    },
  };
  lastIndex = index;
  return index;
}
let lastIndex = null;
export function nearest(text, k = 5, { excludeId = null, index = null } = {}) {
  const ix = index || lastIndex;
  if (!ix) throw new Error("buildIndex(rows)를 먼저 부르세요");
  return ix.nearest(text, k, { excludeId });
}

// 점수 가중 투표: 이웃마다 정답 1순위 표(tables[0], null도 한 표)에 유사도 점수만큼. → 1순위 표와 비율(share = 그 표의 점수 / 전체 점수)
export function voteTable(neighbors) {
  const votes = {};
  let total = 0;
  for (const n of neighbors || []) {
    const key = n.table == null ? "null" : n.table, w = Math.max(0, n.score || 0);
    votes[key] = (votes[key] || 0) + w; total += w;
  }
  const ranked = Object.entries(votes).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (!ranked.length || total <= 0) return { table: undefined, share: 0, votes, top_score: 0 };
  const [k, w] = ranked[0];
  return { table: k === "null" ? null : k, share: w / total, votes, top_score: neighbors[0] ? neighbors[0].score : 0 };
}

// ---- 운영 진입점: 임베딩으로 바꿀 때는 이 함수만 바꿈 ----
let retriever = null; // (text, {k, excludeId}) => neighbors (같은 모양)
export function setRetriever(fn) { retriever = fn; }
export function findSimilar(text, { k = 5, excludeId = null, index = null } = {}) {
  if (retriever) return retriever(text, { k, excludeId });
  return nearest(text, k, { excludeId, index });
}
