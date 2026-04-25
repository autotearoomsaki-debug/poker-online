import { Card, DrawInfo, GamePhase, GameState, Player, PublicCard, Winner } from '../types';
import { Deck } from './Deck';
import { HandEvaluator } from './HandEvaluator';

// ─── ハンド分析ユーティリティ ──────────────────────────

const RANK_VAL: Record<string, number> = {
  '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,
  'J':11,'Q':12,'K':13,'A':14,
};
const SUIT_SYM: Record<string, string> = {
  spades:'♠', hearts:'♥', diamonds:'♦', clubs:'♣',
};

function rv(rank: string): number { return RANK_VAL[rank] ?? 0; }
function rn(v: number): string {
  if (v===14) return 'A'; if (v===13) return 'K';
  if (v===12) return 'Q'; if (v===11) return 'J';
  return String(v);
}

/** プリフロップのホールカード説明 */
function describeHoleCards(cards: Card[]): string {
  if (cards.length < 2) return '';
  const [c1, c2] = cards;
  if (rv(c1.rank) === rv(c2.rank)) return `ポケット${c1.rank}s`;
  const [hi, lo] = rv(c1.rank) > rv(c2.rank) ? [c1, c2] : [c2, c1];
  return `${hi.rank}${lo.rank} ${c1.suit === c2.suit ? 'スーテッド' : 'オフスーツ'}`;
}

/** ドロー分析（リバー前のみ意味あり） */
function analyzeDraws(holeCards: Card[], communityCards: Card[]): DrawInfo[] {
  if (communityCards.length >= 5) return [];
  const allCards = [...holeCards, ...communityCards];
  const draws: DrawInfo[] = [];

  // フラッシュドロー（4枚同スート）
  const suitCnt: Record<string, number> = {};
  for (const c of allCards) suitCnt[c.suit] = (suitCnt[c.suit] || 0) + 1;
  for (const [s, n] of Object.entries(suitCnt)) {
    if (n === 4) {
      draws.push({ label:'フラッシュドロー', detail:`${SUIT_SYM[s]}があと1枚でフラッシュ`, outs:9 });
      break;
    }
  }

  // ストレートドロー
  const uniqueVals = [...new Set(allCards.map(c => rv(c.rank)))].sort((a,b)=>a-b);
  const withLowAce = uniqueVals.includes(14) ? [1,...uniqueVals] : uniqueVals;
  let oesd = false, gutshot = false;
  for (let low = 1; low <= 10; low++) {
    const rng = [low,low+1,low+2,low+3,low+4];
    const have = rng.filter(v => withLowAce.includes(v));
    const miss = rng.filter(v => !withLowAce.includes(v));
    if (have.length === 4 && miss.length === 1) {
      if (miss[0] === rng[0] || miss[0] === rng[4]) oesd = true;
      else gutshot = true;
    }
  }
  if (oesd) draws.push({ label:'ストレートドロー', detail:'両端待ち (OESD)', outs:8 });
  else if (gutshot) draws.push({ label:'ガットショット', detail:'中間待ち', outs:4 });

  // ペア系のアップグレード（コミュニティカードあるとき）
  if (communityCards.length > 0) {
    const valCnt: Record<number, number> = {};
    for (const c of allCards) valCnt[rv(c.rank)] = (valCnt[rv(c.rank)] || 0) + 1;
    const pairs = Object.entries(valCnt).filter(([,n])=>n===2).map(([v])=>Number(v));
    const trips = Object.entries(valCnt).filter(([,n])=>n===3).map(([v])=>Number(v));

    if (trips.length > 0) {
      draws.push({ label:'スリーカード', detail:`${rn(trips[0])}s でフルハウス・フォーカード狙い`, outs:7 });
    } else if (pairs.length >= 2) {
      draws.push({ label:'ツーペア', detail:'フルハウスまで4アウト', outs:4 });
    } else if (pairs.length === 1) {
      draws.push({ label:'ワンペア', detail:`${rn(pairs[0])}s がもう1枚でスリーカード (2アウト)`, outs:2 });
    }
  }

  return draws;
}

/** ゲーム中の自分のハンド状況を取得 */
function getMyHandInfo(holeCards: Card[], communityCards: Card[]): {
  description: string;
  draws: DrawInfo[];
} {
  if (holeCards.length < 2) return { description: '', draws: [] };

  // プリフロップ（コミュニティなし）
  if (communityCards.length === 0) {
    return { description: describeHoleCards(holeCards), draws: [] };
  }

  const all = [...holeCards, ...communityCards];
  const result = all.length >= 5
    ? HandEvaluator.evaluate(all)
    : { description: describeHoleCards(holeCards), rank: 0, tiebreakers: [] };

  const draws = communityCards.length < 5 ? analyzeDraws(holeCards, communityCards) : [];
  return { description: result.description, draws };
}

// ─── PokerGame クラス ─────────────────────────────────

export class PokerGame {
  private players: Player[] = [];
  private communityCards: Card[] = [];
  private pot: number = 0;
  private phase: GamePhase = 'waiting';
  private currentPlayerIndex: number = 0;
  private dealerIndex: number = -1;
  private smallBlindIndex: number = 0;
  private bigBlindIndex: number = 0;
  private currentBet: number = 0;
  private minRaise: number = 20;
  private deck: Deck;
  private readonly smallBlind: number = 10;
  private readonly bigBlind: number = 20;
  private winners: Winner[] = [];
  private lastAction: string = '';
  private gameOver: { winnerId: string; winnerName: string } | null = null;
  private pendingRunout = false;
  private wonByFold = false;
  private equityCache: { boardLen: number; equity: Map<string, number> } | null = null;
  private disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(private roomId: string) {
    this.deck = new Deck();
  }

  // ── プレイヤー管理 ────────────────────────────────

  hasPlayer(id: string): boolean { return this.players.some(p => p.id === id); }

  addPlayer(id: string, name: string): boolean {
    if (this.players.length >= 9 || this.phase !== 'waiting') return false;
    if (this.hasPlayer(id)) return false;
    this.players.push({
      id, name, chips: 1000, cards: [], bet: 0, totalBet: 0,
      status: 'active', isDealer: false, hasActed: false, connected: true,
    });
    return true;
  }

  reconnectPlayer(id: string): boolean {
    const p = this.players.find(p => p.id === id);
    if (!p) return false;
    p.connected = true;
    const t = this.disconnectTimers.get(id);
    if (t) { clearTimeout(t); this.disconnectTimers.delete(id); }
    return true;
  }

  markDisconnected(id: string, onAutoFold: () => void) {
    const p = this.players.find(p => p.id === id);
    if (!p) return;
    p.connected = false;
    if (this.phase === 'waiting' || this.phase === 'showdown') return;
    const t = setTimeout(() => {
      this.disconnectTimers.delete(id);
      if (!p.connected && p.status === 'active') {
        const isTurn = this.players[this.currentPlayerIndex]?.id === id;
        p.status = 'folded'; p.hasActed = true;
        this.lastAction = `${p.name} が切断（自動フォールド）`;
        if (isTurn) this.advanceToNextPlayer();
        onAutoFold();
      }
    }, 60_000);
    this.disconnectTimers.set(id, t);
  }

  removePlayer(id: string) {
    if (this.phase === 'waiting') {
      this.players = this.players.filter(p => p.id !== id);
    } else {
      const p = this.players.find(p => p.id === id);
      if (p) p.connected = false;
    }
  }

  getPlayerCount(): number { return this.players.length; }
  getConnectedCount(): number { return this.players.filter(p => p.connected).length; }
  getPhase(): GamePhase { return this.phase; }
  isHost(id: string): boolean { return this.players.length > 0 && this.players[0].id === id; }
  isGameOver(): boolean { return this.gameOver !== null; }

  canStart(): boolean {
    return this.players.filter(p => p.connected && p.chips > 0).length >= 2
      && this.phase === 'waiting';
  }

  // ── ハンド開始 ────────────────────────────────────

  startHand(): boolean {
    if (this.phase !== 'waiting') return false;
    this.players = this.players.filter(p => p.chips > 0 && p.connected);
    if (this.players.length < 2) return false;

    this.players.forEach(p => {
      p.cards = []; p.bet = 0; p.totalBet = 0;
      p.status = 'active'; p.isDealer = false; p.hasActed = false;
    });
    this.communityCards = []; this.pot = 0;
    this.winners = []; this.lastAction = '';
    this.currentBet = 0; this.minRaise = this.bigBlind;
    this.gameOver = null; this.wonByFold = false;

    this.dealerIndex = this.nextActiveFrom(this.dealerIndex);
    this.players[this.dealerIndex].isDealer = true;

    const activeCnt = this.players.length;
    if (activeCnt === 2) {
      this.smallBlindIndex = this.dealerIndex;
      this.bigBlindIndex = this.nextActiveFrom(this.smallBlindIndex);
    } else {
      this.smallBlindIndex = this.nextActiveFrom(this.dealerIndex);
      this.bigBlindIndex = this.nextActiveFrom(this.smallBlindIndex);
    }
    this.postBlind(this.smallBlindIndex, this.smallBlind);
    this.postBlind(this.bigBlindIndex, this.bigBlind);
    this.currentBet = this.bigBlind;

    this.deck.reset();
    this.players.forEach(p => { p.cards = [this.deck.deal()!, this.deck.deal()!]; });

    this.phase = 'preflop';
    this.currentPlayerIndex = this.nextActiveFrom(this.bigBlindIndex);
    this.players.forEach(p => (p.hasActed = false));
    return true;
  }

  private postBlind(index: number, amount: number) {
    const p = this.players[index];
    const posted = Math.min(amount, p.chips);
    p.chips -= posted; p.bet += posted; p.totalBet += posted;
    this.pot += posted;
    if (p.chips === 0) p.status = 'allin';
    p.hasActed = false;
  }

  // ── アクション ────────────────────────────────────

  handleAction(
    playerId: string,
    action: 'fold' | 'call' | 'check' | 'raise' | 'allin',
    amount?: number,
  ): { success: boolean; error?: string } {
    if (this.phase === 'waiting' || this.phase === 'showdown')
      return { success: false, error: 'ゲームが進行中ではありません' };

    const cur = this.players[this.currentPlayerIndex];
    if (!cur || cur.id !== playerId)
      return { success: false, error: 'あなたのターンではありません' };
    if (cur.status !== 'active')
      return { success: false, error: 'アクションできません' };

    switch (action) {
      case 'fold':
        cur.status = 'folded'; cur.hasActed = true;
        this.lastAction = `${cur.name} がフォールド`;
        break;
      case 'check':
        if (cur.bet < this.currentBet) return { success: false, error: 'コールが必要です' };
        cur.hasActed = true;
        this.lastAction = `${cur.name} がチェック`;
        break;
      case 'call': {
        const add = Math.min(this.currentBet - cur.bet, cur.chips);
        cur.chips -= add; cur.bet += add; cur.totalBet += add; this.pot += add;
        cur.hasActed = true;
        if (cur.chips === 0) cur.status = 'allin';
        this.lastAction = `${cur.name} がコール ($${add})`;
        break;
      }
      case 'raise': {
        if (amount == null) return { success: false, error: 'レイズ額が必要です' };
        const raiseTo = Math.min(amount, cur.chips + cur.bet);
        const minNeeded = this.currentBet + this.minRaise;
        if (raiseTo < minNeeded && raiseTo - cur.bet < cur.chips)
          return { success: false, error: `最小レイズは $${minNeeded}` };
        const add = raiseTo - cur.bet;
        const wasBet = this.currentBet === 0; // フロップ以降でまだ誰もベットしていない
        this.minRaise = Math.max(this.minRaise, raiseTo - this.currentBet);
        cur.chips -= add; cur.bet = raiseTo; cur.totalBet += add;
        this.pot += add; this.currentBet = raiseTo;
        cur.hasActed = true;
        if (cur.chips === 0) cur.status = 'allin';
        this.players.forEach(p => { if (p.id !== cur.id && p.status === 'active') p.hasActed = false; });
        this.lastAction = wasBet
          ? `${cur.name} がベット $${raiseTo}`
          : `${cur.name} がレイズ → $${raiseTo}`;
        break;
      }
      case 'allin': {
        const all = cur.chips;
        const newBet = cur.bet + all;
        if (newBet > this.currentBet) {
          this.minRaise = Math.max(this.minRaise, newBet - this.currentBet);
          this.currentBet = newBet;
          this.players.forEach(p => { if (p.id !== cur.id && p.status === 'active') p.hasActed = false; });
        }
        cur.chips = 0; cur.bet = newBet; cur.totalBet += all;
        this.pot += all; cur.status = 'allin'; cur.hasActed = true;
        this.lastAction = `${cur.name} がオールイン ($${newBet})`;
        break;
      }
      default: return { success: false, error: '不明なアクション' };
    }

    this.advanceToNextPlayer();
    return { success: true };
  }

  // ── ゲーム進行 ────────────────────────────────────

  private advanceToNextPlayer() {
    const notFolded = this.players.filter(p => p.status !== 'folded' && p.status !== 'sitting_out');
    if (notFolded.length === 1) { this.awardPot(notFolded); return; }
    if (this.isBettingRoundComplete()) { this.advancePhase(); return; }

    let next = (this.currentPlayerIndex + 1) % this.players.length;
    for (let i = 0; i < this.players.length; i++) {
      const st = this.players[next].status;
      if (st !== 'folded' && st !== 'allin' && st !== 'sitting_out') break;
      next = (next + 1) % this.players.length;
    }
    this.currentPlayerIndex = next;
  }

  private isBettingRoundComplete(): boolean {
    const active = this.players.filter(p => p.status === 'active');
    if (active.length === 0) return true;
    if (active.some(p => !p.hasActed)) return false;
    if (active.some(p => p.bet < this.currentBet)) return false;
    return true;
  }

  private advancePhase() {
    this.players.forEach(p => { p.bet = 0; p.hasActed = false; });
    this.currentBet = 0; this.minRaise = this.bigBlind;

    const nxt: Record<string, GamePhase> = {
      preflop:'flop', flop:'turn', turn:'river', river:'showdown',
    };
    this.phase = nxt[this.phase]!;

    if (this.phase === 'flop')
      this.communityCards = [this.deck.deal()!, this.deck.deal()!, this.deck.deal()!];
    else if (this.phase === 'turn' || this.phase === 'river')
      this.communityCards.push(this.deck.deal()!);
    else if (this.phase === 'showdown') { this.showdown(); return; }

    // アクティブプレイヤーが1人以下 = 全員オールイン/フォールド
    // 残りのストリートをサーバー側で段階的に配布するためフラグを立てる
    if (this.players.filter(p => p.status === 'active').length <= 1) {
      this.pendingRunout = true;
      return; // index.ts が advanceRunout() を 1.2 秒ごとに呼び出す
    }
    this.currentPlayerIndex = this.nextActiveFrom(this.dealerIndex);
  }

  private showdown() {
    this.phase = 'showdown';
    const eligible = this.players.filter(p => p.status !== 'folded' && p.status !== 'sitting_out');
    this.awardPot(eligible);
  }

  // ── サイドポット計算 ──────────────────────────────

  private calculatePots(eligible: Player[]): Array<{ amount: number; players: Player[] }> {
    const contributors = this.players.filter(p => p.totalBet > 0);
    const levels = [...new Set(contributors.map(p => p.totalBet))].sort((a,b)=>a-b);
    const pots: Array<{ amount: number; players: Player[] }> = [];
    let prev = 0;
    for (const level of levels) {
      const inLevel = contributors.filter(p => p.totalBet >= level);
      const amount = (level - prev) * inLevel.length;
      const canWin = inLevel.filter(p => eligible.includes(p));
      if (amount > 0) pots.push({ amount, players: canWin.length > 0 ? canWin : eligible });
      prev = level;
    }
    const assigned = pots.reduce((s,p)=>s+p.amount,0);
    if (this.pot - assigned > 0) pots.push({ amount: this.pot - assigned, players: eligible });
    return pots;
  }

  private awardPot(eligible: Player[]) {
    this.phase = 'showdown';
    this.winners = [];

    if (eligible.length === 1) {
      eligible[0].chips += this.pot;
      this.wonByFold = true;
      this.winners = [{
        playerId: eligible[0].id, playerName: eligible[0].name,
        amount: this.pot, hand: '最後の1人', potLabel: 'ポット',
      }];
      this.pot = 0; return;
    }
    this.wonByFold = false;

    const pots = this.calculatePots(eligible);
    const multi = pots.length > 1;

    pots.forEach(({ amount, players }, idx) => {
      const evaled = players.map(p => ({
        player: p,
        result: HandEvaluator.evaluate([...p.cards, ...this.communityCards]),
      }));
      evaled.sort((a,b) => HandEvaluator.compare(b.result, a.result));
      const best = evaled[0].result;
      const ws = evaled.filter(e => HandEvaluator.compare(e.result, best) === 0);
      const share = Math.floor(amount / ws.length);
      const rem = amount - share * ws.length;
      const label = multi ? (idx === 0 ? 'メインポット' : `サイドポット ${idx}`) : 'ポット';

      ws.forEach((w, i) => {
        const win = share + (i === 0 ? rem : 0);
        w.player.chips += win;
        const ex = this.winners.find(x => x.playerId === w.player.id);
        if (ex) ex.amount += win;
        else this.winners.push({
          playerId: w.player.id, playerName: w.player.name,
          amount: win, hand: w.result.description,
          cards: w.player.cards, potLabel: label,
        });
      });
    });

    this.pot = 0;
  }

  private nextActiveFrom(from: number): number {
    let idx = (from + 1) % this.players.length;
    for (let i = 0; i < this.players.length; i++) {
      if (this.players[idx].status !== 'folded' && this.players[idx].status !== 'sitting_out')
        return idx;
      idx = (idx + 1) % this.players.length;
    }
    return idx;
  }

  // ─── モンテカルロ勝率計算 ──────────────────────────

  private calculateEquity(nSims = 600): Map<string, number> {
    const eligible = this.players.filter(
      p => p.status !== 'folded' && p.status !== 'sitting_out' && p.cards.length === 2,
    );
    if (eligible.length < 2) return new Map();

    const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'] as const;
    const RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'] as const;

    const usedSet = new Set<string>();
    for (const p of eligible) for (const c of p.cards) usedSet.add(`${c.rank}|${c.suit}`);
    for (const c of this.communityCards) usedSet.add(`${c.rank}|${c.suit}`);

    const remaining: Card[] = [];
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        if (!usedSet.has(`${rank}|${suit}`)) remaining.push({ rank, suit });
      }
    }

    const needed = 5 - this.communityCards.length;
    const wins = new Map<string, number>(eligible.map(p => [p.id, 0]));

    for (let sim = 0; sim < nSims; sim++) {
      // Fisher-Yates shuffle (先頭 needed 枚だけ)
      for (let i = 0; i < needed; i++) {
        const j = i + Math.floor(Math.random() * (remaining.length - i));
        [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
      }
      const board = [...this.communityCards, ...remaining.slice(0, needed)];

      const results = eligible.map(p => HandEvaluator.evaluate([...p.cards, ...board]));

      let bestRank = -1;
      for (const r of results) if (r.rank > bestRank) bestRank = r.rank;

      const tied: number[] = [];
      for (let i = 0; i < results.length; i++) {
        if (results[i].rank === bestRank) tied.push(i);
      }

      // 複数ベスト → タイブレーカー比較
      let winIdx = tied;
      for (let tb = 0; tb < 5 && winIdx.length > 1; tb++) {
        const maxTb = Math.max(...winIdx.map(i => results[i].tiebreakers[tb] ?? 0));
        winIdx = winIdx.filter(i => (results[i].tiebreakers[tb] ?? 0) === maxTb);
      }

      const share = 1 / winIdx.length;
      for (const i of winIdx) wins.set(eligible[i].id, (wins.get(eligible[i].id)! + share));
    }

    const equity = new Map<string, number>();
    for (const [id, w] of wins) equity.set(id, Math.round((w / nSims) * 100));
    return equity;
  }

  private getEquity(): Map<string, number> {
    if (this.equityCache?.boardLen === this.communityCards.length) return this.equityCache.equity;
    const equity = this.calculateEquity();
    this.equityCache = { boardLen: this.communityCards.length, equity };
    return equity;
  }

  isPendingRunout(): boolean { return this.pendingRunout; }

  /**
   * ルーアウト中に次のストリートを1つ進める。
   * - 'continue' : まだ残りストリートがある（再度呼び出す）
   * - 'done'     : ショーダウン完了
   */
  advanceRunout(): 'continue' | 'done' {
    if (!this.pendingRunout) return 'done';
    const nxt: Partial<Record<GamePhase, GamePhase>> = {
      flop: 'turn', turn: 'river', river: 'showdown',
    };
    this.phase = (nxt[this.phase] ?? 'showdown') as GamePhase;

    if (this.phase === 'turn' || this.phase === 'river') {
      this.communityCards.push(this.deck.deal()!);
      return 'continue';
    }

    // showdown
    this.pendingRunout = false;
    this.showdown();
    return 'done';
  }

  resetForNewHand() {
    this.pendingRunout = false;
    this.equityCache = null;
    this.players = this.players.filter(p => p.chips > 0 && p.connected);
    // チップのあるプレイヤーが1人以下 → ゲームオーバー
    if (this.players.length <= 1) {
      if (this.players.length === 1) {
        this.gameOver = { winnerId: this.players[0].id, winnerName: this.players[0].name };
      }
      this.phase = 'showdown'; // ゲームオーバー画面を出すため showdown のまま
    } else {
      this.phase = 'waiting';
    }
    this.winners = []; this.lastAction = '';
    this.wonByFold = false;
  }

  getCommunityCardCount(): number { return this.communityCards.length; }

  getState(forPlayerId?: string, communityCardsLimit?: number): GameState {
    // ハンド情報（自分のカードがある場合のみ計算）
    let myHandDescription: string | undefined;
    let myDraws: DrawInfo[] | undefined;
    if (forPlayerId && this.phase !== 'waiting') {
      const me = this.players.find(p => p.id === forPlayerId);
      if (me && me.cards.length === 2 && me.status !== 'folded') {
        const info = getMyHandInfo(me.cards, this.communityCards);
        myHandDescription = info.description;
        myDraws = info.draws;
      }
    }

    return {
      roomId: this.roomId,
      players: this.players.map(p => {
        let cards: PublicCard[];
        let handDescription: string | undefined;
        if (this.pendingRunout) {
          // オールインランナウト中: フォールドしていない全員のカードを公開 + 手役も計算
          const eligible = p.status !== 'folded' && p.status !== 'sitting_out';
          cards = eligible ? p.cards : p.cards.map(() => ({ hidden: true }));
          if (eligible && p.cards.length >= 2 && this.communityCards.length > 0) {
            handDescription = getMyHandInfo(p.cards, this.communityCards).description;
          }
        } else if (this.phase === 'showdown') {
          const eligible = p.status !== 'folded' && p.status !== 'sitting_out';
          // フォールドによる勝利: 全員のカードを全員に非公開
          if (this.wonByFold) {
            cards = p.cards.map(() => ({ hidden: true }));
          } else {
            cards = eligible ? p.cards : p.cards.map(() => ({ hidden: true }));
            if (eligible && p.cards.length >= 2) {
              handDescription = getMyHandInfo(p.cards, this.communityCards).description;
            }
          }
        } else if (p.id === forPlayerId) {
          cards = p.cards;
        } else {
          cards = p.cards.map(() => ({ hidden: true }));
        }

        // オールイン時の勝率（pendingRunout 中のみ計算）
        let equity: number | undefined;
        if (this.pendingRunout) {
          const eMap = this.getEquity();
          equity = eMap.get(p.id);
        }

        return {
          id: p.id, name: p.name, chips: p.chips, cards,
          bet: p.bet, totalBet: p.totalBet, status: p.status,
          isDealer: p.isDealer, hasActed: p.hasActed, connected: p.connected,
          handDescription, equity,
        };
      }),
      communityCards: communityCardsLimit !== undefined
        ? this.communityCards.slice(0, communityCardsLimit)
        : this.communityCards,
      pot: this.pot, phase: this.phase,
      currentPlayerIndex: this.currentPlayerIndex,
      dealerIndex: this.dealerIndex,
      smallBlindIndex: this.smallBlindIndex,
      bigBlindIndex: this.bigBlindIndex,
      currentBet: this.currentBet,
      smallBlind: this.smallBlind, bigBlind: this.bigBlind,
      minRaise: this.minRaise,
      winners: this.winners, lastAction: this.lastAction,
      myHandDescription, myDraws,
      gameOver: this.gameOver ?? undefined,
    };
  }
}
