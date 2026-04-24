import { Card as CardType } from '../types';

interface Props {
  card: CardType;
  small?: boolean;
}

const SUIT_SYMBOL: Record<string, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
};

const RED_SUITS = new Set(['hearts', 'diamonds']);

export default function Card({ card, small = false }: Props) {
  if (card.hidden) {
    return (
      <div style={{ ...styles.card(small), ...styles.hidden }}>
        <span style={styles.back}>🂠</span>
      </div>
    );
  }

  const isRed = RED_SUITS.has(card.suit ?? '');
  const color = isRed ? '#d63031' : '#2d3436';

  return (
    <div style={styles.card(small)}>
      <div style={{ ...styles.corner, color }}>
        <div style={styles.rank}>{card.rank}</div>
        <div style={styles.suit}>{SUIT_SYMBOL[card.suit ?? '']}</div>
      </div>
      <div style={{ ...styles.center, color }}>{SUIT_SYMBOL[card.suit ?? '']}</div>
      <div style={{ ...styles.corner, ...styles.bottomRight, color }}>
        <div style={styles.rank}>{card.rank}</div>
        <div style={styles.suit}>{SUIT_SYMBOL[card.suit ?? '']}</div>
      </div>
    </div>
  );
}

const styles = {
  card: (small: boolean): React.CSSProperties => ({
    background: '#fff',
    border: '2px solid #ddd',
    borderRadius: small ? 6 : 10,
    width: small ? 44 : 64,
    height: small ? 60 : 88,
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
    userSelect: 'none',
    flexShrink: 0,
  }),
  hidden: {
    background: 'linear-gradient(135deg, #2980b9, #1a1a6e)',
    border: '2px solid #555',
  } as React.CSSProperties,
  back: {
    fontSize: 28,
    color: 'rgba(255,255,255,0.3)',
  } as React.CSSProperties,
  corner: {
    position: 'absolute',
    top: 4,
    left: 6,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    lineHeight: 1,
  } as React.CSSProperties,
  bottomRight: {
    top: 'auto',
    left: 'auto',
    bottom: 4,
    right: 6,
    transform: 'rotate(180deg)',
  } as React.CSSProperties,
  rank: {
    fontSize: 13,
    fontWeight: 700,
  } as React.CSSProperties,
  suit: {
    fontSize: 11,
  } as React.CSSProperties,
  center: {
    fontSize: 24,
    lineHeight: 1,
  } as React.CSSProperties,
};
