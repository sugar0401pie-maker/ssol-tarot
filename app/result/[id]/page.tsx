import type { Metadata } from "next";
import ResultView from "@/components/ResultView";
import { clientCopy } from "@/lib/server/clientData";
import { resultParseOpts } from "@/lib/tarot-glue/v4";
import "./result-v4.css";

export const metadata: Metadata = { title: "나의 타로 결과 · 쏠 타로 하우스", robots: { index: false } };

export default async function ResultPage({ params }: PageProps<"/result/[id]">) {
  const { id } = await params;
  return <ResultView id={id} copy={clientCopy()} opts={resultParseOpts()} />;
}
