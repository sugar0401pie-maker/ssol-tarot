import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // v4.1 고민 틀 예시(판별 DB 정답 490건)는 서버가 실행 중에 파일로 읽는다(lib/server/frameExamples.ts) — 배포본에 같이 싣는다.
  outputFileTracingIncludes: {
    "/api/tarot/**": ["./judge-db/data/frame_gold_v2.18.jsonl", "./judge-db/data/frame_gold_v2.18.emb.f16.bin", "./judge-db/data/frame_gold_v2.18.emb.meta.json", "./judge-db/data/frame_gold_en_v1.2.jsonl"],
  },
  // 서버가 실행 중에 읽는 건 위 네 파일뿐 — 나머지 판별 DB(옛 정답 판·평가·검수표)는 함수에 싣지 않는다(2026-11-16, 함수 크기).
  outputFileTracingExcludes: {
    "/**": [
      "./judge-db/*.{xlsx,txt,md,mjs}", "./judge-db/{eval,review,build}/**/*",
      "./judge-db/data/frame_gold_v{1,2.1,2.7,2.9,2.10,2.11,2.12,2.13,2.14,2.15,2.16,2.17}.*",
      "./judge-db/data/{real_worries,love_qsub,root_need,ssol_need,safety_signals,worry_examples,sub_equivalents}*",
    ],
  },
  images: {
    // 카드 그림만 최적화한다(다른 경로의 파일은 막음). 화질은 기본 75 하나만 허용.
    localPatterns: [{ pathname: "/images/tarot/**" }],
    qualities: [75],
    // 기본 목록 + 416: 인트로 원형 친구(168px × 2배 = 336px → 384)처럼 작은 그림이 640px까지 올라가지 않게.
    imageSizes: [32, 48, 64, 96, 128, 256, 384, 416],
    // 카드 그림은 바뀌면 파일 이름이 같아도 다시 만들어야 하므로 캐시는 하루로 둔다.
    minimumCacheTTL: 86400,
  },
};

export default nextConfig;
