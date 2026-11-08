// 영문판 하단(기획 08 문서 6장 — 모든 영문 화면). 정책 링크 + 사업자 정보(한국어 SiteFooter와 같은 사업자, 영문 표기) + 한국어로 보기.
// 문서·사업자 정보는 lib/legal/en.ts. 쿠키 설정·Do Not Sell 링크는 쿠키 배너를 만들 때 함께 넣는다(지금은 분석·광고 쿠키를 쓰지 않음).
import Link from "next/link";
import { EN_BUSINESS as B, EN_DOCS, EN_IMPRINT_URL, enLegalUrl } from "@/lib/legal/en";
import { KO_SWITCH_URL } from "@/lib/site/routing";

export default function SiteFooterEn() {
  return (
    <footer className="site-foot">
      <p className="ln">
        <a href="https://ssolwellnesshouse.com" target="_blank" rel="noopener">
          by SSOL Wellness House
        </a>
      </p>
      <p className="ln">
        <Link href={EN_IMPRINT_URL} prefetch={false}>
          Imprint (Impressum)
        </Link>
        {EN_DOCS.filter((d) => d.id !== "worry-consent").map((d) => (
          <span key={d.id}>
            {" · "}
            <Link href={enLegalUrl(d.id)} prefetch={false}>
              {d.label}
            </Link>
          </span>
        ))}
      </p>
      <p>
        {B.name} · Representative: {B.representative} · Business registration no. {B.businessNo} · Mail-order business registration no. {B.mailOrderNo}
      </p>
      <p>{B.address}</p>
      <p>
        Contact number: {B.phone} · {B.email}
      </p>
      <p>© 2026 {B.name}</p>
      {/* 해외 IP로 영문 사이트에 온 한국어 사용자용 — 누르면 그 기기는 다시 영문 사이트로 보내지 않음(lib/site/routing.ts) */}
      <p className="ln">
        <a href={KO_SWITCH_URL} lang="ko">
          한국어로 보기
        </a>
      </p>
    </footer>
  );
}
