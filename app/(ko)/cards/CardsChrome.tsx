import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";
import { CTA, DISCLAIMER } from "@/lib/about/content";

// 카드 소개 페이지 공통 아래쪽(테스트 버튼·고지·하단 정보) — /about과 같은 모양.
export const HOME = "https://tarot.ssolwellnesshouse.com/";

export function CtaButton() {
  return (
    <a href={HOME} className="btn-night mt-5 block w-full rounded-full py-4 text-center text-[16px] font-bold">
      {CTA}
    </a>
  );
}

export function CardsFooter() {
  return (
    <>
      <p className="mt-5 text-center text-[13px]">
        <Link href="/about" className="text-moon/80 underline underline-offset-2">
          쏠 타로 하우스 자세히 보기
        </Link>
      </p>
      <p className="mt-4 break-keep text-center text-[12px] leading-5 text-moon/70">
        타로 카드는 미래를 알려 주는 도구가 아니라 지금의 고민을 다른 각도에서 바라보게 돕는 자기 이해 도구예요. {DISCLAIMER}
      </p>
      <div className="mt-6">
        <SiteFooter />
      </div>
    </>
  );
}
