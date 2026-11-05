import type { Metadata } from "next";
import CheckoutPage from "@/components/checkout/CheckoutPage";

export const metadata: Metadata = { title: "결제 · 쏠 타로 하우스", robots: { index: false } };

export default async function Checkout({ params, searchParams }: PageProps<"/checkout/[id]">) {
  const { id } = await params;
  const raw = (await searchParams).page;
  // 결제를 누른 결과 쪽 번호 — 결제 후 그 쪽으로 돌아간다
  const page = Math.min(11, Math.max(1, Number.parseInt(typeof raw === "string" ? raw : "5", 10) || 5));
  return <CheckoutPage id={id} page={page} />;
}
