import { TopBar } from "@/components/TopBar";
import { GameTable } from "@/components/GameTable";

export const metadata = {
  title: "The Table — Blackjack Club",
};

export default function PlayPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <GameTable />
    </div>
  );
}
