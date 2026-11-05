import type { Metadata } from "next";
import { Suspense } from "react";
import CheckoutFail from "@/components/checkout/CheckoutFail";

export const metadata: Metadata = { title: "결제 · 쏠 타로 하우스", robots: { index: false } };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CheckoutFail />
    </Suspense>
  );
}
