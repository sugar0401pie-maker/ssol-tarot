import AuthFooterLink from "./auth/AuthFooterLink";
import SiteFooter from "./SiteFooter";

// 화면 맨 아래: '내 결과 · 로그아웃'(또는 '로그인') + 사업자 정보(owner 2026-10-21, 아스트로 .intro-foot과 같은 배치).
export default function PageFoot() {
  return (
    <div className="page-foot relative z-[1]">
      <AuthFooterLink />
      <SiteFooter />
    </div>
  );
}
