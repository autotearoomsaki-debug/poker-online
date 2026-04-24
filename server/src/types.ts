export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  suit: Suit;
  rank: Rank;
}

export type PlayerStatus = 'active' | 'folded' | 'allin' | 'sitting_out';
export type GamePhase = 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';

export interface Player {
  id: string;
  name: string;
  chips: number;
  cards: Card[];
  bet: number;
  status: PlayerStatus;
  isDealer: boolean;
  hasActed: boolean;
}

export interface Winner {
  playerId: string;
  playerName: string;
  amount: number;
  hand?: string;
  cards?: Card[];
}

export interface PublicCard {
  suit?: Suit;
  rank?: Rank;
  hidden?: boolean;
}

export interface PublicPlayer {
  id: string;
  name: string;
  chips: number;
  cards: PublicCard[];
  bet: number;
  status: PlayerStatus;
  isDealer: boolean;
  hasActed: boolean;
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
}
