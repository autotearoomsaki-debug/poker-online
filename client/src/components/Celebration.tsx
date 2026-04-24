import { useMemo } from 'react';
import { Winner } from '../types';
import Card from './Card';

interface HandWinProps {
  winners: Winner[];
  myId: string;
  onNext: () => void;
  pot: number;
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
        <div
          key={p.id}
          style={{
            position: 'absolute',
            top: -10,
            left: `${p.left}%`,
            width: p.size,
            height: p.size,
            background: p.color,
            borderRadius: p.isCircle ? '50%' : 2,
            animation: `confettiFall ${p.duration}s ${p.delay}s ease-in both`,
          }}
        />
      ))}
    </div>
  );
}

// ─── ハンド勝利演出 ─────────────────────────────────

export function HandWinCelebration({ winners, myId, onNext, pot }: HandWinProps) {
  const iWon = winners.some(w => w.playerId === myId);
  const isLastMan = winners.some(w => w.hand === '最後の1人');

  return (
    <>
      {iWon && <Confetti count={isLastMan ? 120 : 70} />}

      <div style={overlayStyle}>
        <div style={cardStyle}>
          {/* トロフィー */}
          <div style={{ fontSize: 56, animation: 'trophyBounce 1s ease-in-out infinite', lineHeight: 1 }}>
            {iWon ? '🏆' : '🃏'}
          </div>

          {/* タイトル */}
          <div style={{ fontSize: 22, fontWeight: 800, color: '#f0c040', marginTop: 8 }}>
            {isLastMan
              ? iWon ? '全員フォールド！あなたの勝ち！' : `${winners[0].playerName} の勝ち！`
              : iWon ? 'ショーダウン勝利！' : 'ショーダウン結果'
            }
          </div>

          {/* 勝者詳細 */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            {winners.map(w => (
              <div
                key={w.playerId}
                style={{
                  background: w.playerId === myId
                    ? 'rgba(240,192,64,0.15)'
                    : 'rgba(255,255,255,0.06)',
                  border: `1px solid ${w.playerId === myId ? 'rgba(240,192,64,0.4)' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: 10,
                  padding: '10px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <div style={{ fontWeight: 700, color: w.playerId === myId ? '#f0c040' : '#eee', fontSize: 15 }}>
                  {w.playerName}
                  {w.potLabel && w.potLabel !== 'ポット' &&
                    <span style={{ color: '#a29bfe', fontSize: 11, marginLeft: 6 }}>({w.potLabel})</span>
                  }
                </div>
                <div style={{ color: '#00b894', fontWeight: 800, fontSize: 20 }}>
                  +${w.amount.toLocaleString()}
                </div>
                {w.hand && w.hand !== '最後の1人' && (
                  <div style={{ color: '#74b9ff', fontSize: 13 }}>{w.hand}</div>
                )}
                {w.cards && w.cards.length > 0 && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    {w.cards.map((c, i) => <Card key={i} card={c} small />)}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* 次へボタン */}
          <button style={nextBtnStyle} onClick={onNext}>
            次のハンドへ →
          </button>
        </div>
      </div>
    </>
  );
}

// ─── ゲームオーバー演出 ─────────────────────────────

export function GameOverCelebration({ winnerName, isMe, onReset }: GameOverProps) {
  return (
    <>
      <Confetti count={150} />
      <div style={overlayStyle}>
        <div style={{ ...cardStyle, maxWidth: 440 }}>
          <div style={{ fontSize: 72, animation: 'trophyBounce 1s ease-in-out infinite' }}>
            🏆
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#f0c040', textAlign: 'center', lineHeight: 1.3 }}>
            {isMe ? 'あなたの優勝！' : `${winnerName} の優勝！`}
          </div>
          <div style={{ color: '#b2bec3', fontSize: 14, textAlign: 'center', lineHeight: 1.6 }}>
            {isMe
              ? '全プレイヤーを倒しチップを総取り！\n素晴らしいプレイでした！'
              : `${winnerName} がすべてのチップを獲得しました。`
            }
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button style={nextBtnStyle} onClick={onReset}>
              もう一度プレイ
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── スタイル定数 ───────────────────────────────────

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.75)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 200,
  padding: 20,
};

const cardStyle: React.CSSProperties = {
  background: 'linear-gradient(160deg, #1e2a4a, #0f1c35)',
  border: '2px solid rgba(240,192,64,0.4)',
  borderRadius: 20,
  padding: '32px 28px',
  maxWidth: 400,
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 12,
  animation: 'celebrationIn 0.4s cubic-bezier(0.34,1.56,0.64,1)',
  boxShadow: '0 0 60px rgba(240,192,64,0.2)',
};

const nextBtnStyle: React.CSSProperties = {
  marginTop: 6,
  background: 'linear-gradient(135deg, #f0c040, #e8a020)',
  color: '#1a1a2e',
  border: 'none',
  borderRadius: 10,
  padding: '13px 28px',
  fontSize: 15,
  fontWeight: 800,
  cursor: 'pointer',
};
