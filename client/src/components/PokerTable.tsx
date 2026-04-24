import { useEffect, useState } from 'react';
import { GameState } from '../types';
import Card from './Card';
import PlayerSeat from './PlayerSeat';
import BettingControls from './BettingControls';
import HandInfo from './HandInfo';
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

  useEffect(() => {
    const h = () => setWindowW(window.innerWidth);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  // ショーダウンになったら 1 秒「判定中...」を表示してから演出を出す
  useEffect(() => {
    if (gameState?.phase === 'showdown') {
      setJudging(true);
      const t = setTimeout(() => {
        setJudging(false);
        setShowCelebration(true);
      }, 1000);
      return () => clearTimeout(t);
    } else {
      setJudging(false);
      setShowCelebration(false);
    }
  }, [gameState?.phase, gameState?.winners]);

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
      {/* ── 優勝演出オーバーレイ ── */}
      {showCelebration && gameState.gameOver && (
        <GameOverCelebration
          winnerName={gameState.gameOver.winnerName}
          isMe={gameState.gameOver.winnerId === myId}
          onReset={handleReset}
        />
      )}
      {showCelebration && !gameState.gameOver && gameState.winners.length > 0 && (
        <HandWinCelebration
          winners={gameState.winners}
          myId={myId}
          onNext={handleNext}
          pot={gameState.pot}
        />
      )}

      {/* ── ヘッダー ── */}
      <div style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#888', fontSize: 11 }}>ROOM</span>
          <strong style={styles.roomId}>{gameState.roomId}</strong>
          <button onClick={copyRoomId} style={styles.copyBtn}>
            {copied ? '✓' : 'コピー'}
          </button>
        </div>
        <div style={styles.phaseBadge}>{PHASE_LABEL[gameState.phase]}</div>
        <div style={{ fontSize: 12, color: '#888' }}>{gameState.players.length}人参加中</div>
      </div>

      {error && <div style={styles.errorBar}>{error}</div>}
      {gameState.lastAction && !error && (
        <div style={styles.actionLog}>{gameState.lastAction}</div>
      )}

      {/* ── テーブル ── */}
      {isMobile
        ? <MobileLayout gameState={gameState} myId={myId} myIdx={myIdx} onStartGame={onStartGame} isHost={isHost} />
        : <OvalLayout gameState={gameState} myId={myId} myIdx={myIdx} onStartGame={onStartGame} isHost={isHost} />
      }

      {/* ── 自分のホールカード（大きく表示） ── */}
      {me && me.cards.length > 0 && gameState.phase !== 'waiting' && (
        <div style={styles.myHoleCards}>
          <div style={{ display: 'flex', gap: isMobile ? 8 : 12, alignItems: 'center' }}>
            {me.cards.map((c, i) => (
              <Card key={i} card={c} animationDelay={i * 150} />
            ))}
          </div>
          {/* ハンド情報をカードの右に配置 */}
          {me.status !== 'folded' && gameState.myHandDescription && gameState.phase !== 'showdown' && (
            <div style={styles.myHandLabel}>
              <div style={{ color: '#888', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {PHASE_LABEL[gameState.phase] ?? gameState.phase}
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
        <HandInfo
          handDescription={undefined}
          draws={gameState.myDraws}
          phase={gameState.phase}
        />
      )}

      {/* ── 判定中インジケーター ── */}
      {judging && (
        <div style={styles.judging}>判定中...</div>
      )}

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

function OvalLayout({ gameState, myId, myIdx, onStartGame, isHost }: {
  gameState: GameState; myId: string; myIdx: number;
  onStartGame: () => void; isHost: boolean;
}) {
  return (
    <div style={styles.tableWrapper}>
      {/* Blue felt oval */}
      <div style={styles.tableOval}>
        <Board gameState={gameState} onStartGame={onStartGame} isHost={isHost} />
      </div>
      {gameState.players.map((player, idx) => (
        <div key={player.id} style={getSeatStyle(idx, myIdx, gameState.players.length)}>
          <PlayerSeat
            player={player}
            isCurrentPlayer={
              gameState.phase !== 'waiting' && gameState.phase !== 'showdown' &&
              idx === gameState.currentPlayerIndex
            }
            isMe={player.id === myId}
            isDealer={idx === gameState.dealerIndex}
            isSB={gameState.phase !== 'waiting' && idx === gameState.smallBlindIndex}
            isBB={gameState.phase !== 'waiting' && idx === gameState.bigBlindIndex}
            hideCards={player.id === myId}
          />
        </div>
      ))}
    </div>
  );
}

// ─── モバイルレイアウト ───────────────────────────────

function MobileLayout({ gameState, myId, myIdx, onStartGame, isHost }: {
  gameState: GameState; myId: string; myIdx: number;
  onStartGame: () => void; isHost: boolean;
}) {
  const others = gameState.players.filter(p => p.id !== myId);
  const me = gameState.players[myIdx];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 12px', overflow: 'auto' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
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
            />
          );
        })}
      </div>
      <Board gameState={gameState} onStartGame={onStartGame} isHost={isHost} mobile />
      {me && (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <PlayerSeat
            player={me}
            isCurrentPlayer={gameState.phase !== 'waiting' && gameState.phase !== 'showdown' && myIdx === gameState.currentPlayerIndex}
            isMe
            isDealer={myIdx === gameState.dealerIndex}
            isSB={gameState.phase !== 'waiting' && myIdx === gameState.smallBlindIndex}
            isBB={gameState.phase !== 'waiting' && myIdx === gameState.bigBlindIndex}
            hideCards
          />
        </div>
      )}
    </div>
  );
}

// ─── ボード（コミュニティカード + ポット + 待機） ────────

function Board({ gameState, onStartGame, isHost, mobile = false }: {
  gameState: GameState; onStartGame: () => void; isHost: boolean; mobile?: boolean;
}) {
  const style: React.CSSProperties = mobile
    ? {
        background: 'rgba(21,101,192,0.4)',
        border: '2px solid rgba(100,160,255,0.2)',
        borderRadius: 16, padding: '12px 16px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
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
          color: '#fff', fontWeight: 800, fontSize: mobile ? 14 : 16,
          background: 'rgba(0,0,0,0.45)',
          borderRadius: 20, padding: '3px 16px',
          border: '1px solid rgba(255,255,255,0.15)',
          letterSpacing: 0.5,
        }}>
          POT <span style={{ color: '#f0c040' }}>${gameState.pot.toLocaleString()}</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: mobile ? 4 : 6, alignItems: 'center', minHeight: mobile ? 58 : 86 }}>
        {gameState.communityCards.length > 0
          ? gameState.communityCards.map((c, i) => (
              <Card key={i} card={c} small={mobile} animationDelay={i * 150} />
            ))
          : <p style={{ color: 'rgba(255,255,255,0.18)', fontSize: 12, fontStyle: 'italic' }}>
              コミュニティカード
            </p>
        }
      </div>

      {gameState.phase === 'waiting' && (
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#b2bec3', fontSize: 14, marginBottom: 12 }}>
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
    minHeight: '100vh', display: 'flex', flexDirection: 'column',
    background: 'linear-gradient(160deg, #0f1923 0%, #1a2636 50%, #0f1923 100%)',
    overflow: 'hidden',
  },
  loading: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', minHeight: '100vh',
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
    padding: '8px 16px',
    background: 'rgba(0,0,0,0.5)',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    flexWrap: 'wrap', gap: 6,
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
    borderRadius: 6, padding: '3px 12px', fontSize: 12, fontWeight: 700,
  },
  errorBar: {
    background: 'rgba(214,48,49,0.15)', color: '#ff6b6b',
    borderBottom: '1px solid rgba(214,48,49,0.3)',
    padding: '6px 20px', fontSize: 13, textAlign: 'center',
  },
  actionLog: {
    background: 'rgba(255,255,255,0.03)', color: '#90a4ae',
    padding: '4px 20px', fontSize: 12, textAlign: 'center',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  },
  tableWrapper: {
    flex: 1, position: 'relative', margin: '16px 20px', minHeight: 460,
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
    display: 'flex', alignItems: 'center', gap: 16,
    padding: '10px 20px',
    background: 'rgba(0,0,0,0.5)',
    borderTop: '1px solid rgba(255,255,255,0.07)',
  },
  myHandLabel: {
    display: 'flex', flexDirection: 'column', gap: 2,
  },
  actionBtn: {
    background: 'linear-gradient(135deg, #f0c040, #e8a020)',
    color: '#1a1a2e', border: 'none', borderRadius: 8,
    padding: '12px 28px', fontSize: 15, fontWeight: 700, cursor: 'pointer',
  },
  waitingTurn: {
    textAlign: 'center', padding: '12px', color: '#546e7a', fontSize: 13,
    background: 'rgba(0,0,0,0.35)', borderTop: '1px solid rgba(255,255,255,0.05)',
  },
  judging: {
    textAlign: 'center', padding: '14px', color: '#f0c040', fontSize: 16,
    fontWeight: 700, letterSpacing: 2,
    background: 'rgba(0,0,0,0.5)', borderTop: '1px solid rgba(240,192,64,0.2)',
    animation: 'pulse 0.8s ease-in-out infinite',
  },
};
