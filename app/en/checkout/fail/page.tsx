import type { Metadata } from "next";
import { Suspense } from "react";
import CheckoutFail from "@/components/checkout/CheckoutFail";

export const metadata: Metadata = { title: "Checkout · Ssol Tarot House", robots: { index: false } };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CheckoutFail locale="en" />
    </Suspense>
  );
}
