import type { Card } from "../engine/cards";
import { SUIT_COLOR, SUIT_SYMBOL, rankLabel } from "../engine/cards";

/** Face-up playing card. `meld` highlights a safely-melded card, `dead` a deadwood one. */
export function CardView({
  card, onClick, disabled, meld, dead, small,
}: {
  card: Card;
  onClick?: () => void;
  disabled?: boolean;
  meld?: boolean;
  dead?: boolean;
  small?: boolean;
}) {
  const cls = [
    "tk-card", `tk-card--${SUIT_COLOR[card.suit]}`,
    small ? "tk-card--sm" : "",
    onClick && !disabled ? "tk-card--btn" : "",
    meld ? "tk-card--meld" : "",
    dead ? "tk-card--dead" : "",
    disabled ? "tk-card--dim" : "",
  ].filter(Boolean).join(" ");

  const label = rankLabel(card.rank);
  const symbol = SUIT_SYMBOL[card.suit];
  const aria = `${label} of ${card.suit}`;

  const inner = (
    <>
      <span className="tk-card__corner tk-card__corner--tl">{label}<br />{symbol}</span>
      <span className="tk-card__center">{symbol}</span>
      <span className="tk-card__corner tk-card__corner--br">{label}<br />{symbol}</span>
    </>
  );

  return onClick ? (
    <button className={cls} onClick={onClick} disabled={disabled} aria-label={aria}>{inner}</button>
  ) : (
    <div className={cls} aria-label={aria}>{inner}</div>
  );
}

export function CardBack({ small, onClick, disabled }: { small?: boolean; onClick?: () => void; disabled?: boolean }) {
  const cls = `tk-card tk-card--back ${small ? "tk-card--sm" : ""} ${onClick ? "tk-card--btn" : ""}`;
  return onClick ? (
    <button className={cls} onClick={onClick} disabled={disabled} aria-label="Draw pile" />
  ) : (
    <div className={cls} aria-hidden />
  );
}
