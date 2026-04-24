import { Card, GamePhase, GameState, Player, PublicCard, Winner } from '../types';
import { Deck } from './Deck';
import { HandEvaluator } from './HandEvaluator';

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
  private smallBlind: number = 10;
  private bigBlind: number = 20;
  private winners: Winner[] = [];
  private lastAction: string = '';
  // 切断タイマー管理
  private disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(private roomId: string) {
    this.deck = new Deck();
  }

  // ── プレイヤー管理 ──────────────────────────────

  hasPlayer(id: string): boolean {
    return this.players.some(p => p.id === id);
  }

  addPlayer(id: string, name: string): boolean {
    if (this.players.length >= 9) return false;
    if (this.phase !== 'waiting') return false;
    if (this.hasPlayer(id)) return false;
    this.players.push({
      id, name,
      chips: 1000,
      cards: [], bet: 0, totalBet: 0,
      status: 'active',
      isDealer: false, hasActed: false,
      connected: true,
    });
    return true;
  }

  reconnectPlayer(id: string): boolean {
    const p = this.players.find(p => p.id === id);
    if (!p) return false;
    p.connected = true;
    // 切断タイマーがあればキャンセル
    const timer = this.disconnectTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.disconnectTimers.delete(id);
    }
    return true;
  }

  /** connected フラグを false にする。ゲーム中なら一定時間後に自動フォールド */
  markDisconnected(id: string, onAutoFold: () => void) {
    const p = this.players.find(p => p.id === id);
    if (!p) return;
    p.connected = false;

    if (this.phase === 'waiting' || this.phase === 'showdown') return;

    // 20秒後に自動フォールド
    const timer = setTimeout(() => {
      this.disconnectTimers.delete(id);
      if (!p.connected && p.status === 'active') {
        const isTurn = this.players[this.currentPlayerIndex]?.id === id;
        p.status = 'folded';
        p.hasActed = true;
        this.lastAction = `${p.name} が切断（自動フォールド）`;
        if (isTurn) this.advanceToNextPlayer();
        onAutoFold();
      }
    }, 20_000);
    this.disconnectTimers.set(id, timer);
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
  isHost(id: string): boolean {
    return this.players.length > 0 && this.players[0].id === id;
  }

  canStart(): boolean {
    return this.players.filter(p => p.connected && p.chips > 0).length >= 2
      && this.phase === 'waiting';
  }

  // ── ハンド開始 ──────────────────────────────────

  startHand(): boolean {
    if (this.phase !== 'waiting') return false;
    const eligible = this.players.filter(p => p.chips > 0 && p.connected);
    if (eligible.length < 2) return false;

    // チップが尽きた / 切断中のプレイヤーを除外
    this.players = this.players.filter(p => p.chips > 0 && p.connected);

    this.players.forEach(p => {
      p.cards = []; p.bet = 0; p.totalBet = 0;
      p.status = 'active'; p.isDealer = false; p.hasActed = false;
    });
    this.communityCards = [];
    this.pot = 0; this.winners = []; this.lastAction = '';
    this.currentBet = 0; this.minRaise = this.bigBlind;

    // ディーラーボタン
    this.dealerIndex = this.nextActiveFrom(this.dealerIndex);
    this.players[this.dealerIndex].isDealer = true;

    // ブラインド（2人の場合はヘッズアップルール）
    const activeCnt = this.players.filter(p => p.status === 'active').length;
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

    // カード配布
    this.deck.reset();
    this.players.filter(p => p.status === 'active').forEach(p => {
      p.cards = [this.deck.deal()!, this.deck.deal()!];
    });

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

  // ── アクション ──────────────────────────────────

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
        if (cur.bet < this.currentBet)
          return { success: false, error: 'コールが必要です' };
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
          return { success: false, error: `最小レイズは $${minNeeded} です` };
        const add = raiseTo - cur.bet;
        this.minRaise = Math.max(this.minRaise, raiseTo - this.currentBet);
        cur.chips -= add; cur.bet = raiseTo; cur.totalBet += add;
        this.pot += add; this.currentBet = raiseTo;
        cur.hasActed = true;
        if (cur.chips === 0) cur.status = 'allin';
        this.players.forEach(p => {
          if (p.id !== cur.id && p.status === 'active') p.hasActed = false;
        });
        this.lastAction = `${cur.name} がレイズ → $${raiseTo}`;
        break;
      }

      case 'allin': {
        const all = cur.chips;
        const newBet = cur.bet + all;
        if (newBet > this.currentBet) {
          this.minRaise = Math.max(this.minRaise, newBet - this.currentBet);
          this.currentBet = newBet;
          this.players.forEach(p => {
            if (p.id !== cur.id && p.status === 'active') p.hasActed = false;
          });
        }
        cur.chips = 0; cur.bet = newBet; cur.totalBet += all;
        this.pot += all; cur.status = 'allin'; cur.hasActed = true;
        this.lastAction = `${cur.name} がオールイン ($${newBet})`;
        break;
      }

      default:
        return { success: false, error: '不明なアクション' };
    }

    this.advanceToNextPlayer();
    return { success: true };
  }

  // ── ゲーム進行 ──────────────────────────────────

  private advanceToNextPlayer() {
    const notFolded = this.players.filter(
      p => p.status !== 'folded' && p.status !== 'sitting_out',
    );
    if (notFolded.length === 1) { this.awardPot(notFolded); return; }

    if (this.isBettingRoundComplete()) { this.advancePhase(); return; }

    let next = (this.currentPlayerIndex + 1) % this.players.length;
    for (let i = 0; i < this.players.length; i++) {
      if (
        this.players[next].status !== 'folded' &&
        this.players[next].status !== 'allin' &&
        this.players[next].status !== 'sitting_out'
      ) break;
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

    const next: Record<string, GamePhase> = {
      preflop: 'flop', flop: 'turn', turn: 'river', river: 'showdown',
    };
    this.phase = next[this.phase]!;

    if (this.phase === 'flop') {
      this.communityCards = [this.deck.deal()!, this.deck.deal()!, this.deck.deal()!];
    } else if (this.phase === 'turn' || this.phase === 'river') {
      this.communityCards.push(this.deck.deal()!);
    } else if (this.phase === 'showdown') {
      this.showdown(); return;
    }

    // 残りアクティブプレイヤーが1人以下→全コミュニティカードを出してショーダウン
    if (this.players.filter(p => p.status === 'active').length <= 1) {
      while (this.communityCards.length < 5) this.communityCards.push(this.deck.deal()!);
      this.showdown(); return;
    }

    this.currentPlayerIndex = this.nextActiveFrom(this.dealerIndex);
  }

  private showdown() {
    this.phase = 'showdown';
    const eligible = this.players.filter(
      p => p.status !== 'folded' && p.status !== 'sitting_out',
    );
    this.awardPot(eligible);
  }

  // ── サイドポット計算 ────────────────────────────

  private calculatePots(eligible: Player[]): Array<{ amount: number; players: Player[] }> {
    const contributors = this.players.filter(p => p.totalBet > 0);
    const levels = [...new Set(contributors.map(p => p.totalBet))].sort((a, b) => a - b);

    const pots: Array<{ amount: number; players: Player[] }> = [];
    let prev = 0;

    for (const level of levels) {
      const inThisLevel = contributors.filter(p => p.totalBet >= level);
      const amount = (level - prev) * inThisLevel.length;
      const canWin = inThisLevel.filter(p => eligible.includes(p));
      if (amount > 0) pots.push({ amount, players: canWin.length > 0 ? canWin : eligible });
      prev = level;
    }

    // 端数
    const assigned = pots.reduce((s, p) => s + p.amount, 0);
    if (this.pot - assigned > 0) pots.push({ amount: this.pot - assigned, players: eligible });

    return pots;
  }

  private awardPot(eligible: Player[]) {
    this.phase = 'showdown';
    this.winners = [];

    if (eligible.length === 1) {
      eligible[0].chips += this.pot;
      this.winners = [{
        playerId: eligible[0].id, playerName: eligible[0].name,
        amount: this.pot, hand: '最後の1人', potLabel: 'ポット',
      }];
      this.pot = 0; return;
    }

    const pots = this.calculatePots(eligible);
    const multi = pots.length > 1;

    pots.forEach(({ amount, players }, idx) => {
      const evaluated = players.map(p => ({
        player: p,
        result: HandEvaluator.evaluate([...p.cards, ...this.communityCards]),
      }));
      evaluated.sort((a, b) => HandEvaluator.compare(b.result, a.result));

      const best = evaluated[0].result;
      const ws = evaluated.filter(e => HandEvaluator.compare(e.result, best) === 0);
      const share = Math.floor(amount / ws.length);
      const rem = amount - share * ws.length;
      const label = multi ? (idx === 0 ? 'メインポット' : `サイドポット ${idx}`) : 'ポット';

      ws.forEach((w, i) => {
        const win = share + (i === 0 ? rem : 0);
        w.player.chips += win;
        const existing = this.winners.find(x => x.playerId === w.player.id);
        if (existing) {
          existing.amount += win;
        } else {
          this.winners.push({
            playerId: w.player.id, playerName: w.player.name,
            amount: win, hand: w.result.description,
            cards: w.player.cards, potLabel: label,
          });
        }
      });
    });

    this.pot = 0;
  }

  // ── ユーティリティ ──────────────────────────────

  private nextActiveFrom(from: number): number {
    let idx = (from + 1) % this.players.length;
    for (let i = 0; i < this.players.length; i++) {
      if (this.players[idx].status !== 'folded' && this.players[idx].status !== 'sitting_out')
        return idx;
      idx = (idx + 1) % this.players.length;
    }
    return idx;
  }

  resetForNewHand() {
    // チップが尽きたプレイヤー or 切断中を除外
    this.players = this.players.filter(p => p.chips > 0 && p.connected);
    this.phase = 'waiting';
    this.winners = []; this.lastAction = '';
  }

  getState(forPlayerId?: string): GameState {
    return {
      roomId: this.roomId,
      players: this.players.map(p => {
        let cards: PublicCard[];
        if (this.phase === 'showdown') {
          const eligible = p.status !== 'folded' && p.status !== 'sitting_out';
          cards = eligible ? p.cards : p.cards.map(() => ({ hidden: true }));
        } else if (p.id === forPlayerId) {
          cards = p.cards;
        } else {
          cards = p.cards.map(() => ({ hidden: true }));
        }
        return {
          id: p.id, name: p.name, chips: p.chips, cards,
          bet: p.bet, totalBet: p.totalBet, status: p.status,
          isDealer: p.isDealer, hasActed: p.hasActed, connected: p.connected,
        };
      }),
      communityCards: this.communityCards,
      pot: this.pot, phase: this.phase,
      currentPlayerIndex: this.currentPlayerIndex,
      dealerIndex: this.dealerIndex,
      smallBlindIndex: this.smallBlindIndex,
      bigBlindIndex: this.bigBlindIndex,
      currentBet: this.currentBet,
      smallBlind: this.smallBlind, bigBlind: this.bigBlind,
      minRaise: this.minRaise,
      winners: this.winners, lastAction: this.lastAction,
    };
  }
}
