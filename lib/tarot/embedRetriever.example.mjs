// v2.3.9 예시(개발용) — 의미 검색(임베딩)으로 비슷한 예시 찾기. setRetriever로 끼우면 findSimilar가 이걸 씀.
//   운영 모델·키는 개발 환경 값으로. 색인 임베딩은 배포 때 한 번 만들어 저장(파일·DB), 질문만 매번 임베딩.
//   글자 검색(TF-IDF)과 섞는 하이브리드 권장: score = 0.7 × 임베딩 코사인 + 0.3 × 글자 코사인
import { buildIndex, setRetriever } from "./retrieve.js";
import { buildNormalizer } from "./normalize.js";

export async function makeEmbedRetriever({ rows, dict, embed, cached = null, wEmb = 0.7, wChar = 0.3 }) {
  // embed: async (texts: string[]) => number[][]  (예: 운영에서 쓰는 임베딩 API를 감싼 함수)
  const norm = buildNormalizer(dict);
  const charIdx = buildIndex(rows, { normalize: norm });
  const vecs = cached || (await embed(rows.map((r) => norm(r.text))));
  const unit = (v) => { const n = Math.hypot(...v) || 1; return v.map((x) => x / n); };
  const V = vecs.map(unit);
  return async function retriever(text, { k = 5, excludeId = null } = {}) {
    const [q0] = await embed([norm(text)]); const q = unit(q0);
    const charScores = new Map(charIdx.nearest(text, 50, { excludeId }).map((n) => [n.id, n.score]));
    const scored = rows.map((r, i) => {
      if (excludeId != null && r.id === excludeId) return null;
      let e = 0; for (let j = 0; j < q.length; j++) e += q[j] * V[i][j];
      return { id: r.id, score: wEmb * e + wChar * (charScores.get(r.id) || 0), text: r.text, table: (r.tables || [null])[0] ?? null, tables: r.tables, mode: r.mode ?? null, ranked: r.ranked ?? [],
        sub_id: r.sub_id ?? null, sub2: r.sub2 ?? null, area: r.area ?? null, want: r.want ?? null, love_status: r.love_status ?? null, love_topic: r.love_topic ?? null };
    }).filter(Boolean);
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, k);
  };
}
// 사용: setRetriever(await makeEmbedRetriever({ rows: frameGoldV24, dict: normDict, embed: myEmbedFn, cached: savedVectors }))
// 주의: findSimilar가 async가 되므로 부르는 쪽에서 await. 평가: 08_판별DB/eval 스크립트에 같은 5겹 교차 검증으로 재기.
