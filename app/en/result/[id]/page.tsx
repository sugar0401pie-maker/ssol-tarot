import type { Metadata } from "next";
import ResultView from "@/components/ResultView";
import { clientCopy } from "@/lib/server/clientData";
import { resultParseOpts } from "@/lib/tarot-glue/v4";
import "../../../(ko)/result/[id]/result-v4.css";

export const metadata: Metadata = { title: "My Tarot Reading · Ssol Tarot House", robots: { index: false } };

// 영문판 결과(/en/result/{id}) — 한국어판과 같은 화면에 영어 문구.
export default async function EnResultPage({ params }: PageProps<"/en/result/[id]">) {
  const { id } = await params;
  return <ResultView id={id} copy={clientCopy("en")} opts={resultParseOpts("en")} locale="en" />;
}
