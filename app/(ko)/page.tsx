import type { Metadata } from "next";
import TarotFlow from "@/components/TarotFlow";
import { clientCopy, clientFollowup, introFriends, PICK_COUNT } from "@/lib/server/clientData";
import { loadSceneArt } from "@/lib/server/sceneArt";
import { homeMeta } from "@/lib/seo/home";
import { OG_IMAGES } from "@/lib/seo/ogImage";

// 첫 화면 검색·미리보기 문구(owner 2026-11-16, lib/seo/home.ts). 가격이 할인 종료에 맞춰 바뀌게 1시간마다 다시 만든다.
export const revalidate = 3600;

export function generateMetadata(): Metadata {
  const m = homeMeta();
  return {
    title: { absolute: m.title },
    description: m.description,
    alternates: { canonical: "/" },
    openGraph: { title: m.ogTitle, description: m.ogDescription, siteName: "쏠 타로 하우스", locale: "ko_KR", type: "website", url: "/" , images: OG_IMAGES },
    twitter: { card: "summary_large_image", title: m.ogTitle, description: m.ogDescription, images: ["/opengraph-image.jpg"] },
  };
}

export default function Home() {
  return <TarotFlow copy={clientCopy()} pickCount={PICK_COUNT} friends={introFriends()} sceneArt={loadSceneArt()} followup={clientFollowup()} />;
}
