import Script from "next/script";

// X(트위터) 전환 추적 기본 코드(owner 2026-11-25, 한국어 사이트만). 픽셀 ID rk3w9 = owner가 준 코드 그대로,
// Vercel 환경 변수 NEXT_PUBLIC_X_PIXEL_ID가 있으면 그 값. 방문 정보만 가고 고민 글·닉네임·이메일은 보내지 않는다.
// 개인정보처리방침 처리위탁 표·9항에 X Corp. 전환 추적 고지가 이미 있다.
const X_PIXEL_ID = process.env.NEXT_PUBLIC_X_PIXEL_ID || "rk3w9";

export default function XPixel() {
  if (!/^[a-z0-9]{4,12}$/i.test(X_PIXEL_ID)) return null;
  return (
    <Script id="x-pixel" strategy="afterInteractive">
      {`!function(e,t,n,s,u,a){e.twq||(s=e.twq=function(){s.exe?s.exe.apply(s,arguments):s.queue.push(arguments);},s.version='1.1',s.queue=[],u=t.createElement(n),u.async=!0,u.src='https://static.ads-twitter.com/uwt.js',a=t.getElementsByTagName(n)[0],a.parentNode.insertBefore(u,a))}(window,document,'script');twq('config','${X_PIXEL_ID}');`}
    </Script>
  );
}
