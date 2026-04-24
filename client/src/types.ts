export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  suit?: Suit;
  rank?: Rank;
  hidden?: boolean;
}

export type PlayerStatus = 'active' | 'folded' | 'allin' | 'sitting_out';
export type GamePhase = 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';

export interface PublicPlayer {
  id: string;
  name: string;
  chips: number;
  cards: Card[];
  bet: number;
  totalBet: number;
  status: PlayerStatus;
  isDealer: boolean;
  hasActed: boolean;
  connected: boolean;
  /** ショーダウン時のみ: 確定した手役名 */
  handDescription?: string;
  /** オールイン時: モンテカルロ勝率 (0–100) */
  equity?: number;
}

export interface Winner {
  playerId: string;
  playerName: string;
  amount: number;
  hand?: string;
  cards?: Card[];
  potLabel?: string;
}

export interface DrawInfo {
  label: string;
  detail: string;
  outs: number;
}

export interface GameState {
  roomId: string;
  players: PublicPlayer[];
  communityCards: Card[];
  pot: number;
  phase: GamePhase;
  currentPlayerIndex: number;
  dealerIndex: number;
  smallBlindIndex: number;
  bigBlindIndex: number;
  currentBet: number;
  smallBlind: number;
  bigBlind: number;
  minRaise: number;
  winners: Winner[];
  lastAction: string;
  myHandDescription?: string;
  myDraws?: DrawInfo[];
  gameOver?: { winnerId: string; winnerName: string };
}
