import { useState, useEffect } from 'react';
import { GameState, PublicPlayer } from '../types';

interface Props {
  gameState: GameState;
  me: PublicPlayer;
  onAction: (type: 'fold' | 'call' | 'check' | 'raise' | 'allin', amount?: number) => void;
  isMobile?: boolean;
}

export default function BettingControls({ gameState, me, onAction, isMobile = false }: Props) {
  const callAmount = Math.min(gameState.currentBet - me.bet, me.chips);
  const canCheck = me.bet >= gameState.currentBet;
  const minRaiseTotal = gameState.currentBet + gameState.minRaise;
  const maxRaise = me.chips + me.bet;
  const canRaise = me.chips > callAmount && maxRaise >= minRaiseTotal;

  const [raiseAmt, setRaiseAmt] = useState(minRaiseTotal);
  const [showRaise, setShowRaise] = useState(false);

  useEffect(() => {
    setRaiseAmt(Math.max(minRaiseTotal, raiseAmt));
    setShowRaise(false);
  }, [minRaiseTotal]);

  const clampRaise = (v: number) =>
    setRaiseAmt(Math.min(Math.max(Math.round(v), minRaiseTotal), maxRaise));

  const presets = [
    { label: '½ポット', val: Math.round(gameState.pot / 2 + gameState.currentBet) },
    { label: 'ポット', val: gameState.pot + gameState.currentBet },
    { label: '2×BB', val: gameState.bigBlind * 2 + gameState.currentBet },
  ].filter(p => p.val >= minRaiseTotal && p.val <= maxRaise);

  return (
    <div style={{ background: 'rgba(0,0,0,0.7)', borderTop: '1px solid rgba(255,255,255,0.08)' }}>

      {/* ── メインアクション行 ── */}
      <div style={{
        display: 'flex', gap: 8, padding: isMobile ? '10px 12px' : '12px 20px',
        alignItems: 'stretch',
      }}>
        {/* FOLD */}
        <button style={btnStyle('#455a64', '#37474f', false)} onClick={() => onAction('fold')}>
          FOLD
        </button>

        {/* CHECK or CALL */}
        {canCheck ? (
          <button style={btnStyle('#00897b', '#00695c', true)} onClick={() => onAction('check')}>
            CHECK
          </button>
        ) : (
          <button style={btnStyle('#1565c0', '#0d47a1', true)} onClick={() => onAction('call')}>
            <span style={{ fontSize: 17, fontWeight: 900 }}>CALL</span>
            <span style={{ fontSize: 13, fontWeight: 600, opacity: 0.85 }}>
              +{callAmount.toLocaleString()}
            </span>
          </button>
        )}

        {/* ALL-IN */}
        <button style={btnStyle('linear-gradient(135deg,#e53935,#b71c1c)', 'transparent', false)}
          onClick={() => onAction('allin')}>
          <span style={{ fontSize: 13, fontWeight: 900 }}>ALL IN</span>
          <span style={{ fontSize: 11, opacity: 0.8 }}>{(me.chips + me.bet).toLocaleString()}</span>
        </button>

        {/* RAISE toggle */}
        {canRaise && (
          <button
            style={{
              ...btnStyle(showRaise ? '#4527a0' : '#5e35b1', '#311b92', false),
              minWidth: isMobile ? 60 : 72,
            }}
            onClick={() => setShowRaise(v => !v)}
          >
            <span style={{ fontSize: 13 }}>RAISE</span>
            <span style={{ fontSize: 11, opacity: 0.75 }}>{showRaise ? '▲' : '▼'}</span>
          </button>
        )}
      </div>

      {/* ── レイズセクション ── */}
      {showRaise && canRaise && (
        <div style={{
          padding: isMobile ? '8px 12px 12px' : '4px 20px 14px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          {/* プリセット */}
          {presets.length > 0 && (
            <div style={{ display: 'flex', gap: 6 }}>
              {presets.map(p => (
                <button
                  key={p.label}
                  style={{
                    flex: 1,
                    background: 'rgba(94,53,177,0.25)',
                    border: '1px solid rgba(94,53,177,0.5)',
                    borderRadius: 8, color: '#ce93d8',
                    padding: '5px 6px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  }}
                  onClick={() => clampRaise(p.val)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}

          {/* スライダー + 数値 */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input
              type="range"
              min={minRaiseTotal} max={maxRaise}
              step={gameState.bigBlind}
              value={raiseAmt}
              onChange={e => clampRaise(Number(e.target.value))}
              style={{ flex: 1, accentColor: '#7e57c2', height: 20 }}
            />
            <input
              type="number"
              value={raiseAmt}
              min={minRaiseTotal} max={maxRaise}
              onChange={e => clampRaise(Number(e.target.value))}
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 8, color: '#fff',
                padding: '6px 8px', width: 88, fontSize: 13,
              }}
            />
          </div>

          {/* レイズ実行 */}
          <button
            style={{
              background: 'linear-gradient(135deg,#7e57c2,#5e35b1)',
              color: '#fff', border: 'none', borderRadius: 10,
              padding: '11px', fontSize: 15, fontWeight: 800, cursor: 'pointer',
            }}
            onClick={() => { onAction('raise', raiseAmt); setShowRaise(false); }}
          >
            RAISE → ${raiseAmt.toLocaleString()}
          </button>
        </div>
      )}
    </div>
  );
}

function btnStyle(bg: string, _hover: string, large: boolean): React.CSSProperties {
  return {
    background: bg,
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    padding: large ? '14px 20px' : '10px 14px',
    fontSize: large ? 16 : 13,
    fontWeight: 800,
    cursor: 'pointer',
    flex: large ? 2 : 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    minWidth: 60,
    letterSpacing: 0.5,
    boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
  };
}
