import { useEffect, useRef, useState } from 'react';
import { GameState } from '../types';
import Card from './Card';
import PlayerSeat from './PlayerSeat';
import BettingControls from './BettingControls';
import HandInfo from './HandInfo';
import ActionToast from './ActionToast';
import { HandWinCelebration, GameOverCelebration } from './Celebration';

interface Props {
  gameState: GameState | null;
  myId: string;
  onStartGame: () => void;
  onAction: (type: 'fold' | 'call' | 'check' | 'raise' | 'allin', amount?: number) => void;
  onNewHand: () => void;
  onResetGame: () => void;
  error: string;
}

const PHASE_LABEL: Record<string, string> = {
  waiting: '待機中', preflop: 'プリフロップ', flop: 'フロップ',
  turn: 'ターン', river: 'リバー', showdown: 'ショーダウン',
};

function getSeatStyle(idx: number, myIdx: number, total: number): React.CSSProperties {
  const offset = ((idx - myIdx + total) % total) / total;
  const angle = Math.PI / 2 + offset * 2 * Math.PI;
  return {
    position: 'absolute',
    left: `${50 + 44 * Math.cos(angle)}%`,
    top: `${50 + 39 * Math.sin(angle)}%`,
    transform: 'translate(-50%, -50%)',
    zIndex: 2,
  };
}

export default function PokerTable({ gameState, myId, onStartGame, onAction, onNewHand, onResetGame, error }: Props) {
  const [windowW, setWindowW] = useState(window.innerWidth);
  const [showCelebration, setShowCelebration] = useState(false);
  const [judging, setJudging] = useState(false);
  const [allInFlash, setAllInFlash] = useState(false);
  // プレイヤーごとのアクション表示 {playerId → actionText}
  const [playerActions, setPlayerActions] = useState<Record<string, string>>({});

  useEffect(() => {
    const h = () => setWindowW(window.innerWidth);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  // ショーダウン 1 秒待機
  useEffect(() => {
    if (gameState?.phase === 'showdown') {
      setJudging(true);
      const t = setTimeout(() => { setJudging(false); setShowCelebration(true); }, 1000);
      return () => clearTimeout(t);
    } else {
      setJudging(false);
      setShowCelebration(false);
    }
  }, [gameState?.phase, gameState?.winners]);

  // ALL-IN フラッシュ
  useEffect(() => {
    if (gameState?.lastAction?.includes('オールイン')) {
      setAllInFlash(true);
      const t = setTimeout(() => setAllInFlash(false), 1800);
      return () => clearTimeout(t);
    }
  }, [gameState?.lastAction]);

  // 誰がアクションしたか追跡（座席バッジ用）
  useEffect(() => {
    const action = gameState?.lastAction;
    if (!action || !gameState) return;
    const nameMatch = action.match(/^(.+?)\s+(が|→)/);
    if (!nameMatch) return;
    const name = nameMatch[1];
    const player = gameState.players.find(p => p.name === name);
    if (!player) return;
    const id = player.id;
    // アクションのコア部分（名前を除く）
    const core = action.replace(/^.+?が/, '');
    setPlayerActions(prev => ({ ...prev, [id]: core }));
    const t = setTimeout(() => setPlayerActions(prev => {
      const n = { ...prev }; delete n[id]; return n;
    }), 2500);
    return () => clearTimeout(t);
  }, [gameState?.lastAction]);

  const [copied, setCopied] = useState(false);
  const copyRoomId = () => {
    if (!gameState) return;
    navigator.clipboard.writeText(gameState.roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isMobile = windowW < 700;

  if (!gameState) {
    return (
      <div style={styles.loading}>
        <div style={styles.spinner} />
        <p style={{ color: '#aaa', marginTop: 16 }}>接続中...</p>
      </div>
    );
  }

  const myIdx = gameState.players.findIndex(p => p.id === myId);
  const me = myIdx >= 0 ? gameState.players[myIdx] : null;
  const isMyTurn =
    gameState.phase !== 'waiting' && gameState.phase !== 'showdown' &&
    gameState.players[gameState.currentPlayerIndex]?.id === myId &&
    me?.status === 'active';
  const isHost = gameState.players[0]?.id === myId;

  const handleNext = () => { setShowCelebration(false); onNewHand(); };
  const handleReset = () => { setShowCelebration(false); onResetGame(); };

  return (
    <div style={styles.wrapper}>
      {/* ── ALL-IN フラッシュ ── */}
      {allInFlash && (
        <div style={styles.allInOverlay}>
          <div style={styles.allInText}>ALL IN!</div>
          {/* チップ雨 */}
          {Array.from({ length: 18 }, (_, i) => (
            <div key={i} style={{
              position: 'absolute',
              left: `${5 + i * 5.2}%`,
              top: `${20 + (i % 5) * 8}%`,
              fontSize: 20 + (i % 4) * 6,
              animation: `chipRain ${0.8 + (i % 4) * 0.3}s ${(i % 6) * 0.15}s ease-in both`,
              pointerEvents: 'none',
            }}>
              {['🪙', '💰', '🎰', '💎'][i % 4]}
            </div>
          ))}
        </div>
      )}

      {/* ── 優勝演出 ── */}
      {showCelebration && gameState.gameOver && (
        <GameOverCelebration winnerName={gameState.gameOver.winnerName} isMe={gameState.gameOver.winnerId === myId} onReset={handleReset} />
      )}
      {showCelebration && !gameState.gameOver && gameState.winners.length > 0 && (
        <HandWinCelebration
          winners={gameState.winners}
          myId={myId}
          onNext={handleNext}
          pot={gameState.pot}
          allPlayers={gameState.players}
        />
      )}

      {/* ── アクショントースト ── */}
      <ActionToast action={gameState.lastAction} />

      {/* ── ヘッダー ── */}
      <div style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#888', fontSize: 11 }}>ROOM</span>
          <strong style={styles.roomId}>{gameState.roomId}</strong>
          <button onClick={copyRoomId} style={styles.copyBtn}>{copied ? '✓' : 'コピー'}</button>
        </div>
        <div style={styles.phaseBadge}>{PHASE_LABEL[gameState.phase]}</div>
        <div style={{ fontSize: 12, color: '#888' }}>{gameState.players.length}人参加中</div>
      </div>

      {error && <div style={styles.errorBar}>{error}</div>}

      {/* ── テーブル ── */}
      <div style={styles.tableSection}>
        {isMobile
          ? <MobileLayout gameState={gameState} myId={myId} myIdx={myIdx} onStartGame={onStartGame} isHost={isHost} playerActions={playerActions} />
          : <OvalLayout gameState={gameState} myId={myId} myIdx={myIdx} onStartGame={onStartGame} isHost={isHost} playerActions={playerActions} />
        }
      </div>

      {/* ── 自分のホールカード ── */}
      {me && me.cards.length > 0 && gameState.phase !== 'waiting' && (
        <div style={styles.myHoleCards}>
          <div style={{ display: 'flex', gap: isMobile ? 8 : 10, alignItems: 'center' }}>
            {me.cards.map((c, i) => <Card key={i} card={c} animationDelay={i * 150} />)}
          </div>
          {me.status !== 'folded' && gameState.myHandDescription && gameState.phase !== 'showdown' && (
            <div style={styles.myHandLabel}>
              <div style={{ color: '#888', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {PHASE_LABEL[gameState.phase]}
              </div>
              <div style={{ color: '#f0c040', fontWeight: 800, fontSize: 15 }}>
                {gameState.myHandDescription}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ドロー情報 ── */}
      {me && me.status !== 'folded' && (
        <HandInfo handDescription={undefined} draws={gameState.myDraws} phase={gameState.phase} />
      )}

      {/* ── 判定中 ── */}
      {judging && <div style={styles.judging}>判定中...</div>}

      {/* ── ベット操作 ── */}
      {isMyTurn && me && (
        <BettingControls gameState={gameState} me={me} onAction={onAction} isMobile={isMobile} />
      )}
      {!isMyTurn && gameState.phase !== 'waiting' && gameState.phase !== 'showdown' && me?.status === 'active' && (
        <div style={styles.waitingTurn}>他のプレイヤーのターンを待っています...</div>
      )}
    </div>
  );
}

// ─── 楕円レイアウト ───────────────────────────────────

function OvalLayout({ gameState, myId, myIdx, onStartGame, isHost, playerActions }: {
  gameState: GameState; myId: string; myIdx: number;
  onStartGame: () => void; isHost: boolean;
  playerActions: Record<string, string>;
}) {
  return (
    <div style={styles.tableWrapper}>
      <div style={styles.tableOval}>
        <Board gameState={gameState} onStartGame={onStartGame} isHost={isHost} />
      </div>
      {gameState.players.map((player, idx) => (
        <div key={player.id} style={getSeatStyle(idx, myIdx, gameState.players.length)}>
          <PlayerSeat
            player={player}
            isCurrentPlayer={gameState.phase !== 'waiting' && gameState.phase !== 'showdown' && idx === gameState.currentPlayerIndex}
            isMe={player.id === myId}
            isDealer={idx === gameState.dealerIndex}
            isSB={gameState.phase !== 'waiting' && idx === gameState.smallBlindIndex}
            isBB={gameState.phase !== 'waiting' && idx === gameState.bigBlindIndex}
            hideCards={player.id === myId}
            latestAction={playerActions[player.id]}
          />
        </div>
      ))}
    </div>
  );
}

// ─── モバイルレイアウト ───────────────────────────────

function MobileLayout({ gameState, myId, myIdx, onStartGame, isHost, playerActions }: {
  gameState: GameState; myId: string; myIdx: number;
  onStartGame: () => void; isHost: boolean;
  playerActions: Record<string, string>;
}) {
  const others = gameState.players.filter(p => p.id !== myId);
  const me = gameState.players[myIdx];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 6, padding: '6px 10px', overflow: 'hidden' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center', flexShrink: 0 }}>
        {others.map(player => {
          const idx = gameState.players.indexOf(player);
          return (
            <PlayerSeat
              key={player.id}
              player={player}
              isCurrentPlayer={gameState.phase !== 'waiting' && gameState.phase !== 'showdown' && idx === gameState.currentPlayerIndex}
              isMe={false}
              isDealer={idx === gameState.dealerIndex}
              isSB={gameState.phase !== 'waiting' && idx === gameState.smallBlindIndex}
              isBB={gameState.phase !== 'waiting' && idx === gameState.bigBlindIndex}
              compact
              latestAction={playerActions[player.id]}
            />
          );
        })}
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <Board gameState={gameState} onStartGame={onStartGame} isHost={isHost} mobile />
      </div>
      {me && (
        <div style={{ display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
          <PlayerSeat
            player={me}
            isCurrentPlayer={gameState.phase !== 'waiting' && gameState.phase !== 'showdown' && myIdx === gameState.currentPlayerIndex}
            isMe
            isDealer={myIdx === gameState.dealerIndex}
            isSB={gameState.phase !== 'waiting' && myIdx === gameState.smallBlindIndex}
            isBB={gameState.phase !== 'waiting' && myIdx === gameState.bigBlindIndex}
            hideCards
            latestAction={playerActions[me.id]}
          />
        </div>
      )}
    </div>
  );
}

// ─── 勝率パネル ──────────────────────────────────────

function EquityPanel({ players, mobile }: { players: GameState['players']; mobile: boolean }) {
  const eligible = players.filter(p => p.equity !== undefined);
  if (eligible.length < 2) return null;

  return (
    <div style={{
      background: 'rgba(0,0,0,0.55)',
      border: '1px solid rgba(240,192,64,0.25)',
      borderRadius: 10,
      padding: mobile ? '5px 10px' : '6px 14px',
      display: 'flex', flexDirection: 'column', gap: 3,
      minWidth: mobile ? 180 : 220,
      animation: 'celebrationIn 0.3s ease-out',
    }}>
      <div style={{ textAlign: 'center', fontSize: 9, fontWeight: 900, color: '#f0c040', letterSpacing: 1, marginBottom: 1 }}>
        WIN PROBABILITY
      </div>
      {eligible.map(p => (
        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#ddd', minWidth: 50, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {p.name}
          </span>
          <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${p.equity}%`,
              background: (p.equity ?? 0) >= 60
                ? 'linear-gradient(90deg,#00e676,#00b894)'
                : (p.equity ?? 0) >= 35
                  ? 'linear-gradient(90deg,#f0c040,#e8a020)'
                  : 'linear-gradient(90deg,#ef5350,#b71c1c)',
              borderRadius: 3,
              transition: 'width 1s ease',
            }} />
          </div>
          <span style={{
            fontSize: 12, fontWeight: 900, minWidth: 30, textAlign: 'left',
            color: (p.equity ?? 0) >= 60 ? '#00e676' : (p.equity ?? 0) >= 35 ? '#f0c040' : '#ef5350',
          }}>
            {p.equity}%
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── ボード ───────────────────────────────────────────

function Board({ gameState, onStartGame, isHost, mobile = false }: {
  gameState: GameState; onStartGame: () => void; isHost: boolean; mobile?: boolean;
}) {
  // フロップは3枚一気に届くので、クライアント側で1枚ずつ演出する
  const [shownCount, setShownCount] = useState(0);
  const prevLen = useRef(0);
  const isFirstRender = useRef(true);

  useEffect(() => {
    const target = gameState.communityCards.length;

    if (target === 0) {
      setShownCount(0);
      prevLen.current = 0;
      isFirstRender.current = false;
      return;
    }

    // 参加直後（既存の状態）は即時表示
    if (isFirstRender.current) {
      setShownCount(target);
      prevLen.current = target;
      isFirstRender.current = false;
      return;
    }

    const prev = prevLen.current;
    prevLen.current = target;
    const diff = target - prev;
    if (diff <= 0) { setShownCount(target); return; }
    if (diff === 1) { setShownCount(target); return; } // ターン・リバーは即時

    // フロップ（3枚）: 750ms ずつ段階的に表示
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i < diff; i++) {
      timers.push(setTimeout(() => setShownCount(prev + i + 1), i * 750));
    }
    return () => timers.forEach(clearTimeout);
  }, [gameState.communityCards.length]);

  const visibleCards = gameState.communityCards.slice(0, shownCount);

  const style: React.CSSProperties = mobile
    ? {
        background: 'rgba(21,101,192,0.4)',
        border: '2px solid rgba(100,160,255,0.2)',
        borderRadius: 14, padding: '10px 14px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        height: '100%', justifyContent: 'center',
      }
    : {
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, zIndex: 1,
      };

  return (
    <div style={style}>
      {gameState.phase !== 'waiting' && (
        <div style={{
          color: '#fff', fontWeight: 800, fontSize: mobile ? 13 : 15,
          background: 'rgba(0,0,0,0.5)',
          borderRadius: 20, padding: '3px 14px',
          border: '1px solid rgba(255,255,255,0.12)',
        }}>
          POT <span style={{ color: '#f0c040' }}>${gameState.pot.toLocaleString()}</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: mobile ? 4 : 6, alignItems: 'center', minHeight: mobile ? 52 : 80 }}>
        {visibleCards.length > 0
          ? visibleCards.map((c, i) => (
              <div key={i} style={{ animation: 'flopCard 0.45s cubic-bezier(0.34,1.4,0.64,1) both' }}>
                <Card card={c} small={mobile} />
              </div>
            ))
          : <p style={{ color: 'rgba(255,255,255,0.18)', fontSize: 12, fontStyle: 'italic' }}>
              コミュニティカード
            </p>
        }
        {/* まだ表示されていないカードのプレースホルダー */}
        {gameState.communityCards.length > shownCount && (
          Array.from({ length: gameState.communityCards.length - shownCount }, (_, i) => (
            <div key={`ph-${i}`} style={{
              width: mobile ? 38 : 56, height: mobile ? 52 : 78,
              borderRadius: mobile ? 5 : 8,
              background: 'rgba(255,255,255,0.08)',
              border: '1px dashed rgba(255,255,255,0.2)',
              animation: 'pulse 0.8s ease-in-out infinite',
            }} />
          ))
        )}
      </div>

      {/* ── オールイン勝率パネル ── */}
      {gameState.players.some(p => p.equity !== undefined) && (
        <EquityPanel players={gameState.players} mobile={mobile} />
      )}

      {gameState.phase === 'waiting' && (
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#b2bec3', fontSize: 13, marginBottom: 10 }}>
            {gameState.players.length}人が参加中
            {gameState.players.length < 2 && ' — あと1人以上必要'}
          </p>
          {isHost ? (
            <button
              style={{ ...styles.actionBtn, opacity: gameState.players.length >= 2 ? 1 : 0.4 }}
              onClick={onStartGame}
              disabled={gameState.players.length < 2}
            >
              ゲーム開始
            </button>
          ) : (
            <p style={{ color: '#636e72', fontSize: 13, fontStyle: 'italic' }}>
              ホストがゲームを開始するのを待っています...
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── スタイル ────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    height: '100dvh',
    display: 'flex', flexDirection: 'column',
    background: 'linear-gradient(160deg, #0f1923 0%, #1a2636 50%, #0f1923 100%)',
    overflow: 'hidden',
  },
  loading: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', height: '100dvh',
  },
  spinner: {
    width: 40, height: 40,
    border: '3px solid rgba(240,192,64,0.2)',
    borderTop: '3px solid #f0c040',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '6px 14px',
    background: 'rgba(0,0,0,0.55)',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    flexWrap: 'wrap', gap: 4,
    flexShrink: 0,
  },
  roomId: { color: '#f0c040', fontSize: 20, letterSpacing: 4, fontWeight: 900 },
  copyBtn: {
    background: 'rgba(240,192,64,0.12)',
    border: '1px solid rgba(240,192,64,0.35)',
    borderRadius: 6, color: '#f0c040',
    padding: '2px 8px', fontSize: 11, cursor: 'pointer',
  },
  phaseBadge: {
    background: 'rgba(21,101,192,0.35)', color: '#90caf9',
    border: '1px solid rgba(144,202,249,0.3)',
    borderRadius: 6, padding: '3px 10px', fontSize: 12, fontWeight: 700,
  },
  errorBar: {
    background: 'rgba(214,48,49,0.15)', color: '#ff6b6b',
    borderBottom: '1px solid rgba(214,48,49,0.3)',
    padding: '5px 20px', fontSize: 12, textAlign: 'center', flexShrink: 0,
  },
  actionLog: {
    background: 'rgba(255,255,255,0.03)', color: '#90a4ae',
    padding: '3px 20px', fontSize: 12, textAlign: 'center',
    borderBottom: '1px solid rgba(255,255,255,0.04)', flexShrink: 0,
  },
  tableSection: {
    flex: 1, minHeight: 0, position: 'relative',
  },
  tableWrapper: {
    position: 'absolute', inset: '8px 12px',
  },
  tableOval: {
    position: 'absolute',
    top: '10%', left: '7%', right: '7%', bottom: '10%',
    borderRadius: '50%',
    background: 'radial-gradient(ellipse at 50% 40%, #1565c0 0%, #0d47a1 55%, #082d7a 100%)',
    border: '6px solid #051d52',
    boxShadow: 'inset 0 0 50px rgba(0,0,0,0.5), 0 8px 40px rgba(0,0,0,0.7)',
  },
  myHoleCards: {
    display: 'flex', alignItems: 'center', gap: 14,
    padding: '8px 16px',
    background: 'rgba(0,0,0,0.5)',
    borderTop: '1px solid rgba(255,255,255,0.07)',
    flexShrink: 0,
  },
  myHandLabel: {
    display: 'flex', flexDirection: 'column', gap: 1,
  },
  actionBtn: {
    background: 'linear-gradient(135deg, #f0c040, #e8a020)',
    color: '#1a1a2e', border: 'none', borderRadius: 8,
    padding: '11px 26px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
  },
  waitingTurn: {
    textAlign: 'center', padding: '10px', color: '#546e7a', fontSize: 12,
    background: 'rgba(0,0,0,0.35)', borderTop: '1px solid rgba(255,255,255,0.05)',
    flexShrink: 0,
  },
  judging: {
    textAlign: 'center', padding: '12px', color: '#f0c040', fontSize: 15,
    fontWeight: 700, letterSpacing: 2,
    background: 'rgba(0,0,0,0.5)', borderTop: '1px solid rgba(240,192,64,0.2)',
    animation: 'pulse 0.8s ease-in-out infinite',
    flexShrink: 0,
  },
  allInOverlay: {
    position: 'fixed', inset: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    pointerEvents: 'none', zIndex: 150,
    overflow: 'hidden',
  },
  allInText: {
    fontSize: 80, fontWeight: 900, color: '#ff6b35',
    textShadow: '0 0 60px #ff6b35, 0 0 120px #e17055',
    letterSpacing: 4,
    animation: 'allInZoom 1.8s ease-out forwards',
  },
};
