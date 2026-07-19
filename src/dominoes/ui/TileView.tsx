import type { Tile } from "../engine/tiles";
import { isDouble, tileId } from "../engine/tiles";

// Standard 3x3 domino pip layouts, cell indices 0..8 (row-major).
const PIP_LAYOUT: Record<number, number[]> = {
  0: [],
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function PipFace({ n, small }: { n: number; small?: boolean }) {
  const on = new Set(PIP_LAYOUT[n] ?? []);
  return (
    <div className={`pipface ${small ? "pipface--sm" : ""}`}>
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className={`pip ${on.has(i) ? "pip--on" : ""}`} />
      ))}
    </div>
  );
}

/**
 * A domino half laid vertically (for the board line, read top-to-bottom)
 * or horizontally (for the hand rack, read left-to-right).
 */
export function TileView({
  tile,
  vertical,
  small,
  onClick,
  disabled,
  playable,
}: {
  tile: Tile;
  /** Board orientation (stacked halves) vs hand orientation (side-by-side). */
  vertical?: boolean;
  small?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  playable?: boolean;
}) {
  const double = isDouble(tile);
  const cls = [
    "domino",
    vertical ? "domino--v" : "domino--h",
    double ? "domino--double" : "",
    small ? "domino--sm" : "",
    onClick && !disabled ? "domino--btn" : "",
    playable ? "domino--playable" : "",
    disabled ? "domino--dim" : "",
  ].filter(Boolean).join(" ");

  const inner = (
    <>
      <PipFace n={tile.a} small={small} />
      <span className="domino__divider" />
      <PipFace n={tile.b} small={small} />
    </>
  );

  return onClick ? (
    <button className={cls} onClick={onClick} disabled={disabled} aria-label={`${tile.a}-${tile.b}`}>
      {inner}
    </button>
  ) : (
    <div className={cls} key={tileId(tile)} aria-label={`${tile.a}-${tile.b}`}>
      {inner}
    </div>
  );
}

export function TileBack({ small }: { small?: boolean }) {
  return <div className={`domino domino--back ${small ? "domino--sm" : ""}`} aria-hidden />;
}
