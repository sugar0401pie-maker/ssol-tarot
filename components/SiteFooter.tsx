// 하단 사업자 정보 — owner 2026-10-21 전달 문구 그대로(쏠 아스트로 하우스 SiteFooter와 같은 내용·모양, app/auth.css .site-foot).
// 약관·개인정보처리방침은 이 사이트의 /legal.
import Link from "next/link";
import { PRIVACY_URL, TERMS_URL } from "@/lib/legal/urls";

export default function SiteFooter() {
  return (
    <footer className="site-foot">
      <p className="ln">
        <a href="https://ssolwellnesshouse.com" target="_blank" rel="noopener">
          by 쏠 웰니스 하우스
        </a>
      </p>
      <p className="ln">
        {/* 법적 고지 페이지가 길어 화면에 보이기만 해도 미리 받지 않게(아스트로 2026-10-18과 같은 이유) */}
        <Link href={PRIVACY_URL} prefetch={false}>개인정보처리방침</Link> · <Link href={TERMS_URL} prefetch={false}>이용약관</Link>
      </p>
      <p>쏠 웰니스 하우스 · 대표 김준석 · 사업자등록번호 572-07-03549</p>
      <p>서울시 마포구 독막로 100 4층 408호</p>
      <p>010-2835-2263 · contact@ssolwellness.com</p>
    </footer>
  );
}
