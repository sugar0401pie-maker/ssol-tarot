import { notFound } from "next/navigation";
import TarotFlow from "@/components/TarotFlow";
import { clientCopy, introFriends, PICK_COUNT } from "@/lib/server/clientData";
import { loadSceneArt } from "@/lib/server/sceneArt";
import { STEP_PATH, stepFromPath } from "@/lib/client/steps";

// 영문판 테스트 화면별 주소(/en/welcome … /en/safety) — 한국어판 app/(ko)/[step]과 같은 이름.
export const dynamicParams = false;
export function generateStaticParams() {
  return Object.values(STEP_PATH)
    .filter((p) => p !== "/")
    .map((p) => ({ step: p.slice(1) }));
}

export default async function EnStepPage({ params }: PageProps<"/en/[step]">) {
  const { step } = await params;
  const s = stepFromPath(`/${step}`);
  if (!s) notFound();
  return <TarotFlow locale="en" copy={clientCopy("en")} pickCount={PICK_COUNT} friends={introFriends("en")} sceneArt={loadSceneArt()} initialStep={s} />;
}
