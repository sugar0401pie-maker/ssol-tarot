import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CARD_PAGES, CARDS_PATH, INDEX_DESC, INDEX_H1, INDEX_OG_DESC, INDEX_OG_TITLE, INDEX_TITLE, indexJsonLd } from "@/lib/cards/content";
import { CardsFooter, CtaButton } from "./CardsChrome";
import { SHUFFLE_PATH } from "@/lib/guide/shuffle";
import { THREE_PATH } from "@/lib/guide/threeCard";
import { OG_IMAGES } from "@/lib/seo/ogImage";

// 카드 22장 모아 보기(SEO, owner 2026-11-15). 로그인 없이 빌드 때 만든 정적 HTML.
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://tarot.ssolwellnesshouse.com";

export const metadata: Metadata = {
  title: { absolute: INDEX_TITLE },
  description: INDEX_DESC,
  alternates: { canonical: `${SITE}${CARDS_PATH}` },
  openGraph: { title: INDEX_OG_TITLE, description: INDEX_OG_DESC, type: "website", locale: "ko_KR", siteName: "쏠 타로 하우스", url: `${SITE}${CARDS_PATH}` , images: OG_IMAGES },
};

export default function CardsIndex() {
  const jsonLd = JSON.stringify(indexJsonLd(SITE)).replace(/</g, "\\u003c");
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <Link href="/" className="text-[13px] text-moon/70">
        ← 처음으로
      </Link>
      <p className="mt-6 text-center text-[13px] tracking-[10px] text-gold" aria-hidden>
        ✦ ✦ ✦
      </p>
      <h1 className="mt-2 break-keep text-center font-serif text-[24px] font-bold leading-snug text-gold-soft">{INDEX_H1}</h1>
      <p className="mt-4 break-keep text-[15px] leading-7 text-moon/90">{INDEX_DESC}</p>
      <p className="mt-3 text-[14px]">
        <Link href={SHUFFLE_PATH} className="text-gold-soft underline underline-offset-4">
          타로 셔플하는 법 →
        </Link>
        <span className="mx-2 text-moon/40">·</span>
        <Link href={THREE_PATH} className="text-gold-soft underline underline-offset-4">
          타로 3장 배열 보는 법 →
        </Link>
      </p>
      <CtaButton />
      <ul className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {CARD_PAGES.map((c) => (
          <li key={c.slug}>
            <Link href={`${CARDS_PATH}/${c.slug}`} className="block rounded-2xl bg-card-cream p-3 text-navy">
              <Image src={c.image} alt={`${c.no}번 ${c.name} 카드 그림 — ${c.character}`} width={720} height={1080} sizes="(min-width: 640px) 200px, 45vw" className="h-auto w-full rounded-xl" />
              <p className="mt-2 text-[12px] text-navy/60">
                {c.no}번 · {c.arcanaKo}
              </p>
              <p className="break-keep font-serif text-[16px] font-bold">{c.name}</p>
              <p className="mt-1 break-keep text-[12px] text-navy/70">{c.upright.keywords.slice(0, 3).join(" · ")}</p>
            </Link>
          </li>
        ))}
      </ul>
      <CtaButton />
      <CardsFooter />
    </main>
  );
}
