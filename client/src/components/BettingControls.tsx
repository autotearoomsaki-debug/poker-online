import { useState } from 'react';
import { GameState, PublicPlayer } from '../types';

interface Props {
  gameState: GameState;
  me: PublicPlayer;
  onAction: (type: 'fold' | 'call' | 'check' | 'raise' | 'allin', amount?: number) => void;
}

export default function BettingControls({ gameState, me, onAction }: Props) {
  const [raiseAmount, setRaiseAmount] = useState(gameState.currentBet + gameState.minRaise);

  const callAmount = Math.min(gameState.currentBet - me.bet, me.chips);
  const canCheck = me.bet >= gameState.currentBet;
  const minRaiseTotal = gameState.currentBet + gameState.minRaise;
  const maxRaise = me.chips + me.bet;
  const canRaise = me.chips > callAmount && maxRaise >= minRaiseTotal;

  const handleRaiseChange = (val: number) => {
    setRaiseAmount(Math.min(Math.max(val, minRaiseTotal), maxRaise));
  };

  return (
    <div style={styles.container}>
      <div style={styles.info}>
        <span>現在のベット: <strong>${gameState.currentBet}</strong></span>
        <span>ポット: <strong>${gameState.pot}</strong></span>
        <span>手持ち: <strong>${me.chips}</strong></span>
      </div>

      <div style={styles.buttons}>
        <button
          style={{ ...styles.btn, ...styles.foldBtn }}
          onClick={() => onAction('fold')}
        >
          フォールド
        </button>

        {canCheck ? (
          <button
            style={{ ...styles.btn, ...styles.checkBtn }}
            onClick={() => onAction('check')}
          >
            チェック
          </button>
        ) : (
          <button
            style={{ ...styles.btn, ...styles.callBtn }}
            onClick={() => onAction('call')}
          >
            コール ${callAmount}
          </button>
        )}

        {canRaise && (
          <div style={styles.raiseGroup}>
            <div style={styles.raiseRow}>
              <input
                type="range"
                min={minRaiseTotal}
                max={maxRaise}
                step={gameState.bigBlind}
                value={raiseAmount}
                onChange={e => handleRaiseChange(Number(e.target.value))}
                style={styles.slider}
              />
              <input
                type="number"
                value={raiseAmount}
                min={minRaiseTotal}
                max={maxRaise}
                onChange={e => handleRaiseChange(Number(e.target.value))}
                style={styles.raiseInput}
              />
            </div>
            <div style={styles.presetRow}>
              {[
                { label: 'ハーフ', val: Math.round(gameState.pot / 2) },
                { label: 'ポット', val: gameState.pot },
                { label: '2x BB', val: gameState.bigBlind * 2 + gameState.currentBet },
              ].map(p => (
                <button
                  key={p.label}
                  style={styles.presetBtn}
                  onClick={() => handleRaiseChange(p.val)}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <button
              style={{ ...styles.btn, ...styles.raiseBtn }}
              onClick={() => onAction('raise', raiseAmount)}
            >
              レイズ → ${raiseAmount}
            </button>
          </div>
        )}

        <button
          style={{ ...styles.btn, ...styles.allInBtn }}
          onClick={() => onAction('allin')}
        >
          オールイン ${me.chips + me.bet}
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: 'rgba(0,0,0,0.6)',
    borderTop: '1px solid rgba(255,255,255,0.1)',
    padding: '16px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  info: {
    display: 'flex',
    gap: 24,
    color: '#aaa',
    fontSize: 13,
    justifyContent: 'center',
  },
  buttons: {
    display: 'flex',
    gap: 10,
    justifyContent: 'center',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
  },
  btn: {
    border: 'none',
    borderRadius: 8,
    padding: '12px 20px',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'opacity 0.2s',
  },
  foldBtn: {
    background: '#636e72',
    color: '#fff',
  },
  checkBtn: {
    background: '#00b894',
    color: '#fff',
  },
  callBtn: {
    background: '#0984e3',
    color: '#fff',
  },
  raiseBtn: {
    background: '#6c5ce7',
    color: '#fff',
    width: '100%',
  },
  allInBtn: {
    background: 'linear-gradient(135deg, #d63031, #e17055)',
    color: '#fff',
  },
  raiseGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    minWidth: 260,
  },
  raiseRow: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  },
  slider: {
    flex: 1,
    accentColor: '#6c5ce7',
  },
  raiseInput: {
    background: 'rgba(255,255,255,0.1)',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: 6,
    color: '#fff',
    padding: '6px 8px',
    width: 80,
    fontSize: 13,
  },
  presetRow: {
    display: 'flex',
    gap: 6,
  },
  presetBtn: {
    flex: 1,
    background: 'rgba(108,92,231,0.3)',
    border: '1px solid #6c5ce7',
    borderRadius: 6,
    color: '#a29bfe',
    padding: '4px 8px',
    fontSize: 11,
    cursor: 'pointer',
  },
};
