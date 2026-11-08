import type { Metadata, Viewport } from "next";
import { Noto_Sans_KR, Gowun_Batang } from "next/font/google";
import "../globals.css";
import "../auth.css";
import Analytics from "@/components/Analytics";
import { redirect } from "next/navigation";
import { EN_PAGES_HIDDEN } from "@/lib/i18n/enAccess";

// 영문판 뿌리 레이아웃(2026-11-05) — <html lang="en">. 한국어판은 app/(ko)/layout.tsx.
// 글꼴은 한국어판과 같은 것(영문 글자도 같은 모양) — 디자인을 그대로 맞추기 위해.
const notoSansKr = Noto_Sans_KR({ variable: "--font-noto-sans-kr", subsets: ["latin"], preload: false });
const gowunBatang = Gowun_Batang({ variable: "--font-gowun-batang", subsets: ["latin"], weight: ["400", "700"], preload: false });

// "fortune·prediction·destiny"는 메타 태그에도 쓰지 않는다(스펙 11장 2번과 같은 원칙).
const DESCRIPTION = "A self-reflection wellness tarot made by professional counselors. Think of your question, draw three cards, and get wellness practices that fit you.";
export const metadata: Metadata = {
  metadataBase: new URL("https://en.tarot.ssolwellnesshouse.com"),
  title: "SSOL Tarot House",
  description: DESCRIPTION,
  openGraph: { title: "SSOL Tarot House", description: DESCRIPTION, siteName: "SSOL Tarot House", locale: "en_US", type: "website" },
  twitter: { card: "summary_large_image", title: "SSOL Tarot House", description: DESCRIPTION },
  // 출시 전(영문 번역·카드 그림·해외 결제 준비 중)에는 검색에 올리지 않는다. 출시 때 EN_LAUNCHED=1.
  robots: process.env.EN_LAUNCHED === "1" ? undefined : { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#012F53" };

export default function EnRootLayout({ children }: LayoutProps<"/en">) {
  // 영문판 숨김 중이면 어느 영문 주소로 들어와도 한국어 첫 화면으로(lib/i18n/enAccess.ts)
  if (EN_PAGES_HIDDEN) redirect("/");
  return (
    <html lang="en" className={`${notoSansKr.variable} ${gowunBatang.variable} h-full antialiased`}>
      <body className="min-h-full">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
