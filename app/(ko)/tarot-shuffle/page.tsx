import type { Metadata } from "next";
import { FAQ, SECTIONS, SHUFFLE_DESC, SHUFFLE_H1, SHUFFLE_PATH, SHUFFLE_TITLE, shuffleJsonLd } from "@/lib/guide/shuffle";
import { THREE_PATH } from "@/lib/guide/threeCard";
import GuideArticle from "../cards/GuideArticle";
import { OG_IMAGES } from "@/lib/seo/ogImage";

// 타로 셔플·뽑는 법 안내(SEO, owner 2026-11-16). 로그인 없이 빌드 때 만든 정적 HTML. 글은 lib/guide/shuffle.ts.
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://tarot.ssolwellnesshouse.com";

export const metadata: Metadata = {
  title: { absolute: SHUFFLE_TITLE },
  description: SHUFFLE_DESC,
  alternates: { canonical: `${SITE}${SHUFFLE_PATH}` },
  openGraph: { title: SHUFFLE_TITLE, description: SHUFFLE_DESC, type: "article", locale: "ko_KR", siteName: "쏠 타로 하우스", url: `${SITE}${SHUFFLE_PATH}` , images: OG_IMAGES },
};

export default function TarotShufflePage() {
  return <GuideArticle jsonLd={shuffleJsonLd(SITE)} h1={SHUFFLE_H1} lead={SHUFFLE_DESC} sections={SECTIONS} faq={FAQ} links={[{ href: THREE_PATH, label: "타로 3장 배열 보는 법 →" }]} />;
}
