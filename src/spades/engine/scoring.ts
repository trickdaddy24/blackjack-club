import type {
  Bid, HandResult, Seat, TeamHandResult, TeamScore,
} from "./types";
import { teamOf } from "./types";

// Standard partnership scoring.
export const NIL_BONUS = 100;
export const BLIND_NIL_BONUS = 200;
export const BAG_LIMIT = 10;        // 10 accumulated bags → penalty
export const BAG_PENALTY = 100;     // subtracted when the limit is crossed

/**
 * Score one completed hand for both teams and return the new cumulative scores.
 *
 * Contract (non-nil bidders on a team):
 *   made ≥ contract → 10 × contract, plus 1 "bag" per overtrick.
 *   made < contract → −10 × contract ("set"), no bags.
 * Nil (bid 0): the individual makes it by taking ZERO tricks → +100 (+200 blind),
 *   fails → −100 (−200). A failed nil-taker's tricks still count as bags for the
 *   team, but never toward a set partner's contract.
 * Bags: each team's running bag count; crossing a multiple of 10 subtracts 100
 *   and the count rolls over (keeps the remainder).
 */
export function scoreHand(
  bids: (Bid | null)[],
  tricksWon: number[],
  teamScores: [TeamScore, TeamScore],
  handNumber: number,
): { teamScores: [TeamScore, TeamScore]; result: HandResult } {
  const perTeam: TeamHandResult[] = [teamResult(0), teamResult(1)];

  function teamResult(team: 0 | 1): TeamHandResult {
    const seats = [0, 1, 2, 3].filter((s) => teamOf(s as Seat) === team) as Seat[];

    let contract = 0;       // sum of non-nil bids
    let points = 0;
    let contractTricks = 0; // tricks from the non-nil partner(s)
    const nilResults: TeamHandResult["nilResults"] = [];

    for (const seat of seats) {
      const bid = bids[seat];
      const took = tricksWon[seat];
      if (!bid) continue;

      if (bid.tricks === 0) {
        const made = took === 0;
        const bonus = bid.blind ? BLIND_NIL_BONUS : NIL_BONUS;
        const p = made ? bonus : -bonus;
        points += p;
        nilResults.push({ seat, bid, made, points: p });
        // A failed nil's tricks become team bags (added below via overtricks),
        // and are NOT applied to the partner's contract.
      } else {
        contract += bid.tricks;
        contractTricks += took;
      }
    }

    // Tricks taken by nil-bidders (successful nils took 0, so this is just the
    // overflow from failed nils) count as bags for the team.
    const nilTricks = seats
      .filter((s) => bids[s]?.tricks === 0)
      .reduce<number>((sum, s) => sum + tricksWon[s], 0);

    let bagsGained = 0;
    if (contract > 0) {
      if (contractTricks >= contract) {
        points += 10 * contract;
        bagsGained += contractTricks - contract; // overtricks
      } else {
        points -= 10 * contract; // set
      }
    }
    bagsGained += nilTricks;

    return {
      bidTotal: contract,
      tricks: seats.reduce<number>((sum, s) => sum + tricksWon[s], 0),
      points,
      bagsGained,
      bagPenalty: 0,   // filled in after bag rollover below
      nilResults,
    };
  }

  const newScores: [TeamScore, TeamScore] = [
    { ...teamScores[0] },
    { ...teamScores[1] },
  ];

  for (const team of [0, 1] as const) {
    const r = perTeam[team];
    const ts = newScores[team];

    let bags = ts.bags + r.bagsGained;
    let penalty = 0;
    while (bags >= BAG_LIMIT) {
      penalty += BAG_PENALTY;
      bags -= BAG_LIMIT;
    }
    r.bagPenalty = -penalty;

    ts.score += r.points - penalty;
    ts.bags = bags;
  }

  return {
    teamScores: newScores,
    result: { handNumber, teams: [perTeam[0], perTeam[1]] },
  };
}
