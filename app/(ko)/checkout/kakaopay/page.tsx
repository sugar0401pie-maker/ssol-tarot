import type { Metadata } from "next";
import { Suspense } from "react";
import KakaoPaySuccess from "@/components/checkout/KakaoPaySuccess";

// 카카오페이 결제를 마치고 돌아오는 화면(owner 2026-11-18) — 장면마다 자기 주소 규칙대로 토스(/checkout/success)와 따로.
export const metadata: Metadata = { title: "결제 · 쏠 타로 하우스", robots: { index: false } };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <KakaoPaySuccess />
    </Suspense>
  );
}
