import Script from "next/script";

// 구글 애널리틱스(GA4, owner 2026-11-02). 측정 ID는 Vercel 환경 변수 NEXT_PUBLIC_GA_ID(예: G-ABC123)에만 둔다 —
// 값이 없거나 모양이 다르면 아무것도 불러오지 않는다. 화면 주소(쪽 번호·결과 id)와 방문 정보만 가고, 고민 글·닉네임은 보내지 않는다.
// 화면이 바뀔 때 주소만 바꾸는(pushState) 흐름은 GA4의 '향상된 측정(브라우저 기록 기반 페이지 변경)'이 자동으로 센다.
// 측정 ID는 비밀값이 아니라(사이트 HTML에 그대로 보임) 기본값으로 둔다(owner 2026-11-03). 환경 변수가 있으면 그 값이 우선.
const GA_ID = process.env.NEXT_PUBLIC_GA_ID || "G-NGY2P2H190";

export default function Analytics() {
  if (!/^G-[A-Z0-9]+$/.test(GA_ID)) return null;
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      <Script id="ga4" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');`}
      </Script>
    </>
  );
}
