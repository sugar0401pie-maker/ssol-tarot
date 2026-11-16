import type { Metadata } from "next";
import { FAQ, SECTIONS, THREE_DESC, THREE_H1, THREE_OG_DESC, THREE_OG_TITLE, THREE_PATH, THREE_TITLE, threeJsonLd } from "@/lib/guide/threeCard";
import { SHUFFLE_PATH } from "@/lib/guide/shuffle";
import GuideArticle from "../cards/GuideArticle";

// 타로 3장 배열 보는 법 안내(SEO, owner 2026-11-16). 로그인 없이 빌드 때 만든 정적 HTML. 글은 lib/guide/threeCard.ts.
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://tarot.ssolwellnesshouse.com";

export const metadata: Metadata = {
  title: { absolute: THREE_TITLE },
  description: THREE_DESC,
  alternates: { canonical: `${SITE}${THREE_PATH}` },
  openGraph: { title: THREE_OG_TITLE, description: THREE_OG_DESC, type: "article", locale: "ko_KR", siteName: "쏠 타로 하우스", url: `${SITE}${THREE_PATH}` },
};

export default function TarotThreeCardPage() {
  return <GuideArticle jsonLd={threeJsonLd(SITE)} h1={THREE_H1} lead={THREE_DESC} sections={SECTIONS} faq={FAQ} links={[{ href: SHUFFLE_PATH, label: "타로 셔플하는 법 →" }]} />;
}
