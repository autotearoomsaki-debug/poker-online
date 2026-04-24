import { PublicPlayer } from '../types';
import Card from './Card';

interface Props {
  player: PublicPlayer;
  isCurrentPlayer: boolean;
  isMe: boolean;
  isDealer: boolean;
  isSB: boolean;
  isBB: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  active: '',
  folded: 'FOLD',
  allin: 'ALL-IN',
  sitting_out: 'OUT',
};

const STATUS_COLOR: Record<string, string> = {
  active: '#2ecc71',
  folded: '#636e72',
  allin: '#e17055',
  sitting_out: '#636e72',
};

export default function PlayerSeat({ player, isCurrentPlayer, isMe, isDealer, isSB, isBB }: Props) {
  const statusLabel = STATUS_LABEL[player.status];
  const isFolded = player.status === 'folded';

  return (
    <div style={{
      ...styles.seat,
      opacity: isFolded ? 0.5 : 1,
      outline: isCurrentPlayer ? '2px solid #f0c040' : 'none',
      outlineOffset: 3,
      background: isMe ? 'rgba(240,192,64,0.1)' : 'rgba(255,255,255,0.06)',
    }}>
      {/* Badges */}
      <div style={styles.badges}>
        {isDealer && <span style={styles.badge('D', '#f0c040')}>D</span>}
        {isSB && <span style={styles.badge('SB', '#74b9ff')}>SB</span>}
        {isBB && <span style={styles.badge('BB', '#a29bfe')}>BB</span>}
        {statusLabel && (
          <span style={{ ...styles.statusBadge, background: STATUS_COLOR[player.status] }}>
            {statusLabel}
          </span>
        )}
        {isCurrentPlayer && !isFolded && (
          <span style={styles.turnBadge}>TURN</span>
        )}
      </div>

      {/* Cards */}
      <div style={styles.cards}>
        {player.cards.length > 0
          ? player.cards.map((c, i) => <Card key={i} card={c} small />)
          : <div style={styles.noCards} />}
      </div>

      {/* Player info */}
      <div style={styles.name}>{player.name}{isMe ? ' (自分)' : ''}</div>
      <div style={styles.chips}>${player.chips.toLocaleString()}</div>

      {/* Current bet */}
      {player.bet > 0 && (
        <div style={styles.bet}>ベット: ${player.bet}</div>
      )}
    </div>
  );
}

const styles = {
  seat: {
    borderRadius: 12,
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 4,
    border: '1px solid rgba(255,255,255,0.1)',
    minWidth: 100,
    position: 'relative' as const,
    transition: 'outline 0.2s',
  },
  badges: {
    display: 'flex',
    gap: 4,
    flexWrap: 'wrap' as const,
    justifyContent: 'center',
    minHeight: 20,
  },
  badge: (letter: string, bg: string): React.CSSProperties => ({
    background: bg,
    color: '#1a1a2e',
    fontSize: 10,
    fontWeight: 700,
    borderRadius: 4,
    padding: '1px 5px',
    lineHeight: '16px',
  }),
  statusBadge: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 700,
    borderRadius: 4,
    padding: '1px 5px',
    lineHeight: '16px',
  } as React.CSSProperties,
  turnBadge: {
    background: '#f0c040',
    color: '#1a1a2e',
    fontSize: 10,
    fontWeight: 700,
    borderRadius: 4,
    padding: '1px 5px',
    lineHeight: '16px',
    animation: 'pulse 1s infinite',
  } as React.CSSProperties,
  cards: {
    display: 'flex',
    gap: 4,
    justifyContent: 'center',
    minHeight: 60,
    alignItems: 'center',
  },
  noCards: {
    width: 92,
    height: 58,
    border: '1px dashed rgba(255,255,255,0.15)',
    borderRadius: 6,
  },
  name: {
    fontSize: 13,
    fontWeight: 600,
    color: '#eee',
    maxWidth: 120,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  chips: {
    fontSize: 14,
    fontWeight: 700,
    color: '#f0c040',
  },
  bet: {
    fontSize: 11,
    color: '#74b9ff',
    background: 'rgba(116,185,255,0.15)',
    borderRadius: 4,
    padding: '2px 6px',
  },
};
