import Script from "next/script";
import { metaPixelId } from "@/lib/client/metaPixel";

// 메타(페이스북·인스타그램) 픽셀(owner 2026-11-16 — 메타 광고를 '랜딩 페이지 조회'로 최적화하려면 필요).
// 픽셀 ID는 Vercel 환경 변수 NEXT_PUBLIC_META_PIXEL_ID(숫자)에 둔다 — 없거나 모양이 다르면 아무것도 불러오지 않는다.
// 기본 PageView는 픽셀이 화면 주소 바뀜(pushState)도 자동으로 센다. 고민 글·닉네임·이메일은 보내지 않는다.
export default function MetaPixel() {
  const id = metaPixelId();
  if (!id) return null;
  return (
    <Script id="meta-pixel" strategy="afterInteractive">
      {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${id}');fbq('track','PageView');`}
    </Script>
  );
}
