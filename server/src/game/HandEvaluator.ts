import { Card } from '../types';

const RANK_ORDER = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function rankValue(rank: string): number {
  return RANK_ORDER.indexOf(rank) + 2;
}

function rankName(value: number): string {
  if (value === 14) return 'Ace';
  if (value === 13) return 'King';
  if (value === 12) return 'Queen';
  if (value === 11) return 'Jack';
  return String(value);
}

export interface HandResult {
  rank: number;
  tiebreakers: number[];
  description: string;
}

function getCombinations<T>(arr: T[], size: number): T[][] {
  if (size === 0) return [[]];
  if (arr.length < size) return [];
  const [first, ...rest] = arr;
  const withFirst = getCombinations(rest, size - 1).map(combo => [first, ...combo]);
  const withoutFirst = getCombinations(rest, size);
  return [...withFirst, ...withoutFirst];
}

function checkStraight(sortedValues: number[]): number {
  // Returns high card value of straight, or 0 if not a straight
  const unique = [...new Set(sortedValues)].sort((a, b) => b - a);
  for (let i = 0; i <= unique.length - 5; i++) {
    if (
      unique[i] - unique[i + 1] === 1 &&
      unique[i + 1] - unique[i + 2] === 1 &&
      unique[i + 2] - unique[i + 3] === 1 &&
      unique[i + 3] - unique[i + 4] === 1
    ) {
      return unique[i];
    }
  }
  // Check wheel (A-2-3-4-5)
  if (unique.includes(14) && unique.includes(2) && unique.includes(3) && unique.includes(4) && unique.includes(5)) {
    return 5;
  }
  return 0;
}

function countValues(values: number[]): Record<number, number> {
  const counts: Record<number, number> = {};
  for (const v of values) {
    counts[v] = (counts[v] || 0) + 1;
  }
  return counts;
}

function getValuesWithCount(counts: Record<number, number>, target: number): number[] {
  return Object.entries(counts)
    .filter(([, c]) => c === target)
    .map(([v]) => Number(v))
    .sort((a, b) => b - a);
}

function evaluateFiveCards(cards: Card[]): HandResult {
  const values = cards.map(c => rankValue(c.rank)).sort((a, b) => b - a);
  const suits = cards.map(c => c.suit);
  const isFlush = suits.every(s => s === suits[0]);
  const straightHigh = checkStraight(values);
  const isStraight = straightHigh > 0;
  const valueCounts = countValues(values);
  const countList = Object.values(valueCounts).sort((a, b) => b - a);

  if (isFlush && isStraight) {
    if (straightHigh === 14) {
      return { rank: 10, tiebreakers: [14], description: 'Royal Flush' };
    }
    return { rank: 9, tiebreakers: [straightHigh], description: `Straight Flush (${rankName(straightHigh)} high)` };
  }

  if (countList[0] === 4) {
    const quad = getValuesWithCount(valueCounts, 4)[0];
    const kicker = getValuesWithCount(valueCounts, 1)[0];
    return { rank: 8, tiebreakers: [quad, kicker], description: `Four of a Kind (${rankName(quad)}s)` };
  }

  if (countList[0] === 3 && countList[1] === 2) {
    const trips = getValuesWithCount(valueCounts, 3)[0];
    const pair = getValuesWithCount(valueCounts, 2)[0];
    return { rank: 7, tiebreakers: [trips, pair], description: `Full House (${rankName(trips)}s full of ${rankName(pair)}s)` };
  }

  if (isFlush) {
    return { rank: 6, tiebreakers: values, description: `Flush (${rankName(values[0])} high)` };
  }

  if (isStraight) {
    return { rank: 5, tiebreakers: [straightHigh], description: `Straight (${rankName(straightHigh)} high)` };
  }

  if (countList[0] === 3) {
    const trips = getValuesWithCount(valueCounts, 3)[0];
    const kickers = getValuesWithCount(valueCounts, 1);
    return { rank: 4, tiebreakers: [trips, ...kickers], description: `Three of a Kind (${rankName(trips)}s)` };
  }

  if (countList[0] === 2 && countList[1] === 2) {
    const pairs = getValuesWithCount(valueCounts, 2);
    const kicker = getValuesWithCount(valueCounts, 1)[0];
    return { rank: 3, tiebreakers: [...pairs, kicker], description: `Two Pair (${rankName(pairs[0])}s and ${rankName(pairs[1])}s)` };
  }

  if (countList[0] === 2) {
    const pair = getValuesWithCount(valueCounts, 2)[0];
    const kickers = getValuesWithCount(valueCounts, 1);
    return { rank: 2, tiebreakers: [pair, ...kickers], description: `One Pair (${rankName(pair)}s)` };
  }

  return { rank: 1, tiebreakers: values, description: `High Card (${rankName(values[0])})` };
}

export class HandEvaluator {
  static evaluate(cards: Card[]): HandResult {
    if (cards.length < 5) {
      return { rank: 0, tiebreakers: [], description: 'Incomplete hand' };
    }
    const combos = getCombinations(cards, 5);
    let best: HandResult | null = null;
    for (const combo of combos) {
      const result = evaluateFiveCards(combo);
      if (!best || HandEvaluator.compare(result, best) > 0) {
        best = result;
      }
    }
    return best!;
  }

  static compare(a: HandResult, b: HandResult): number {
    if (a.rank !== b.rank) return a.rank - b.rank;
    for (let i = 0; i < Math.max(a.tiebreakers.length, b.tiebreakers.length); i++) {
      const av = a.tiebreakers[i] ?? 0;
      const bv = b.tiebreakers[i] ?? 0;
      if (av !== bv) return av - bv;
    }
    return 0;
  }
}
