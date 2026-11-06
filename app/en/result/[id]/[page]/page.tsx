import type { Metadata } from "next";
import ResultView from "@/components/ResultView";
import { clientCopy } from "@/lib/server/clientData";
import { resultParseOpts } from "@/lib/tarot-glue/v4";
import "../../../../(ko)/result/[id]/result-v4.css";

export const metadata: Metadata = { title: "My Tarot Reading · Ssol Tarot House", robots: { index: false } };

// 영문판 결과 한 쪽(/en/result/{id}/{쪽}) — 한국어판 /result/{id}/{쪽}과 같은 규칙.
export default async function EnResultPageAt({ params }: PageProps<"/en/result/[id]/[page]">) {
  const { id, page } = await params;
  const n = Number.parseInt(page, 10);
  return <ResultView id={id} copy={clientCopy("en")} opts={resultParseOpts("en")} locale="en" initialPage={Number.isFinite(n) && n >= 1 ? n : 1} />;
}
