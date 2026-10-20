import TarotFlow from "@/components/TarotFlow";
import { clientCopy, introFriends, PICK_COUNT } from "@/lib/server/clientData";
import { loadSceneArt } from "@/lib/server/sceneArt";

export default function Home() {
  return <TarotFlow copy={clientCopy()} pickCount={PICK_COUNT} friends={introFriends()} sceneArt={loadSceneArt()} />;
}
