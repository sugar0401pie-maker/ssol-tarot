import TarotFlow from "@/components/TarotFlow";
import { clientCopy, introFriends, PICK_COUNT } from "@/lib/server/clientData";
import { loadSceneArt } from "@/lib/server/sceneArt";

export default function EnHome() {
  return <TarotFlow locale="en" copy={clientCopy("en")} pickCount={PICK_COUNT} friends={introFriends("en")} sceneArt={loadSceneArt()} />;
}
