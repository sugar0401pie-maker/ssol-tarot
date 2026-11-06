import type { Metadata } from "next";
import ResultsList from "@/components/ResultsList";

export const metadata: Metadata = { title: "My Readings · Ssol Tarot House", robots: { index: false } };

// 영문 내 결과 목록(/en/results) — 하단 'My readings'가 오는 곳. 한국어판 /results와 같은 목록에 영어 문구.
export default function EnResultsPage() {
  return <ResultsList locale="en" />;
}
