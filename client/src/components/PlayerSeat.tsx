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
  hideCards?: boolean;
}

const AVATAR_GRADIENTS = [
  ['#6c5ce7', '#a29bfe'],
  ['#e17055', '#fab1a0'],
  ['#00b894', '#00cec9'],
  ['#0984e3', '#74b9ff'],
  ['#fd79a8', '#e84393'],
  ['#fdcb6e', '#e17055'],
  ['#55efc4', '#00b894'],
  ['#636e72', '#b2bec3'],
];

export default function PlayerSeat({
  player, isCurrentPlayer, isMe, isDealer, isSB, isBB, compact = false, hideCards = false,
}: Props) {
  const folded = player.status === 'folded';
  const allin = player.status === 'allin';
  const disconnected = !player.connected;

  const colorIdx = [...player.id].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_GRADIENTS.length;
  const [grad1, grad2] = AVATAR_GRADIENTS[colorIdx];

  const ringColor = isCurrentPlayer
    ? '#f0c040'
    : disconnected
      ? '#e17055'
      : folded
        ? 'rgba(255,255,255,0.12)'
        : isMe
          ? '#74b9ff'
          : 'rgba(255,255,255,0.25)';

  const avatarSize = compact ? 56 : 64;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: compact ? 2 : 3,
      opacity: folded ? 0.5 : 1,
      minWidth: compact ? 72 : 84,
      transition: 'opacity 0.3s',
    }}>

      {/* ── Avatar ring ── */}
      <div style={{
        width: avatarSize + 8, height: avatarSize + 8,
        borderRadius: '50%',
        border: `3px solid ${ringColor}`,
        padding: 2,
        boxShadow: isCurrentPlayer ? `0 0 18px ${ringColor}88, 0 0 6px ${ringColor}44` : undefined,
        animation: isCurrentPlayer ? 'avatarPulse 1.2s ease-in-out infinite' : undefined,
        position: 'relative',
        transition: 'border-color 0.3s, box-shadow 0.3s',
        flexShrink: 0,
      }}>
        {/* Avatar circle */}
        <div style={{
          width: '100%', height: '100%',
          borderRadius: '50%',
          background: `linear-gradient(135deg, ${grad1}, ${grad2})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: compact ? 20 : 24,
          fontWeight: 800, color: '#fff',
          position: 'relative', overflow: 'hidden',
          userSelect: 'none',
        }}>
          {player.name.charAt(0).toUpperCase()}

          {/* FOLD dim overlay */}
          {folded && (
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              background: 'rgba(0,0,0,0.6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: compact ? 9 : 10, fontWeight: 900, color: '#999', letterSpacing: 1,
            }}>
              FOLD
            </div>
          )}

          {/* ALL-IN strip */}
          {allin && !folded && (
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              background: 'linear-gradient(90deg,#e17055,#d63031)',
              fontSize: 7, fontWeight: 900, color: '#fff',
              textAlign: 'center', letterSpacing: 0.5, padding: '2px 0',
            }}>
              ALL IN
            </div>
          )}
        </div>

        {/* D / SB / BB badge (bottom-right of ring) */}
        {(isDealer || isSB || isBB) && (
          <div style={{
            position: 'absolute', bottom: 0, right: 0,
            background: isDealer ? '#f0c040' : isSB ? '#74b9ff' : '#a29bfe',
            color: '#111', fontSize: 8, fontWeight: 900,
            borderRadius: '50%', width: 17, height: 17,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid #1a1a2e',
            boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
          }}>
            {isDealer ? 'D' : isSB ? 'S' : 'B'}
          </div>
        )}

        {/* Active turn dot (top-right) */}
        {isCurrentPlayer && !folded && (
          <div style={{
            position: 'absolute', top: 1, right: 1,
            width: 10, height: 10, borderRadius: '50%',
            background: '#f0c040',
            border: '2px solid #1a1a2e',
            animation: 'avatarPulse 0.8s ease-in-out infinite',
          }} />
        )}
      </div>

      {/* ── Name ── */}
      <div style={{
        fontSize: compact ? 10 : 11, fontWeight: 700,
        color: isMe ? '#74b9ff' : '#dfe6e9',
        maxWidth: compact ? 74 : 86,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        textAlign: 'center',
      }}>
        {player.name}{disconnected ? ' ⚡' : ''}
      </div>

      {/* ── Chips ── */}
      <div style={{
        background: 'rgba(0,0,0,0.65)',
        border: '1px solid rgba(255,255,255,0.14)',
        borderRadius: 10, padding: `${compact ? 1 : 2}px ${compact ? 7 : 9}px`,
        fontSize: compact ? 11 : 12, fontWeight: 800, color: '#f0c040',
        letterSpacing: 0.3,
      }}>
        ${player.chips.toLocaleString()}
      </div>

      {/* ── Bet chip ── */}
      {player.bet > 0 && (
        <div style={{
          background: 'rgba(116,185,255,0.18)',
          border: '1px solid rgba(116,185,255,0.45)',
          borderRadius: 8, padding: '1px 7px',
          fontSize: 10, color: '#74b9ff', fontWeight: 700,
        }}>
          {player.bet.toLocaleString()}
        </div>
      )}

      {/* ── Other players' cards ── */}
      {!hideCards && !isMe && player.cards.length > 0 && (
        <div style={{ display: 'flex', gap: 2, marginTop: 1 }}>
          {player.cards.map((c, i) => (
            <Card key={i} card={c} small animationDelay={i * 110} />
          ))}
        </div>
      )}
    </div>
  );
}
