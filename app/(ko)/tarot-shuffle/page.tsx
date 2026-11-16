import type { Metadata } from "next";
import Link from "next/link";
import { CARDS_PATH } from "@/lib/cards/content";
import { FAQ, SECTIONS, SHUFFLE_DESC, SHUFFLE_H1, SHUFFLE_PATH, SHUFFLE_TITLE, shuffleJsonLd } from "@/lib/guide/shuffle";
import { CardsFooter, CtaButton } from "../cards/CardsChrome";

// 타로 셔플·뽑는 법 안내(SEO, owner 2026-11-16). 로그인 없이 빌드 때 만든 정적 HTML. 글은 lib/guide/shuffle.ts.
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://tarot.ssolwellnesshouse.com";

export const metadata: Metadata = {
  title: { absolute: SHUFFLE_TITLE },
  description: SHUFFLE_DESC,
  alternates: { canonical: `${SITE}${SHUFFLE_PATH}` },
  openGraph: { title: SHUFFLE_TITLE, description: SHUFFLE_DESC, type: "article", locale: "ko_KR", siteName: "쏠 타로 하우스", url: `${SITE}${SHUFFLE_PATH}` },
};

export default function TarotShufflePage() {
  const jsonLd = JSON.stringify(shuffleJsonLd(SITE)).replace(/</g, "\\u003c");
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <Link href="/" className="text-[13px] text-moon/70">
        ← 처음으로
      </Link>
      <p className="mt-6 text-center text-[13px] tracking-[10px] text-gold" aria-hidden>
        ✦ ✦ ✦
      </p>
      <h1 className="mt-2 break-keep text-center font-serif text-[24px] font-bold leading-snug text-gold-soft">{SHUFFLE_H1}</h1>
      <p className="mt-4 break-keep text-[15px] leading-7 text-moon/90">{SHUFFLE_DESC}</p>
      {SECTIONS.map((s) => (
        <section key={s.h} className="mt-8">
          <h2 className="break-keep font-serif text-[19px] font-bold text-gold-soft">{s.h}</h2>
          {s.p.map((t) => (
            <p key={t} className="mt-3 break-keep text-[15px] leading-7 text-moon/90">
              {t}
            </p>
          ))}
          {s.list && (
            <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-[15px] leading-7 text-moon/90">
              {s.list.map((t) => (
                <li key={t} className="break-keep">
                  {t}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
      <p className="mt-6 text-center text-[14px]">
        <Link href={CARDS_PATH} className="text-gold-soft underline underline-offset-4">
          타로 카드 22장의 뜻 보기 →
        </Link>
      </p>
      <CtaButton />
      <section className="mt-10">
        <h2 className="break-keep font-serif text-[19px] font-bold text-gold-soft">자주 묻는 질문</h2>
        <dl className="mt-3 flex flex-col gap-4">
          {FAQ.map((f) => (
            <div key={f.q}>
              <dt className="break-keep text-[15px] font-bold text-moon">{f.q}</dt>
              <dd className="mt-1 break-keep text-[15px] leading-7 text-moon/85">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>
      <CtaButton />
      <CardsFooter />
    </main>
  );
}
