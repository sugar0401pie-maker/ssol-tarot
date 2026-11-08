// 영문판 하단. 영문 사업자 정보(Imprint)는 owner가 나중에 보내기로 함(2026-11-05) — 받으면 아래 자리와 /en/imprint에 넣는다.
// 정책 페이지(/en/legal)는 3단계에서 만든다 — 그전까지 링크는 연락처만.
import { KO_SWITCH_URL } from "@/lib/site/routing";

export default function SiteFooterEn() {
  return (
    <footer className="site-foot">
      <p className="ln">
        <a href="https://ssolwellnesshouse.com" target="_blank" rel="noopener">
          by SSOL Wellness House
        </a>
      </p>
      <p>contact@ssolwellness.com</p>
      {/* 해외 IP로 영문 사이트에 온 한국어 사용자용 — 누르면 그 기기는 다시 영문 사이트로 보내지 않음(lib/site/routing.ts) */}
      <p className="ln">
        <a href={KO_SWITCH_URL} lang="ko">한국어로 보기</a>
      </p>
    </footer>
  );
}
