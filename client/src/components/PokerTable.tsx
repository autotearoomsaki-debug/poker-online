import { GameState } from '../types';
import Card from './Card';
import PlayerSeat from './PlayerSeat';
import BettingControls from './BettingControls';

interface Props {
  gameState: GameState | null;
  myId: string;
  onStartGame: () => void;
  onAction: (type: 'fold' | 'call' | 'check' | 'raise' | 'allin', amount?: number) => void;
  onNewHand: () => void;
  error: string;
}

const PHASE_LABEL: Record<string, string> = {
  waiting: '待機中',
  preflop: 'プリフロップ',
  flop: 'フロップ',
  turn: 'ターン',
  river: 'リバー',
  showdown: 'ショーダウン',
};

export default function PokerTable({ gameState, myId, onStartGame, onAction, onNewHand, error }: Props) {
  if (!gameState) {
    return (
      <div style={styles.loading}>
        <p>接続中...</p>
      </div>
    );
  }

  const me = gameState.players.find(p => p.id === myId);
  const isMyTurn =
    gameState.phase !== 'waiting' &&
    gameState.phase !== 'showdown' &&
    gameState.players[gameState.currentPlayerIndex]?.id === myId &&
    me?.status === 'active';

  const isHost = gameState.players[0]?.id === myId;
  const roomId = gameState.roomId;

  return (
    <div style={styles.wrapper}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.roomInfo}>
          ルームID: <strong style={styles.roomId}>{roomId}</strong>
          <span style={styles.copyHint}>← 友達に共有</span>
        </div>
        <div style={styles.phase}>{PHASE_LABEL[gameState.phase]}</div>
      </div>

      {/* Error */}
      {error && <div style={styles.errorBanner}>{error}</div>}

      {/* Last action */}
      {gameState.lastAction && (
        <div style={styles.actionLog}>{gameState.lastAction}</div>
      )}

      {/* Main table */}
      <div style={styles.tableArea}>
        {/* Players grid */}
        <div style={styles.playersGrid}>
          {gameState.players.map((player, idx) => (
            <PlayerSeat
              key={player.id}
              player={player}
              isCurrentPlayer={
                gameState.phase !== 'waiting' &&
                gameState.phase !== 'showdown' &&
                idx === gameState.currentPlayerIndex
              }
              isMe={player.id === myId}
              isDealer={idx === gameState.dealerIndex}
              isSB={idx === gameState.smallBlindIndex && gameState.phase !== 'waiting'}
              isBB={idx === gameState.bigBlindIndex && gameState.phase !== 'waiting'}
            />
          ))}
        </div>

        {/* Community cards & pot */}
        <div style={styles.board}>
          <div style={styles.pot}>
            POT: <strong>${gameState.pot.toLocaleString()}</strong>
          </div>
          <div style={styles.communityCards}>
            {gameState.communityCards.length > 0
              ? gameState.communityCards.map((c, i) => <Card key={i} card={c} />)
              : <p style={styles.noCards}>コミュニティカード</p>}
          </div>
        </div>

        {/* Showdown result */}
        {gameState.phase === 'showdown' && gameState.winners.length > 0 && (
          <div style={styles.showdownPanel}>
            <h3 style={styles.showdownTitle}>ショーダウン結果</h3>
            {gameState.winners.map(w => (
              <div key={w.playerId} style={styles.winnerRow}>
                <strong>{w.playerName}</strong> が ${w.amount.toLocaleString()} 獲得
                {w.hand && <span style={styles.handDesc}> — {w.hand}</span>}
                {w.cards && (
                  <div style={styles.winnerCards}>
                    {w.cards.map((c, i) => <Card key={i} card={c} small />)}
                  </div>
                )}
              </div>
            ))}
            {isHost && (
              <button style={styles.newHandBtn} onClick={onNewHand}>
                次のハンドを始める
              </button>
            )}
          </div>
        )}

        {/* Waiting state */}
        {gameState.phase === 'waiting' && (
          <div style={styles.waitingPanel}>
            <p style={styles.waitingText}>
              {gameState.players.length} 人が参加中
              {gameState.players.length < 2 && ' — あと1人以上必要'}
            </p>
            {isHost ? (
              <button
                style={{
                  ...styles.startBtn,
                  opacity: gameState.players.length >= 2 ? 1 : 0.5,
                }}
                onClick={onStartGame}
                disabled={gameState.players.length < 2}
              >
                ゲーム開始
              </button>
            ) : (
              <p style={styles.waitingHost}>ホストがゲームを開始するのを待っています...</p>
            )}
          </div>
        )}
      </div>

      {/* Betting controls */}
      {isMyTurn && me && (
        <BettingControls
          gameState={gameState}
          me={me}
          onAction={onAction}
        />
      )}
      {!isMyTurn && gameState.phase !== 'waiting' && gameState.phase !== 'showdown' && me?.status === 'active' && (
        <div style={styles.waitingTurn}>他のプレイヤーのターンを待っています...</div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    color: '#aaa',
    fontSize: 18,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 24px',
    background: 'rgba(0,0,0,0.4)',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  roomInfo: {
    fontSize: 13,
    color: '#aaa',
  },
  roomId: {
    color: '#f0c040',
    fontSize: 16,
    marginLeft: 6,
    letterSpacing: 1,
  },
  copyHint: {
    color: '#636e72',
    fontSize: 11,
    marginLeft: 8,
  },
  phase: {
    background: 'rgba(240,192,64,0.15)',
    color: '#f0c040',
    border: '1px solid rgba(240,192,64,0.3)',
    borderRadius: 6,
    padding: '4px 12px',
    fontSize: 13,
    fontWeight: 700,
  },
  errorBanner: {
    background: 'rgba(214,48,49,0.15)',
    color: '#ff6b6b',
    borderBottom: '1px solid rgba(214,48,49,0.3)',
    padding: '8px 24px',
    fontSize: 13,
    textAlign: 'center',
  },
  actionLog: {
    background: 'rgba(255,255,255,0.04)',
    color: '#b2bec3',
    padding: '6px 24px',
    fontSize: 13,
    textAlign: 'center',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
  },
  tableArea: {
    flex: 1,
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
    alignItems: 'center',
  },
  playersGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
    maxWidth: 900,
    width: '100%',
  },
  board: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    background: 'rgba(0,100,0,0.3)',
    border: '2px solid rgba(0,180,0,0.25)',
    borderRadius: 20,
    padding: '20px 40px',
    minWidth: 400,
  },
  pot: {
    color: '#f0c040',
    fontSize: 18,
    fontWeight: 700,
  },
  communityCards: {
    display: 'flex',
    gap: 8,
    minHeight: 88,
    alignItems: 'center',
  },
  noCards: {
    color: 'rgba(255,255,255,0.2)',
    fontSize: 13,
    fontStyle: 'italic',
  },
  showdownPanel: {
    background: 'rgba(240,192,64,0.08)',
    border: '1px solid rgba(240,192,64,0.25)',
    borderRadius: 16,
    padding: '20px 32px',
    maxWidth: 600,
    width: '100%',
    textAlign: 'center',
  },
  showdownTitle: {
    color: '#f0c040',
    fontSize: 18,
    marginBottom: 16,
  },
  winnerRow: {
    color: '#eee',
    fontSize: 15,
    marginBottom: 12,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
  },
  handDesc: {
    color: '#74b9ff',
    fontSize: 13,
  },
  winnerCards: {
    display: 'flex',
    gap: 6,
    justifyContent: 'center',
    marginTop: 4,
  },
  newHandBtn: {
    marginTop: 16,
    background: 'linear-gradient(135deg, #f0c040, #e8a020)',
    color: '#1a1a2e',
    border: 'none',
    borderRadius: 8,
    padding: '12px 28px',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
  },
  waitingPanel: {
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
    padding: 24,
  },
  waitingText: {
    color: '#b2bec3',
    fontSize: 15,
  },
  waitingHost: {
    color: '#636e72',
    fontSize: 14,
    fontStyle: 'italic',
  },
  startBtn: {
    background: 'linear-gradient(135deg, #f0c040, #e8a020)',
    color: '#1a1a2e',
    border: 'none',
    borderRadius: 8,
    padding: '14px 36px',
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
  },
  waitingTurn: {
    textAlign: 'center',
    padding: '16px',
    color: '#636e72',
    fontSize: 13,
    background: 'rgba(0,0,0,0.3)',
    borderTop: '1px solid rgba(255,255,255,0.08)',
  },
};
