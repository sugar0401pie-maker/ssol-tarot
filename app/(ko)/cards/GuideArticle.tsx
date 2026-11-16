import Link from "next/link";
import { CARDS_PATH } from "@/lib/cards/content";
import type { Section } from "@/lib/guide/shuffle";
import { CardsFooter, CtaButton } from "./CardsChrome";

// 검색용 안내 페이지 공통 모양(/tarot-shuffle, /tarot-three-card — owner 2026-11-16). 글은 lib/guide/*.ts.
export default function GuideArticle({ jsonLd, h1, lead, sections, faq, links }: {
  jsonLd: unknown; h1: string; lead: string; sections: Section[]; faq: { q: string; a: string }[]; links: { href: string; label: string }[];
}) {
  const ld = JSON.stringify(jsonLd).replace(/</g, "\\u003c");
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld }} />
      <Link href="/" className="text-[13px] text-moon/70">
        ← 처음으로
      </Link>
      <p className="mt-6 text-center text-[13px] tracking-[10px] text-gold" aria-hidden>
        ✦ ✦ ✦
      </p>
      <h1 className="mt-2 break-keep text-center font-serif text-[24px] font-bold leading-snug text-gold-soft">{h1}</h1>
      <p className="mt-4 break-keep text-[15px] leading-7 text-moon/90">{lead}</p>
      {sections.map((s) => (
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
      <p className="mt-6 flex flex-col items-center gap-2 text-center text-[14px]">
        {[{ href: CARDS_PATH, label: "타로 카드 22장의 뜻 보기 →" }, ...links].map((l) => (
          <Link key={l.href} href={l.href} className="text-gold-soft underline underline-offset-4">
            {l.label}
          </Link>
        ))}
      </p>
      <CtaButton />
      <section className="mt-10">
        <h2 className="break-keep font-serif text-[19px] font-bold text-gold-soft">자주 묻는 질문</h2>
        <dl className="mt-3 flex flex-col gap-4">
          {faq.map((f) => (
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
