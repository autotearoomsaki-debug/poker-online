import { PublicPlayer } from '../types';
import Card from './Card';

interface Props {
  player: PublicPlayer;
  isCurrentPlayer: boolean;
  isMe: boolean;
  isDealer: boolean;
  isSB: boolean;
  isBB: boolean;
  compact?: boolean;
}

export default function PlayerSeat({
  player, isCurrentPlayer, isMe, isDealer, isSB, isBB, compact = false,
}: Props) {
  const folded = player.status === 'folded';
  const disconnected = !player.connected;

  const seatStyle: React.CSSProperties = {
    background: isMe
      ? 'rgba(240,192,64,0.12)'
      : 'rgba(255,255,255,0.06)',
    border: isCurrentPlayer
      ? '2px solid #f0c040'
      : disconnected
        ? '2px solid #e17055'
        : '1px solid rgba(255,255,255,0.12)',
    borderRadius: 12,
    padding: compact ? '6px 8px' : '8px 10px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 3,
    opacity: folded ? 0.45 : 1,
    transition: 'border 0.2s, opacity 0.3s',
    minWidth: compact ? 90 : 110,
    maxWidth: compact ? 110 : 140,
    animation: isCurrentPlayer ? 'pulse 1.2s infinite' : undefined,
  };

  return (
    <div style={seatStyle}>
      {/* バッジ行 */}
      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', justifyContent: 'center', minHeight: 16 }}>
        {isDealer && <Badge label="D" color="#f0c040" />}
        {isSB && <Badge label="SB" color="#74b9ff" />}
        {isBB && <Badge label="BB" color="#a29bfe" />}
        {player.status === 'allin' && <Badge label="ALL-IN" color="#e17055" />}
        {folded && <Badge label="FOLD" color="#636e72" />}
        {disconnected && <Badge label="切断" color="#e17055" />}
        {isCurrentPlayer && !folded && <Badge label="▶" color="#f0c040" />}
      </div>

      {/* カード */}
      <div style={{ display: 'flex', gap: 3, minHeight: compact ? 50 : 60, alignItems: 'center' }}>
        {player.cards.length > 0
          ? player.cards.map((c, i) => (
              <Card key={i} card={c} small animationDelay={i * 120} />
            ))
          : <div style={{
              width: compact ? 88 : 90, height: compact ? 50 : 58,
              border: '1px dashed rgba(255,255,255,0.12)',
              borderRadius: 6,
            }} />
        }
      </div>

      {/* 名前 */}
      <div style={{
        fontSize: compact ? 11 : 12, fontWeight: 600, color: isMe ? '#f0c040' : '#dfe6e9',
        maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {player.name}
      </div>

      {/* チップ */}
      <div style={{ fontSize: compact ? 12 : 13, fontWeight: 700, color: '#f0c040' }}>
        ${player.chips.toLocaleString()}
      </div>

      {/* ベット表示 */}
      {player.bet > 0 && (
        <div style={{
          fontSize: 11, color: '#74b9ff',
          background: 'rgba(116,185,255,0.15)',
          borderRadius: 4, padding: '1px 5px',
        }}>
          bet ${player.bet}
        </div>
      )}
    </div>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      background: color, color: '#1a1a2e',
      fontSize: 9, fontWeight: 800,
      borderRadius: 3, padding: '1px 4px', lineHeight: '14px',
    }}>
      {label}
    </span>
  );
}
