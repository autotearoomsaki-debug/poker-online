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
  totalBet: number;
  status: PlayerStatus;
  isDealer: boolean;
  hasActed: boolean;
  connected: boolean;
}

export interface Winner {
  playerId: string;
  playerName: string;
  amount: number;
  hand?: string;
  cards?: Card[];
  potLabel?: string;
}

/** ドロー情報（サーバーで計算してクライアントに送信） */
export interface DrawInfo {
  label: string;   // e.g. 'フラッシュドロー'
  detail: string;  // e.g. '♠があと1枚でフラッシュ'
  outs: number;
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
  totalBet: number;
  status: PlayerStatus;
  isDealer: boolean;
  hasActed: boolean;
  connected: boolean;
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
  /** 受信プレイヤー自身の現在の手役説明 */
  myHandDescription?: string;
  /** 受信プレイヤー自身のドロー情報 */
  myDraws?: DrawInfo[];
  /** トーナメント終了情報 */
  gameOver?: { winnerId: string; winnerName: string };
}
