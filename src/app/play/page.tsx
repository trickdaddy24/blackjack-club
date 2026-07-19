import { TopBar } from "@/components/TopBar";
import { GameTable } from "@/components/GameTable";
import { QuestsBar } from "@/components/QuestsBar";
import { PropertyBonusBar } from "@/components/PropertyBonusBar";
import { VipStatusBar } from "@/components/VipStatusBar";
import { ChipWheelBar } from "@/components/ChipWheelBar";

export const metadata = {
  title: "The Table — Blackjack Club",
};

export default function PlayPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <VipStatusBar />
      <QuestsBar />
      <PropertyBonusBar />
      <ChipWheelBar />
      <GameTable />
    </div>
  );
}
