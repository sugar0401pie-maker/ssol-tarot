import { notFound } from "next/navigation";
import TarotFlow from "@/components/TarotFlow";
import { clientCopy, introFriends, PICK_COUNT } from "@/lib/server/clientData";
import { loadSceneArt } from "@/lib/server/sceneArt";
import { STEP_PATH, stepFromPath } from "@/lib/client/steps";

// 테스트 화면별 주소(/welcome, /experience, /first-time, /worry, /shuffle, /draw, /reveal, /loading, /safety — owner 2026-10-21).
// 정해진 이름만 열고 나머지는 404. 화면은 첫 화면과 같은 TarotFlow이고, 주소로 바로 들어오면 환영 화면부터 다시 시작한다.
export const dynamicParams = false;
export function generateStaticParams() {
  return Object.values(STEP_PATH)
    .filter((p) => p !== "/")
    .map((p) => ({ step: p.slice(1) }));
}

export default async function StepPage({ params }: PageProps<"/[step]">) {
  const { step } = await params;
  const s = stepFromPath(`/${step}`);
  if (!s) notFound();
  return <TarotFlow copy={clientCopy()} pickCount={PICK_COUNT} friends={introFriends()} sceneArt={loadSceneArt()} initialStep={s} />;
}
