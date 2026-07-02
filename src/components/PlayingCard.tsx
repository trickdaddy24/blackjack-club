import type { Card } from "@/lib/blackjack/engine";

const SUIT_GLYPH: Record<string, string> = {
  S: "♠",
  H: "♥",
  D: "♦",
  C: "♣",
};

export function PlayingCard({
  card,
  dealDelay = 0,
  flip = false,
}: {
  /** null renders the face-down card back (dealer hole card). */
  card: Card | null;
  /** Stagger for the deal-in animation, in ms. */
  dealDelay?: number;
  /** Use the flip-reveal animation instead of deal-in. */
  flip?: boolean;
}) {
  if (!card) {
    return (
      <div
        className="pcard pcard-back deal-in"
        style={{ animationDelay: `${dealDelay}ms` }}
        aria-label="Face-down card"
      />
    );
  }

  const red = card.suit === "H" || card.suit === "D";
  const glyph = SUIT_GLYPH[card.suit];

  return (
    <div
      className={`pcard ${red ? "red" : ""} ${flip ? "flip-reveal" : "deal-in"}`}
      style={{ animationDelay: `${dealDelay}ms` }}
      aria-label={`${card.rank} of ${card.suit}`}
    >
      <span className="corner">
        {card.rank}
        <span className="suit">{glyph}</span>
      </span>
      <span className="pip">{glyph}</span>
      <span className="corner br">
        {card.rank}
        <span className="suit">{glyph}</span>
      </span>
    </div>
  );
}
