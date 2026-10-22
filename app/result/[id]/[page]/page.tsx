import type { Metadata } from "next";
import ResultView from "@/components/ResultView";
import { clientCopy } from "@/lib/server/clientData";
import { resultParseOpts } from "@/lib/tarot-glue/v4";
import "../result-v4.css";

export const metadata: Metadata = { title: "나의 타로 결과 · 쏠 타로 하우스", robots: { index: false } };

// 결과 한 쪽의 주소(/result/{id}/{1~11}, owner 2026-10-21). 화면은 /result/{id}와 같고 그 쪽부터 보여 준다.
// 쪽 번호가 숫자가 아니면 1쪽부터(실제 쪽 수 안으로는 화면에서 맞춘다).
export default async function ResultPageAt({ params }: PageProps<"/result/[id]/[page]">) {
  const { id, page } = await params;
  const n = Number.parseInt(page, 10);
  return <ResultView id={id} copy={clientCopy()} opts={resultParseOpts()} initialPage={Number.isFinite(n) && n >= 1 ? n : 1} />;
}
