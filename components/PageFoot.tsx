import AuthFooterLink from "./auth/AuthFooterLink";
import SiteFooter from "./SiteFooter";
import SiteFooterEn from "./SiteFooterEn";
import type { Locale } from "@/lib/i18n/locale";

// 화면 맨 아래: '내 결과 · 로그아웃'(또는 '로그인') + 사업자 정보(owner 2026-10-21, 아스트로 .intro-foot과 같은 배치).
// 영문판은 영어 하단(사업자 영문 정보는 owner가 나중에 전달 — SiteFooterEn).
export default function PageFoot({ locale = "ko" }: { locale?: Locale }) {
  return (
    <div className="page-foot relative z-[1]">
      <AuthFooterLink locale={locale} />
      {locale === "en" ? <SiteFooterEn /> : <SiteFooter />}
    </div>
  );
}
