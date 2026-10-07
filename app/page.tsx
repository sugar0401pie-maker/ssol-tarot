import TarotFlow from "@/components/TarotFlow";
import { clientCopy, introFriends, PICK_COUNT } from "@/lib/server/clientData";

export default function Home() {
  return <TarotFlow copy={clientCopy()} pickCount={PICK_COUNT} friends={introFriends()} />;
}
