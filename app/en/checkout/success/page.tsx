import type { Metadata } from "next";
import { Suspense } from "react";
import CheckoutSuccess from "@/components/checkout/CheckoutSuccess";

export const metadata: Metadata = { title: "Checkout · Ssol Tarot House", robots: { index: false } };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CheckoutSuccess locale="en" />
    </Suspense>
  );
}
