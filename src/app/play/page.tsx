import { TopBar } from "@/components/TopBar";
import { GameTable } from "@/components/GameTable";
import { QuestsBar } from "@/components/QuestsBar";
import { PropertyBonusBar } from "@/components/PropertyBonusBar";

export const metadata = {
  title: "The Table — Blackjack Club",
};

export default function PlayPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <QuestsBar />
      <PropertyBonusBar />
      <GameTable />
    </div>
  );
}
