import type { Metadata } from "next";
import { FAQ, SECTIONS, THREE_DESC, THREE_H1, THREE_PATH, threeJsonLd } from "@/lib/guide/threeCard";
import { SHUFFLE_PATH } from "@/lib/guide/shuffle";
import GuideArticle from "../cards/GuideArticle";
import { OG_IMAGES } from "@/lib/seo/ogImage";
import { pageMeta } from "@/lib/seo/pages";

// 타로 3장 배열 보는 법 안내(SEO, owner 2026-11-16). 로그인 없이 빌드 때 만든 정적 HTML. 글은 lib/guide/threeCard.ts.
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://tarot.ssolwellnesshouse.com";

// 검색·미리보기 문구는 owner 시트(lib/seo/pages.ts, 2026-11-16) — 가격이 들어 있어 1시간마다 다시 만든다. 화면 본문 글은 그대로.
export const revalidate = 3600;

export function generateMetadata(): Metadata {
  const m = pageMeta(THREE_PATH)!;
  return {
    title: { absolute: m.title },
    description: m.description,
    alternates: { canonical: `${SITE}${THREE_PATH}` },
    openGraph: { title: m.ogTitle, description: m.ogDescription, type: "article", locale: "ko_KR", siteName: "쏠 타로 하우스", url: `${SITE}${THREE_PATH}`, images: OG_IMAGES },
    twitter: { card: "summary_large_image", title: m.ogTitle, description: m.ogDescription, images: ["/opengraph-image.jpg"] },
  };
}

export default function TarotThreeCardPage() {
  return <GuideArticle jsonLd={threeJsonLd(SITE)} h1={THREE_H1} lead={THREE_DESC} sections={SECTIONS} faq={FAQ} links={[{ href: SHUFFLE_PATH, label: "타로 셔플하는 법 →" }]} />;
}
