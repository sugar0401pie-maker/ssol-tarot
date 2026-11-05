import type { Metadata } from "next";
import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";
import { currentReportPrice, won } from "@/lib/billing/pricing";
import { DISPLAY_PARTICIPANTS, asOfDots } from "@/lib/stats/participants";
import {
  ABOUT_PATH,
  CTA,
  DISCLAIMER,
  H1,
  HOW,
  HOW_TITLE,
  INTRO,
  SOWELLA_CTA,
  SOWELLA_URL,
  MAKERS,
  MAKERS_TITLE,
  aboutDescription,
  aboutJsonLd,
  aboutTitle,
  atAGlance,
  faqGroups,
  participantsLine,
  steps,
} from "@/lib/about/content";

// 테스트 상세 소개(SEO, owner 2026-11-04). 로그인 확인·로딩 화면 없이 서버에서 그대로 그린 HTML(검색엔진이 바로 읽음).
// 가격은 할인 종료(12-01)에 맞춰 바뀌어야 해서 1시간마다 다시 만든다.
export const revalidate = 3600;

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://tarot.ssolwellnesshouse.com";
const HOME = "https://tarot.ssolwellnesshouse.com/";

export function generateMetadata(): Metadata {
  const description = aboutDescription(won(currentReportPrice()));
  return {
    title: { absolute: aboutTitle },
    description,
    alternates: { canonical: `${SITE}${ABOUT_PATH}` },
    openGraph: { title: aboutTitle, description, type: "website", locale: "ko_KR", siteName: "쏠 타로 하우스", url: `${SITE}${ABOUT_PATH}` },
    twitter: { card: "summary_large_image", title: aboutTitle, description },
  };
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-8 font-serif text-[19px] font-bold text-navy">{children}</h2>;
}

function CtaButton() {
  return (
    <a href={HOME} className="btn-night mt-5 block w-full rounded-full py-4 text-center text-[16px] font-bold">
      {CTA}
    </a>
  );
}

export default function AboutPage() {
  const price = won(currentReportPrice());
  const jsonLd = JSON.stringify(aboutJsonLd(SITE, price)).replace(/</g, "\\u003c");
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <Link href="/" className="text-[13px] text-moon/70">
        ← 처음으로
      </Link>

      <p className="mt-6 text-center text-[13px] tracking-[10px] text-gold" aria-hidden>
        ✦ ✦ ✦
      </p>
      <h1 className="mt-2 break-keep text-center font-serif text-[24px] font-bold leading-snug text-gold-soft">{H1}</h1>
      <p className="mt-4 break-keep text-[15px] leading-7 text-moon/90">{INTRO}</p>
      <p className="mt-3 text-center text-[12px] text-moon/80">{participantsLine(DISPLAY_PARTICIPANTS, asOfDots())}</p>
      <CtaButton />

      <div className="mt-8 break-keep rounded-2xl bg-card-cream px-5 py-6 text-navy">
        <h2 className="font-serif text-[19px] font-bold text-navy">한눈에 보기</h2>
        <table className="mt-3 w-full border-collapse text-[14px] leading-6">
          <tbody>
            {atAGlance(price).map(([k, v]) => (
              <tr key={k} className="border-b border-navy/10 last:border-0">
                <th scope="row" className="w-[30%] py-2.5 pr-3 text-left align-top font-semibold">
                  {k}
                </th>
                <td className="py-2.5 text-navy/85">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <H2>이용 순서</H2>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-[14px] leading-6 text-navy/85">
          {steps(price).map((s, i) => (
            <li key={i}>
              {s.before}
              <strong className="text-navy">{s.strong}</strong>
              {s.rest}
            </li>
          ))}
        </ol>

        <H2>{HOW_TITLE}</H2>
        <p className="mt-3 text-[14px] leading-6 text-navy/85">{HOW}</p>

        <H2>{MAKERS_TITLE}</H2>
        <p className="mt-3 text-[14px] leading-6 text-navy/85">{MAKERS}</p>

        <H2>자주 묻는 질문</H2>
        {faqGroups(price).map((g) => (
          <section key={g.title} className="mt-4">
            <p className="text-[13px] font-semibold text-navy/60">{g.title}</p>
            {g.items.map((f) => (
              <div key={f.q} className="mt-3">
                <h3 className="text-[15px] font-semibold text-navy">Q. {f.q}</h3>
                <p className="mt-1 text-[14px] leading-6 text-navy/85">{f.a}</p>
              </div>
            ))}
          </section>
        ))}
        {/* ⏸ 개정 약관 확정 후 약관 문구와 똑같이 게시:
            Q. 내가 쓴 고민은 어떻게 쓰이나요?
            Q. 환불이 되나요? (이용약관의 결제·환불 조항과 똑같이) */}
      </div>

      <CtaButton />
      {/* 맨 아래 쏘웰라 연결(owner 2026-11-05) — 보조 버튼 모양 */}
      <a href={SOWELLA_URL} className="btn-night-ghost mt-3 block w-full rounded-full py-4 text-center text-[16px] font-bold">
        {SOWELLA_CTA}
      </a>
      <p className="mt-5 break-keep text-center text-[12px] leading-5 text-moon/70">{DISCLAIMER}</p>
      <div className="mt-6">
        <SiteFooter />
      </div>
    </main>
  );
}
