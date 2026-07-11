import type { Card } from "../engine/cards";
import { cardLabel, isRed } from "../engine/cards";

const RANK_LABEL: Record<number, string> = {
  2: "2", 3: "3", 4: "4", 5: "5", 6: "6", 7: "7", 8: "8", 9: "9", 10: "10",
  11: "J", 12: "Q", 13: "K", 14: "A",
};
const SUIT_LABEL: Record<string, string> = { C: "♣", D: "♦", H: "♥", S: "♠" };

export function CardView({
  card, onClick, disabled, playable, small,
}: {
  card: Card;
  onClick?: () => void;
  disabled?: boolean;
  playable?: boolean;
  small?: boolean;
}) {
  const red = isRed(card);
  const cls = [
    "card",
    small ? "card--sm" : "",
    red ? "card--red" : "card--black",
    onClick && !disabled ? "card--btn" : "",
    playable ? "card--playable" : "",
    disabled ? "card--dim" : "",
  ].filter(Boolean).join(" ");

  const inner = (
    <>
      <span className="card__rank">{RANK_LABEL[card.rank]}</span>
      <span className="card__suit">{SUIT_LABEL[card.suit]}</span>
    </>
  );

  return onClick ? (
    <button className={cls} onClick={onClick} disabled={disabled} aria-label={cardLabel(card)}>
      {inner}
    </button>
  ) : (
    <div className={cls} aria-label={cardLabel(card)}>{inner}</div>
  );
}

export function CardBack({ small }: { small?: boolean }) {
  return <div className={`card card--back ${small ? "card--sm" : ""}`} aria-hidden />;
}
