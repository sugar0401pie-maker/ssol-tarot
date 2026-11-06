import type { Metadata } from "next";
import CheckoutPageEn from "@/components/checkout/CheckoutPageEn";

export const metadata: Metadata = { title: "Checkout · Ssol Tarot House", robots: { index: false } };

// 영문 결제 화면 — 한국어판과 따로 만든 화면(달러, 해외 카드·PayPal, 영문 동의 문구)
export default async function EnCheckout({ params, searchParams }: PageProps<"/en/checkout/[id]">) {
  const { id } = await params;
  const raw = (await searchParams).page;
  const page = Math.min(11, Math.max(1, Number.parseInt(typeof raw === "string" ? raw : "4", 10) || 4));
  return <CheckoutPageEn id={id} page={page} />;
}
