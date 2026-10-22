import type { Metadata, Viewport } from "next";
import { Noto_Sans_KR, Gowun_Batang } from "next/font/google";
import "./globals.css";
import "./auth.css";

// 글꼴 가볍게(쏠 아스트로 하우스 2026-10-18과 같은 방법): 한글 글꼴은 글자 범위별로 조각이 100개 가까이라
// 미리 받기를 켜 두면 화면에 안 쓰는 조각까지 먼저 받는다 → preload: false(화면에 나온 글자 조각만 받음).
// Noto Sans KR은 굵기를 따로 두지 않고 가변 글꼴 하나로(400·500·700 모두 이 하나로 나옴, 글꼴 선언 수가 1/3).
const notoSansKr = Noto_Sans_KR({ variable: "--font-noto-sans-kr", subsets: ["latin"], preload: false });
// 디자인 가이드 3장: 큰 인사·카드명·섹션 제목은 고운바탕 700, 본문은 Noto Sans KR. (고운바탕은 가변 글꼴이 아님)
const gowunBatang = Gowun_Batang({ variable: "--font-gowun-batang", subsets: ["latin"], weight: ["400", "700"], preload: false });

// "예언·운명·맞힌다"는 메타 태그에도 쓰지 않는다(스펙 11장 2번).
// 링크를 붙여 넣었을 때의 미리보기(카카오톡·메신저): 그림은 app/opengraph-image.jpg(카드 뒷면 세 장, scripts/make_share_images.mjs).
const DESCRIPTION = "전문 심리상담사가 만든 자기이해 웰니스 타로. 고민을 떠올리며 세 장의 카드를 뽑고 웰니스 실천을 제안받아요.";
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://tarot.ssolwellnesshouse.com"),
  title: "쏠 타로 하우스",
  description: DESCRIPTION,
  openGraph: { title: "쏠 타로 하우스", description: DESCRIPTION, siteName: "쏠 타로 하우스", locale: "ko_KR", type: "website" },
  twitter: { card: "summary_large_image", title: "쏠 타로 하우스", description: DESCRIPTION },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#012F53" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${notoSansKr.variable} ${gowunBatang.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
