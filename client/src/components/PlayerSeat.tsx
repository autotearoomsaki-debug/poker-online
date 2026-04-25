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
  latestAction?: string;
}

const CHIP_COLORS = ['#f0c040', '#e17055', '#74b9ff', '#00b894', '#a29bfe', '#fd79a8'];

function MiniChips({ amount, compact }: { amount: number; compact: boolean }) {
  const size = compact ? 9 : 11;
  const count = amount >= 500 ? 4 : amount >= 200 ? 3 : amount >= 50 ? 2 : 1;
  const overlap = Math.round(size * 0.42);
  return (
    <div style={{ position: 'relative', width: size + (count - 1) * overlap, height: size, flexShrink: 0 }}>
      {CHIP_COLORS.slice(0, count).map((color, i) => (
        <div key={i} style={{
          position: 'absolute', left: i * overlap,
          width: size, height: size, borderRadius: '50%',
          background: `radial-gradient(circle at 35% 30%, ${color}, ${color}99)`,
          border: '1.5px solid rgba(0,0,0,0.55)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.25)',
          zIndex: i,
        }} />
      ))}
    </div>
  );
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

interface ActionInfo { bg: string; accent: string; label: string; amount?: string }

function parseAction(text: string): ActionInfo {
  if (text.includes('フォールド') || text.includes('切断'))
    return { bg: '#37474f', accent: '#90a4ae', label: 'FOLD' };
  if (text.includes('チェック'))
    return { bg: '#00695c', accent: '#80cbc4', label: 'CHECK' };
  if (text.includes('オールイン')) {
    const m = text.match(/\$([0-9,]+)/);
    return { bg: '#b71c1c', accent: '#ef9a9a', label: 'ALL IN', amount: m?.[1] };
  }
  if (text.includes('ベット')) {
    const m = text.match(/\$([0-9,]+)$/);
    return { bg: '#4527a0', accent: '#b39ddb', label: 'BET', amount: m?.[1] };
  }
  if (text.includes('レイズ')) {
    const m = text.match(/\$([0-9,]+)$/);
    return { bg: '#6a1b9a', accent: '#ce93d8', label: 'RAISE', amount: m?.[1] };
  }
  if (text.includes('コール')) {
    const m = text.match(/\$([0-9,]+)/);
    return { bg: '#1565c0', accent: '#90caf9', label: 'CALL', amount: m?.[1] };
  }
  return { bg: '#263238', accent: '#b0bec5', label: text.slice(0, 10) };
}

export default function PlayerSeat({
  player, isCurrentPlayer, isMe, isDealer, isSB, isBB,
  compact = false, hideCards = false, latestAction,
}: Props) {
  const folded = player.status === 'folded';
  const allin = player.status === 'allin';
  const disconnected = !player.connected;

  const colorIdx = [...player.id].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_GRADIENTS.length;
  const [grad1, grad2] = AVATAR_GRADIENTS[colorIdx];

  const ringColor = isCurrentPlayer
    ? '#f0c040'
    : disconnected ? '#e17055'
    : folded ? 'rgba(255,255,255,0.12)'
    : isMe ? '#74b9ff'
    : 'rgba(255,255,255,0.25)';

  const avatarSize = compact ? 52 : 60;
  const action = latestAction ? parseAction(latestAction) : null;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: compact ? 2 : 3,
      opacity: folded ? 0.48 : 1,
      minWidth: compact ? 76 : 90,
      maxWidth: compact ? 86 : 100,
      transition: 'opacity 0.3s',
    }}>

      {/* ── Avatar ring ── */}
      <div style={{
        width: avatarSize + 8, height: avatarSize + 8,
        borderRadius: '50%',
        border: `3px solid ${ringColor}`,
        padding: 2,
        boxShadow: isCurrentPlayer ? `0 0 18px ${ringColor}88` : undefined,
        animation: isCurrentPlayer ? 'avatarPulse 1.2s ease-in-out infinite' : undefined,
        position: 'relative',
        transition: 'border-color 0.3s, box-shadow 0.3s',
        flexShrink: 0,
      }}>
        <div style={{
          width: '100%', height: '100%', borderRadius: '50%',
          background: `linear-gradient(135deg, ${grad1}, ${grad2})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: compact ? 18 : 22, fontWeight: 800, color: '#fff',
          position: 'relative', overflow: 'hidden', userSelect: 'none',
        }}>
          {player.name.charAt(0).toUpperCase()}
          {folded && (
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              background: 'rgba(0,0,0,0.58)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9, fontWeight: 900, color: '#999', letterSpacing: 1,
            }}>FOLD</div>
          )}
          {allin && !folded && (
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              background: 'linear-gradient(90deg,#e17055,#d63031)',
              fontSize: 7, fontWeight: 900, color: '#fff',
              textAlign: 'center', letterSpacing: 0.5, padding: '2px 0',
            }}>ALL IN</div>
          )}
        </div>

        {/* D / SB / BB badge */}
        {(isDealer || isSB || isBB) && (
          <div style={{
            position: 'absolute', bottom: 0, right: 0,
            background: isDealer ? '#f0c040' : isSB ? '#74b9ff' : '#a29bfe',
            color: '#111', fontSize: 8, fontWeight: 900,
            borderRadius: '50%', width: 16, height: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid #1a1a2e',
          }}>
            {isDealer ? 'D' : isSB ? 'S' : 'B'}
          </div>
        )}

        {isCurrentPlayer && !folded && (
          <div style={{
            position: 'absolute', top: 1, right: 1,
            width: 9, height: 9, borderRadius: '50%',
            background: '#f0c040', border: '2px solid #1a1a2e',
            animation: 'avatarPulse 0.8s ease-in-out infinite',
          }} />
        )}
      </div>

      {/* ── 名前 ── */}
      <div style={{
        fontSize: compact ? 9 : 10, fontWeight: 700,
        color: isMe ? '#74b9ff' : '#dfe6e9',
        maxWidth: compact ? 80 : 96,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        textAlign: 'center',
      }}>
        {player.name}{disconnected ? ' ⚡' : ''}
      </div>

      {/* ── チップ ── */}
      <div style={{
        background: 'rgba(0,0,0,0.65)',
        border: '1px solid rgba(255,255,255,0.14)',
        borderRadius: 9, padding: `${compact ? 1 : 2}px ${compact ? 6 : 8}px`,
        fontSize: compact ? 10 : 11, fontWeight: 800, color: '#f0c040',
      }}>
        ${player.chips.toLocaleString()}
      </div>

      {/* ── 勝率バー（オールイン時） ── */}
      {player.equity !== undefined && (
        <div style={{ width: '100%', maxWidth: compact ? 76 : 90 }}>
          <div style={{
            height: 5, borderRadius: 3,
            background: 'rgba(255,255,255,0.1)', overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', width: `${player.equity}%`,
              background: (player.equity) >= 60
                ? 'linear-gradient(90deg,#00e676,#00b894)'
                : (player.equity) >= 35
                  ? 'linear-gradient(90deg,#f0c040,#e8a020)'
                  : 'linear-gradient(90deg,#ef5350,#b71c1c)',
              borderRadius: 3, transition: 'width 1s ease',
            }} />
          </div>
          <div style={{
            textAlign: 'center', fontSize: 10, fontWeight: 900, marginTop: 1,
            color: (player.equity) >= 60 ? '#00e676' : (player.equity) >= 35 ? '#f0c040' : '#ef5350',
          }}>
            {player.equity}%
          </div>
        </div>
      )}

      {/* ── カード / アクション ゾーン ── */}
      {!isMe && !hideCards && (
        <div style={{
          width: '100%', minHeight: compact ? 46 : 58,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {action ? (
            /* アクションバッジ（カードの場所に大きく表示） */
            <div style={{
              width: '100%',
              background: `linear-gradient(160deg, ${action.bg}ee, ${action.bg}cc)`,
              border: `2px solid ${action.accent}88`,
              borderRadius: compact ? 8 : 10,
              padding: compact ? '6px 8px' : '8px 12px',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: compact ? 2 : 3,
              animation: 'actionBadge 5s ease-out both',
              boxShadow: `0 4px 18px ${action.bg}bb, inset 0 1px 0 ${action.accent}33`,
            }}>
              <span style={{
                fontSize: compact ? 10 : 11, fontWeight: 900,
                color: action.accent, letterSpacing: 1.5, textTransform: 'uppercase',
              }}>
                {action.label}
              </span>
              {action.amount && (
                <span style={{
                  fontSize: compact ? 19 : 24, fontWeight: 900, color: '#fff',
                  lineHeight: 1, textShadow: '0 1px 6px rgba(0,0,0,0.6)',
                }}>
                  ${action.amount}
                </span>
              )}
            </div>
          ) : folded ? null : (
            /* カード裏面を小さく表示 */
            player.cards.length > 0 && (
              <div style={{ display: 'flex', gap: compact ? 2 : 3 }}>
                {player.cards.map((_, i) => (
                  <div key={i} style={{
                    width: compact ? 18 : 22, height: compact ? 26 : 32,
                    borderRadius: compact ? 2 : 3,
                    background: 'linear-gradient(135deg, #1e3799, #0c2461)',
                    border: '1.5px solid rgba(255,255,255,0.18)',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
                  }} />
                ))}
              </div>
            )
          )}
        </div>
      )}

      {/* ── 自分のカード（isMe=trueかつhideCards=falseの場合。通常は hideCards=true） ── */}
      {isMe && !hideCards && player.cards.length > 0 && (
        <div style={{ display: 'flex', gap: 3 }}>
          {player.cards.map((c, i) => (
            <Card key={i} card={c} small animationDelay={i * 110} />
          ))}
        </div>
      )}

      {/* ── ベット表示（チップ絵＋金額） ── */}
      {player.bet > 0 && !action && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          background: 'rgba(0,0,0,0.6)',
          border: '1px solid rgba(116,185,255,0.3)',
          borderRadius: 8, padding: compact ? '2px 5px' : '2px 7px',
          animation: 'chipPopInline 0.25s cubic-bezier(0.34,1.6,0.64,1) both',
        }}>
          <MiniChips amount={player.bet} compact={compact} />
          <span style={{ color: '#74b9ff', fontSize: compact ? 9 : 10, fontWeight: 800 }}>
            ${player.bet.toLocaleString()}
          </span>
        </div>
      )}
    </div>
  );
}
