// v2.3.9 의미 검색(임베딩) + 글자 검색 섞기 — 순수 부분(네트워크 없음, 테스트 있음).
// 측정(scripts/eval_embed_retrieval.mjs, 실제 고민 956건 5겹 교차 검증, 2026-11-08): text-embedding-3-large 1,024차원,
// 0.7 × 임베딩 코사인 + 0.3 × 글자 코사인 → 점수표 1위 70.3 → 78.5%, 세부 고민 1위 50.0 → 58.1%, 세부 후보 8개 안 82.3 → 91.8%.

export const W_EMB = 0.7;
// 질문 임베딩 모델·차원 기본값(색인과 같아야 함 — 색인 meta와 맞는지 embedIndex.test.ts가 확인).
export const EMBED_MODEL_DEFAULT = "text-embedding-3-large";
export const EMBED_DIM_DEFAULT = 1024;
export const W_CHAR = 0.3;

/** 판별 DB 색인 벡터를 16비트 실수로 저장(1,024차원 × 3,932줄 ≈ 8MB). */
export function toF16(x: number): number {
  const f = new Float32Array([x]);
  const i = new Uint32Array(f.buffer)[0];
  const sign = (i >>> 16) & 0x8000;
  const e = ((i >>> 23) & 0xff) - 127 + 15;
  let m = i & 0x7fffff;
  if (e <= 0) {
    if (e < -10) return sign;
    m = (m | 0x800000) >> (1 - e);
    return sign | ((m + 0x1000) >> 13);
  }
  if (e >= 31) return sign | 0x7c00;
  const r = (e << 10) | ((m + 0x1000) >> 13);
  return sign | (r > 0x7bff ? 0x7c00 : r);
}
export function fromF16(h: number): number {
  const s = h & 0x8000 ? -1 : 1, e = (h >> 10) & 0x1f, m = h & 0x3ff;
  if (e === 0) return s * m * 2 ** -24;
  if (e === 31) return m ? NaN : s * Infinity;
  return s * (1 + m / 1024) * 2 ** (e - 15);
}

export function unit(v: ArrayLike<number>): Float32Array {
  let n = 0;
  for (let i = 0; i < v.length; i++) n += v[i] * v[i];
  n = Math.sqrt(n) || 1;
  const out = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = v[i] / n;
  return out;
}

// 16비트 값 65,536개를 한 번에 풀어 둔 표 — 색인을 읽을 때 값마다 계산하지 않게(1초 → 수십 ms).
let F16_TABLE: Float32Array | null = null;
function f16Table(): Float32Array {
  if (!F16_TABLE) {
    F16_TABLE = new Float32Array(65536);
    for (let h = 0; h < 65536; h++) F16_TABLE[h] = fromF16(h);
  }
  return F16_TABLE;
}

/** 색인 파일(Uint16 f16, 줄 순서대로 dim개씩)을 줄마다 단위 벡터로. */
export function decodeIndex(buf: Uint8Array, dim: number): Float32Array[] {
  const u16 = new Uint16Array(buf.buffer, buf.byteOffset, buf.byteLength / 2);
  const T = f16Table();
  const n = u16.length / dim;
  if (!Number.isInteger(n)) throw new Error("색인 길이가 차원과 맞지 않음");
  const rows: Float32Array[] = [];
  for (let r = 0; r < n; r++) {
    const v = new Float32Array(dim);
    for (let j = 0; j < dim; j++) v[j] = T[u16[r * dim + j]];
    rows.push(unit(v));
  }
  return rows;
}

/** 섞은 점수로 상위 k개 행 번호와 점수. charScores = 글자 검색 상위 이웃(id → 점수, 없으면 0). */
export function hybridTop(q: Float32Array, vecs: Float32Array[], ids: string[], charScores: Map<string, number>, k: number, wEmb = W_EMB): { i: number; score: number }[] {
  const wChar = 1 - wEmb;
  const scored = vecs.map((v, i) => {
    let d = 0;
    for (let j = 0; j < q.length; j++) d += q[j] * v[j];
    return { i, score: wEmb * d + wChar * (charScores.get(ids[i]) || 0) };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}
