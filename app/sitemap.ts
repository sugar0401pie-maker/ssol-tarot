import type { MetadataRoute } from "next";
import { CARD_PAGES, CARDS_PATH } from "@/lib/cards/content";
import { SHUFFLE_PATH } from "@/lib/guide/shuffle";

// 검색엔진에 알려 줄 공개 화면(owner 2026-10-29). 결과·결제·로그인 화면은 넣지 않는다(robots.ts에서 막음).
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://tarot.ssolwellnesshouse.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE}/about`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE}${SHUFFLE_PATH}`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE}${CARDS_PATH}`, changeFrequency: "monthly", priority: 0.7 },
    ...CARD_PAGES.map((c) => ({ url: `${SITE}${CARDS_PATH}/${c.slug}`, changeFrequency: "monthly" as const, priority: 0.6 })),
    { url: `${SITE}/legal`, changeFrequency: "monthly", priority: 0.3 },
  ];
}
