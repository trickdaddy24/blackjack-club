import type { Card } from "../engine/cards";
import { COLOR_NAME, isWild, kindLabel } from "../engine/cards";

/** Face-up card. Wilds render a four-color quadrant badge. */
export function CardView({
  card, onClick, disabled, playable, small,
}: {
  card: Card;
  onClick?: () => void;
  disabled?: boolean;
  playable?: boolean;
  small?: boolean;
}) {
  const colorCls = card.color ? `wc-card--${card.color}` : "wc-card--wild";
  const cls = [
    "wc-card", colorCls,
    small ? "wc-card--sm" : "",
    onClick && !disabled ? "wc-card--btn" : "",
    playable ? "wc-card--playable" : "",
    disabled ? "wc-card--dim" : "",
  ].filter(Boolean).join(" ");

  const label = kindLabel(card.kind);
  const aria = card.color ? `${COLOR_NAME[card.color]} ${label}` : `Wild ${label}`;

  const inner = (
    <>
      <span className="wc-card__corner wc-card__corner--tl">{label}</span>
      <span className="wc-card__center">
        {isWild(card) ? <WildBadge label={label} /> : label}
      </span>
      <span className="wc-card__corner wc-card__corner--br">{label}</span>
    </>
  );

  return onClick ? (
    <button className={cls} onClick={onClick} disabled={disabled} aria-label={aria}>
      {inner}
    </button>
  ) : (
    <div className={cls} aria-label={aria}>{inner}</div>
  );
}

function WildBadge({ label }: { label: string }) {
  return (
    <span className="wc-wildbadge">
      <span className="wc-wildbadge__q wc-wildbadge__q--R" />
      <span className="wc-wildbadge__q wc-wildbadge__q--Y" />
      <span className="wc-wildbadge__q wc-wildbadge__q--G" />
      <span className="wc-wildbadge__q wc-wildbadge__q--B" />
      <span className="wc-wildbadge__label">{label}</span>
    </span>
  );
}

export function CardBack({ small }: { small?: boolean }) {
  return <div className={`wc-card wc-card--back ${small ? "wc-card--sm" : ""}`} aria-hidden />;
}
