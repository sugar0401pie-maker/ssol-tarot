import type { Metadata } from "next";
import ResultsList from "@/components/ResultsList";

export const metadata: Metadata = { title: "내 결과 · 쏠 타로 하우스" };

export default function ResultsPage() {
  return <ResultsList />;
}
