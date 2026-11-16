import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CARD_PAGES, CARDS_PATH, type CardSide, cardBySlug, cardDescription, cardH1, cardJsonLd, cardTitle, neighbors } from "@/lib/cards/content";
import { CardsFooter, CtaButton } from "../CardsChrome";
import { pageMeta } from "@/lib/seo/pages";

// 카드 한 장 소개(SEO, owner 2026-11-15 "카드마다 따로 페이지"). 22장 모두 빌드 때 정적 HTML로 만든다.
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://tarot.ssolwellnesshouse.com";

// 검색·미리보기 문구에 리포트 가격이 들어 있어(lib/seo/pages.ts) 1시간마다 다시 만든다.
export const revalidate = 3600;
export const dynamicParams = false;
export function generateStaticParams() {
  return CARD_PAGES.map((c) => ({ slug: c.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = cardBySlug((await params).slug);
  if (!c) return {};
  const url = `${SITE}${CARDS_PATH}/${c.slug}`;
  // owner 시트 문구(2026-11-16). 표에 없으면 예전 자동 문구.
  const m = pageMeta(`${CARDS_PATH}/${c.slug}`) ?? { title: cardTitle(c), description: cardDescription(c), ogTitle: cardTitle(c), ogDescription: cardDescription(c) };
  return {
    title: { absolute: m.title },
    description: m.description,
    alternates: { canonical: url },
    openGraph: { title: m.ogTitle, description: m.ogDescription, type: "article", locale: "ko_KR", siteName: "쏠 타로 하우스", url, images: [{ url: `${SITE}${c.image}` }] },
    twitter: { card: "summary_large_image", title: m.ogTitle, description: m.ogDescription },
  };
}

function Side({ title, s }: { title: string; s: CardSide }) {
  return (
    <section className="mt-8">
      <h2 className="font-serif text-[19px] font-bold text-navy">{title}</h2>
      <p className="mt-2 text-[13px] text-navy/60">키워드 · {s.keywords.join(", ")}</p>
      {s.core && <p className="mt-3 font-semibold leading-7 text-navy">{s.core}</p>}
      {s.overview && <p className="mt-2 text-[15px] leading-7 text-navy/85">{s.overview}</p>}
      {s.desc && <p className="mt-2 text-[15px] leading-7 text-navy/85">{s.desc}</p>}
      {s.asks.length > 0 && (
        <>
          <h3 className="mt-4 text-[15px] font-semibold text-navy">이 카드가 건네는 질문</h3>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[14px] leading-6 text-navy/85">
            {s.asks.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export default async function CardPage({ params }: Props) {
  const c = cardBySlug((await params).slug);
  if (!c) notFound();
  const { prev, next } = neighbors(c);
  const jsonLd = JSON.stringify(cardJsonLd(SITE, c)).replace(/</g, "\\u003c");
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <nav className="text-[13px] text-moon/70" aria-label="위치">
        <Link href="/">처음으로</Link> › <Link href={CARDS_PATH}>카드 22장</Link>
      </nav>
      <p className="mt-6 text-center text-[13px] text-gold">
        {c.no}번 · 원래 타로 카드 {c.arcanaKo}({c.arcanaEn})
      </p>
      <h1 className="mt-2 break-keep text-center font-serif text-[26px] font-bold leading-snug text-gold-soft">{cardH1(c)}</h1>
      <p className="mt-1 text-center text-[14px] text-moon/80">{c.character}</p>
      <Image
        src={c.image}
        alt={`${c.name} 카드 그림 — ${c.character}`}
        width={720}
        height={1080}
        sizes="(min-width: 640px) 320px, 70vw"
        priority
        className="mx-auto mt-5 h-auto w-[70%] max-w-[320px] rounded-2xl"
      />
      <p className="mt-5 break-keep text-[15px] leading-7 text-moon/90">
        {c.when} {c.origin}
      </p>

      <div className="mt-6 break-keep rounded-2xl bg-card-cream px-5 py-6 text-navy">
        <Side title="정방향의 뜻" s={c.upright} />
        <Side title="역방향의 뜻" s={c.reversed} />
      </div>

      <p className="mt-6 break-keep text-center text-[14px] leading-6 text-moon/85">
        내 고민에서 이 카드는 어떤 뜻일까요? 고민을 한 줄로 쓰고 세 장을 뽑아 보세요.
      </p>
      <CtaButton />

      <nav className="mt-6 flex justify-between gap-3 text-[13px]" aria-label="다른 카드">
        <Link href={`${CARDS_PATH}/${prev.slug}`} className="text-moon/80 underline underline-offset-2">
          ← {prev.no}번 {prev.name}
        </Link>
        <Link href={`${CARDS_PATH}/${next.slug}`} className="text-right text-moon/80 underline underline-offset-2">
          {next.no}번 {next.name} →
        </Link>
      </nav>
      <CardsFooter />
    </main>
  );
}
