import { Card, GamePhase, GameState, Player, PublicCard, PublicPlayer, Winner } from '../types';
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

  constructor(private roomId: string) {
    this.deck = new Deck();
  }

  addPlayer(id: string, name: string): boolean {
    if (this.players.length >= 9) return false;
    if (this.phase !== 'waiting') return false;
    if (this.players.find(p => p.id === id)) return false;
    this.players.push({
      id,
      name,
      chips: 1000,
      cards: [],
      bet: 0,
      status: 'active',
      isDealer: false,
      hasActed: false,
    });
    return true;
  }

  removePlayer(id: string) {
    if (this.phase === 'waiting') {
      this.players = this.players.filter(p => p.id !== id);
    } else {
      const player = this.players.find(p => p.id === id);
      if (player) {
        player.status = 'folded';
        if (this.getCurrentPlayer()?.id === id) {
          this.advanceToNextPlayer();
        }
      }
    }
  }

  canStart(): boolean {
    return this.players.length >= 2 && this.phase === 'waiting';
  }

  isHost(playerId: string): boolean {
    return this.players.length > 0 && this.players[0].id === playerId;
  }

  getPlayerCount(): number {
    return this.players.length;
  }

  getPhase(): GamePhase {
    return this.phase;
  }

  startHand(): boolean {
    if (!this.canStart()) return false;

    // Remove broke players (keep at least 2)
    const solvent = this.players.filter(p => p.chips > 0);
    if (solvent.length < 2) return false;
    this.players = solvent;

    this.players.forEach(p => {
      p.cards = [];
      p.bet = 0;
      p.status = 'active';
      p.isDealer = false;
      p.hasActed = false;
    });

    this.communityCards = [];
    this.pot = 0;
    this.winners = [];
    this.lastAction = '';
    this.currentBet = 0;
    this.minRaise = this.bigBlind;

    // Advance dealer button
    this.dealerIndex = this.nextActiveFrom(this.dealerIndex);
    this.players[this.dealerIndex].isDealer = true;

    // Blinds
    if (this.players.length === 2) {
      this.smallBlindIndex = this.dealerIndex;
      this.bigBlindIndex = this.nextActiveFrom(this.smallBlindIndex);
    } else {
      this.smallBlindIndex = this.nextActiveFrom(this.dealerIndex);
      this.bigBlindIndex = this.nextActiveFrom(this.smallBlindIndex);
    }

    this.postBlind(this.smallBlindIndex, this.smallBlind);
    this.postBlind(this.bigBlindIndex, this.bigBlind);
    this.currentBet = this.bigBlind;

    // Deal hole cards
    this.deck.reset();
    this.players.forEach(p => {
      p.cards = [this.deck.deal()!, this.deck.deal()!];
    });

    this.phase = 'preflop';

    // Pre-flop action starts after BB; BB gets option later
    this.currentPlayerIndex = this.nextActiveFrom(this.bigBlindIndex);
    this.players.forEach(p => (p.hasActed = false));

    return true;
  }

  private postBlind(index: number, amount: number) {
    const p = this.players[index];
    const posted = Math.min(amount, p.chips);
    p.chips -= posted;
    p.bet += posted;
    this.pot += posted;
    if (p.chips === 0) p.status = 'allin';
    p.hasActed = false;
  }

  handleAction(
    playerId: string,
    action: 'fold' | 'call' | 'check' | 'raise' | 'allin',
    amount?: number
  ): { success: boolean; error?: string } {
    if (this.phase === 'waiting' || this.phase === 'showdown') {
      return { success: false, error: 'ゲームが進行中ではありません' };
    }

    const current = this.getCurrentPlayer();
    if (!current || current.id !== playerId) {
      return { success: false, error: 'あなたのターンではありません' };
    }
    if (current.status !== 'active') {
      return { success: false, error: 'アクションできません' };
    }

    switch (action) {
      case 'fold':
        current.status = 'folded';
        current.hasActed = true;
        this.lastAction = `${current.name} がフォールド`;
        break;

      case 'check':
        if (current.bet < this.currentBet) {
          return { success: false, error: 'コールが必要です（チェックできません）' };
        }
        current.hasActed = true;
        this.lastAction = `${current.name} がチェック`;
        break;

      case 'call': {
        const needed = Math.min(this.currentBet - current.bet, current.chips);
        current.chips -= needed;
        current.bet += needed;
        this.pot += needed;
        current.hasActed = true;
        if (current.chips === 0) current.status = 'allin';
        this.lastAction = `${current.name} がコール (${needed})`;
        break;
      }

      case 'raise': {
        if (amount == null) return { success: false, error: 'レイズ額が必要です' };
        const raiseTo = Math.min(amount, current.chips + current.bet);
        if (raiseTo < this.currentBet + this.minRaise && raiseTo - current.bet < current.chips) {
          return { success: false, error: `最小レイズは ${this.currentBet + this.minRaise} です` };
        }
        const add = raiseTo - current.bet;
        this.minRaise = Math.max(this.minRaise, raiseTo - this.currentBet);
        current.chips -= add;
        current.bet = raiseTo;
        this.pot += add;
        this.currentBet = raiseTo;
        current.hasActed = true;
        if (current.chips === 0) current.status = 'allin';
        // Others need to respond
        this.players.forEach(p => {
          if (p.id !== current.id && p.status === 'active') p.hasActed = false;
        });
        this.lastAction = `${current.name} がレイズ → ${raiseTo}`;
        break;
      }

      case 'allin': {
        const allIn = current.chips;
        const newBet = current.bet + allIn;
        if (newBet > this.currentBet) {
          this.minRaise = Math.max(this.minRaise, newBet - this.currentBet);
          this.currentBet = newBet;
          this.players.forEach(p => {
            if (p.id !== current.id && p.status === 'active') p.hasActed = false;
          });
        }
        current.chips = 0;
        current.bet = newBet;
        this.pot += allIn;
        current.status = 'allin';
        current.hasActed = true;
        this.lastAction = `${current.name} がオールイン (${newBet})`;
        break;
      }

      default:
        return { success: false, error: '不明なアクション' };
    }

    this.advanceToNextPlayer();
    return { success: true };
  }

  private getCurrentPlayer(): Player | undefined {
    return this.players[this.currentPlayerIndex];
  }

  private advanceToNextPlayer() {
    const notFolded = this.players.filter(
      p => p.status !== 'folded' && p.status !== 'sitting_out'
    );
    if (notFolded.length === 1) {
      this.awardPot(notFolded);
      return;
    }

    if (this.isBettingRoundComplete()) {
      this.advancePhase();
      return;
    }

    // Skip folded/allin/sitting_out
    let next = (this.currentPlayerIndex + 1) % this.players.length;
    let safety = 0;
    while (
      (this.players[next].status === 'folded' ||
        this.players[next].status === 'allin' ||
        this.players[next].status === 'sitting_out') &&
      safety++ < this.players.length
    ) {
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
    // Reset for next betting round
    this.players.forEach(p => {
      p.bet = 0;
      p.hasActed = false;
    });
    this.currentBet = 0;
    this.minRaise = this.bigBlind;

    const transitions: Record<string, GamePhase> = {
      preflop: 'flop',
      flop: 'turn',
      turn: 'river',
      river: 'showdown',
    };
    this.phase = transitions[this.phase] as GamePhase;

    if (this.phase === 'flop') {
      this.communityCards = [this.deck.deal()!, this.deck.deal()!, this.deck.deal()!];
    } else if (this.phase === 'turn' || this.phase === 'river') {
      this.communityCards.push(this.deck.deal()!);
    } else if (this.phase === 'showdown') {
      this.showdown();
      return;
    }

    // If ≤1 active player remaining, run out the board
    const active = this.players.filter(p => p.status === 'active');
    if (active.length <= 1) {
      while (this.communityCards.length < 5) {
        this.communityCards.push(this.deck.deal()!);
      }
      this.showdown();
      return;
    }

    // Post-flop action starts left of dealer
    this.currentPlayerIndex = this.nextActiveFrom(this.dealerIndex);
  }

  private showdown() {
    this.phase = 'showdown';
    const eligible = this.players.filter(
      p => p.status !== 'folded' && p.status !== 'sitting_out'
    );
    this.awardPot(eligible);
  }

  private awardPot(eligible: Player[]) {
    this.phase = 'showdown';
    this.winners = [];

    if (eligible.length === 1) {
      eligible[0].chips += this.pot;
      this.winners = [{
        playerId: eligible[0].id,
        playerName: eligible[0].name,
        amount: this.pot,
        hand: '最後の1人',
      }];
      this.pot = 0;
      return;
    }

    const evaluated = eligible.map(p => ({
      player: p,
      result: HandEvaluator.evaluate([...p.cards, ...this.communityCards]),
    }));
    evaluated.sort((a, b) => HandEvaluator.compare(b.result, a.result));

    const best = evaluated[0].result;
    const winners = evaluated.filter(e => HandEvaluator.compare(e.result, best) === 0);
    const share = Math.floor(this.pot / winners.length);
    const remainder = this.pot - share * winners.length;

    winners.forEach((w, i) => {
      const amount = share + (i === 0 ? remainder : 0);
      w.player.chips += amount;
      this.winners.push({
        playerId: w.player.id,
        playerName: w.player.name,
        amount,
        hand: w.result.description,
        cards: w.player.cards,
      });
    });

    this.pot = 0;
  }

  private nextActiveFrom(fromIndex: number): number {
    let idx = (fromIndex + 1) % this.players.length;
    let safety = 0;
    while (
      (this.players[idx].status === 'folded' || this.players[idx].status === 'sitting_out') &&
      safety++ < this.players.length
    ) {
      idx = (idx + 1) % this.players.length;
    }
    return idx;
  }

  resetForNewHand() {
    this.phase = 'waiting';
    this.winners = [];
    this.lastAction = '';
  }

  getState(forPlayerId?: string): GameState {
    return {
      roomId: this.roomId,
      players: this.players.map(p => {
        let cards: PublicCard[];
        if (this.phase === 'showdown') {
          cards = p.cards;
        } else if (p.id === forPlayerId) {
          cards = p.cards;
        } else {
          cards = p.cards.map(() => ({ hidden: true }));
        }
        return {
          id: p.id,
          name: p.name,
          chips: p.chips,
          cards,
          bet: p.bet,
          status: p.status,
          isDealer: p.isDealer,
          hasActed: p.hasActed,
        };
      }),
      communityCards: this.communityCards,
      pot: this.pot,
      phase: this.phase,
      currentPlayerIndex: this.currentPlayerIndex,
      dealerIndex: this.dealerIndex,
      smallBlindIndex: this.smallBlindIndex,
      bigBlindIndex: this.bigBlindIndex,
      currentBet: this.currentBet,
      smallBlind: this.smallBlind,
      bigBlind: this.bigBlind,
      minRaise: this.minRaise,
      winners: this.winners,
      lastAction: this.lastAction,
    };
  }
}
