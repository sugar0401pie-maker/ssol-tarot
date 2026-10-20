import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
