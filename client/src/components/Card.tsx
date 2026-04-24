import { Card as CardType } from '../types';

interface Props {
  card: CardType;
  small?: boolean;
  animationDelay?: number; // ms
}

const SUIT_SYMBOL: Record<string, string> = {
  spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣',
};
const RED_SUITS = new Set(['hearts', 'diamonds']);

export default function Card({ card, small = false, animationDelay = 0 }: Props) {
  const w = small ? 42 : 62;
  const h = small ? 58 : 86;
  const fontSize = small ? 11 : 13;
  const centerSize = small ? 20 : 24;

  const baseStyle: React.CSSProperties = {
    width: w, height: h,
    borderRadius: small ? 6 : 9,
    position: 'relative',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
    userSelect: 'none', flexShrink: 0,
    animationFillMode: 'both',
    animationDelay: `${animationDelay}ms`,
  };

  if (card.hidden) {
    return (
      <div style={{
        ...baseStyle,
        background: 'linear-gradient(135deg, #1e3799, #0c2461)',
        border: '2px solid rgba(255,255,255,0.15)',
        animation: 'cardDeal 0.25s ease-out',
      }}>
        <div style={{
          position: 'absolute', inset: 3,
          borderRadius: small ? 4 : 7,
          background: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 2px, transparent 2px, transparent 8px)',
        }} />
      </div>
    );
  }

  const isRed = RED_SUITS.has(card.suit ?? '');
  const color = isRed ? '#c0392b' : '#2c3e50';
  const sym = SUIT_SYMBOL[card.suit ?? ''] ?? '?';

  return (
    <div style={{
      ...baseStyle,
      background: '#fff',
      border: '2px solid #ddd',
      animation: 'cardFlip 0.3s ease-out',
    }}>
      {/* 左上 */}
      <div style={{ position: 'absolute', top: 3, left: 5, color, lineHeight: 1 }}>
        <div style={{ fontSize, fontWeight: 700 }}>{card.rank}</div>
        <div style={{ fontSize: fontSize - 1 }}>{sym}</div>
      </div>
      {/* 中央 */}
      <div style={{ fontSize: centerSize, color, lineHeight: 1 }}>{sym}</div>
      {/* 右下 (回転) */}
      <div style={{
        position: 'absolute', bottom: 3, right: 5, color,
        lineHeight: 1, transform: 'rotate(180deg)',
      }}>
        <div style={{ fontSize, fontWeight: 700 }}>{card.rank}</div>
        <div style={{ fontSize: fontSize - 1 }}>{sym}</div>
      </div>
    </div>
  );
}
