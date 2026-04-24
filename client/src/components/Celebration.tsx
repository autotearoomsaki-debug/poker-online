import { useMemo } from 'react';
import { Winner, PublicPlayer } from '../types';
import Card from './Card';

interface HandWinProps {
  winners: Winner[];
  myId: string;
  onNext: () => void;
  pot: number;
  allPlayers?: PublicPlayer[];
}

interface GameOverProps {
  winnerName: string;
  isMe: boolean;
  onReset: () => void;
}

// ─── コンフェッティ ─────────────────────────────────

const CONFETTI_COLORS = ['#f0c040','#e17055','#74b9ff','#00b894','#a29bfe','#fd79a8','#fdcb6e'];

function Confetti({ count = 80 }: { count?: number }) {
  const pieces = useMemo(() =>
    Array.from({ length: count }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      size: 6 + Math.random() * 7,
      delay: Math.random() * 2.5,
      duration: 2.2 + Math.random() * 2,
      isCircle: Math.random() > 0.5,
    })), [count]);

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 100 }}>
      {pieces.map(p => (
        <div key={p.id} style={{
          position: 'absolute', top: -10, left: `${p.left}%`,
          width: p.size, height: p.size,
          background: p.color,
          borderRadius: p.isCircle ? '50%' : 2,
          animation: `confettiFall ${p.duration}s ${p.delay}s ease-in both`,
        }} />
      ))}
    </div>
  );
}

// ─── ハンド勝利演出 ─────────────────────────────────

export function HandWinCelebration({ winners, myId, onNext, pot, allPlayers }: HandWinProps) {
  const iWon = winners.some(w => w.playerId === myId);
  const isLastMan = winners.some(w => w.hand === '最後の1人');

  // 全プレイヤーをカテゴリ分け
  const winnerIds = new Set(winners.map(w => w.playerId));

  return (
    <>
      {iWon && <Confetti count={isLastMan ? 120 : 70} />}

      <div style={overlayStyle}>
        <div style={{ ...cardStyle, maxWidth: 480 }}>
          {/* アイコン */}
          <div style={{ fontSize: 52, animation: 'trophyBounce 1s ease-in-out infinite', lineHeight: 1 }}>
            {iWon ? '🏆' : '🃏'}
          </div>

          {/* タイトル */}
          <div style={{ fontSize: 20, fontWeight: 900, color: '#f0c040', marginTop: 4 }}>
            {isLastMan
              ? (iWon ? '全員フォールド！あなたの勝ち！' : `${winners[0].playerName} の勝ち！`)
              : (iWon ? 'ショーダウン勝利！' : 'ショーダウン結果')
            }
          </div>

          {/* ─── 全員の結果テーブル ─── */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>

            {/* 勝者 */}
            {winners.map(w => (
              <ResultRow
                key={w.playerId}
                isWinner
                isMe={w.playerId === myId}
                name={w.playerName}
                hand={w.hand && w.hand !== '最後の1人' ? w.hand : undefined}
                foldedLabel={w.hand === '最後の1人' ? '全員フォールド' : undefined}
                cards={w.cards}
                amount={w.amount}
                potLabel={w.potLabel}
              />
            ))}

            {/* 敗者・フォールド */}
            {allPlayers
              ?.filter(p => !winnerIds.has(p.id))
              .map(p => {
                const folded = p.status === 'folded';
                const hasRealCards = p.cards.length > 0 && !p.cards[0].hidden;
                return (
                  <ResultRow
                    key={p.id}
                    isWinner={false}
                    isMe={p.id === myId}
                    name={p.name}
                    hand={!folded && p.handDescription ? p.handDescription : undefined}
                    foldedLabel={folded ? 'フォールド' : undefined}
                    cards={hasRealCards ? p.cards : undefined}
                    amount={undefined}
                  />
                );
              })
            }
          </div>

          {/* POT合計 */}
          <div style={{ color: '#636e72', fontSize: 12, marginTop: 2 }}>
            合計ポット ${pot.toLocaleString()}
          </div>

          {/* 次へ */}
          <button style={nextBtnStyle} onClick={onNext}>
            次のハンドへ →
          </button>
        </div>
      </div>
    </>
  );
}

// ─── 1プレイヤー分の結果行 ────────────────────────────

function ResultRow({ isWinner, isMe, name, hand, foldedLabel, cards, amount, potLabel }: {
  isWinner: boolean;
  isMe: boolean;
  name: string;
  hand?: string;
  foldedLabel?: string;
  cards?: { suit?: string; rank?: string; hidden?: boolean }[];
  amount?: number;
  potLabel?: string;
}) {
  const border = isWinner
    ? 'rgba(240,192,64,0.5)'
    : foldedLabel
      ? 'rgba(255,255,255,0.06)'
      : 'rgba(255,255,255,0.1)';

  const bg = isWinner
    ? (isMe ? 'rgba(240,192,64,0.18)' : 'rgba(240,192,64,0.09)')
    : foldedLabel
      ? 'rgba(255,255,255,0.03)'
      : 'rgba(255,255,255,0.07)';

  return (
    <div style={{
      background: bg,
      border: `1px solid ${border}`,
      borderRadius: 10, padding: '9px 14px',
      display: 'flex', flexDirection: 'column', gap: 5,
      opacity: foldedLabel ? 0.6 : 1,
    }}>
      {/* 上段: 名前 + 手役 + 金額 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {/* 結果バッジ */}
        {isWinner && (
          <span style={{
            background: '#f0c040', color: '#1a1a2e',
            fontSize: 9, fontWeight: 900, borderRadius: 4, padding: '2px 5px',
            letterSpacing: 0.5,
          }}>WIN</span>
        )}
        {foldedLabel && (
          <span style={{
            background: 'rgba(144,164,174,0.25)', color: '#90a4ae',
            fontSize: 9, fontWeight: 900, borderRadius: 4, padding: '2px 5px',
            letterSpacing: 0.5, border: '1px solid rgba(144,164,174,0.3)',
          }}>{foldedLabel.toUpperCase()}</span>
        )}
        {!isWinner && !foldedLabel && (
          <span style={{
            background: 'rgba(239,83,80,0.2)', color: '#ef5350',
            fontSize: 9, fontWeight: 900, borderRadius: 4, padding: '2px 5px',
            letterSpacing: 0.5, border: '1px solid rgba(239,83,80,0.3)',
          }}>LOSE</span>
        )}

        {/* 名前 */}
        <span style={{ fontWeight: 700, color: isMe ? '#f0c040' : '#eee', fontSize: 14 }}>
          {name}
          {isMe && <span style={{ color: '#74b9ff', fontSize: 11, marginLeft: 4 }}>(あなた)</span>}
          {potLabel && potLabel !== 'ポット' && (
            <span style={{ color: '#a29bfe', fontSize: 10, marginLeft: 5 }}>({potLabel})</span>
          )}
        </span>

        {/* 手役 */}
        {hand && (
          <span style={{
            background: isWinner ? 'rgba(240,192,64,0.2)' : 'rgba(255,255,255,0.1)',
            border: `1px solid ${isWinner ? 'rgba(240,192,64,0.4)' : 'rgba(255,255,255,0.15)'}`,
            borderRadius: 6, padding: '2px 8px',
            color: isWinner ? '#f0c040' : '#90caf9', fontSize: 12, fontWeight: 700,
          }}>
            {hand}
          </span>
        )}

        {/* 獲得額 */}
        {amount !== undefined && (
          <span style={{ marginLeft: 'auto', color: '#00e676', fontWeight: 900, fontSize: 16 }}>
            +${amount.toLocaleString()}
          </span>
        )}
      </div>

      {/* 下段: ホールカード */}
      {cards && cards.length > 0 && (
        <div style={{ display: 'flex', gap: 5 }}>
          {cards.map((c, i) => (
            <Card key={i} card={c as any} small animationDelay={i * 80} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── ゲームオーバー演出 ─────────────────────────────

export function GameOverCelebration({ winnerName, isMe, onReset }: GameOverProps) {
  return (
    <>
      <Confetti count={150} />
      <div style={overlayStyle}>
        <div style={{ ...cardStyle, maxWidth: 440 }}>
          <div style={{ fontSize: 72, animation: 'trophyBounce 1s ease-in-out infinite' }}>🏆</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: '#f0c040', textAlign: 'center', lineHeight: 1.3 }}>
            {isMe ? 'あなたの優勝！' : `${winnerName} の優勝！`}
          </div>
          <div style={{ color: '#b2bec3', fontSize: 13, textAlign: 'center', lineHeight: 1.6 }}>
            {isMe
              ? '全プレイヤーを倒しチップを総取り！\n素晴らしいプレイでした！'
              : `${winnerName} がすべてのチップを獲得しました。`
            }
          </div>
          <button style={nextBtnStyle} onClick={onReset}>もう一度プレイ</button>
        </div>
      </div>
    </>
  );
}

// ─── スタイル定数 ───────────────────────────────────

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.78)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 200, padding: 16,
  overflowY: 'auto',
};

const cardStyle: React.CSSProperties = {
  background: 'linear-gradient(160deg, #1e2a4a, #0f1c35)',
  border: '2px solid rgba(240,192,64,0.4)',
  borderRadius: 20, padding: '24px 20px',
  maxWidth: 480, width: '100%',
  display: 'flex', flexDirection: 'column',
  alignItems: 'center', gap: 10,
  animation: 'celebrationIn 0.4s cubic-bezier(0.34,1.56,0.64,1)',
  boxShadow: '0 0 60px rgba(240,192,64,0.2)',
};

const nextBtnStyle: React.CSSProperties = {
  marginTop: 8,
  background: 'linear-gradient(135deg, #f0c040, #e8a020)',
  color: '#1a1a2e', border: 'none', borderRadius: 10,
  padding: '13px 28px', fontSize: 15, fontWeight: 900, cursor: 'pointer',
};
