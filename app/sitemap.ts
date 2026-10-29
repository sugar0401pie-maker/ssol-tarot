import type { MetadataRoute } from "next";

// 검색엔진에 알려 줄 공개 화면(owner 2026-10-29). 결과·결제·로그인 화면은 넣지 않는다(robots.ts에서 막음).
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://tarot.ssolwellnesshouse.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE}/legal`, changeFrequency: "monthly", priority: 0.3 },
  ];
}
