import type { Metadata, Viewport } from "next";
import { Noto_Sans_KR, Gowun_Batang } from "next/font/google";
import "./globals.css";

const notoSansKr = Noto_Sans_KR({ variable: "--font-noto-sans-kr", subsets: ["latin"], weight: ["400", "500", "700"] });
// 디자인 가이드 3장: 큰 인사·카드명·섹션 제목은 고운바탕 700, 본문은 Noto Sans KR.
const gowunBatang = Gowun_Batang({ variable: "--font-gowun-batang", subsets: ["latin"], weight: ["400", "700"] });

// "예언·운명·맞힌다"는 메타 태그에도 쓰지 않는다(스펙 11장 2번).
export const metadata: Metadata = {
  title: "쏠 타로 하우스",
  description: "전문 심리상담사가 만든 자기이해 웰니스 타로. 고민을 떠올리며 세 장의 카드를 뽑고 웰니스 실천을 제안받아요.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#012F53" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${notoSansKr.variable} ${gowunBatang.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
