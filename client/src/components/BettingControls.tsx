import { useState, useEffect, useRef } from 'react';
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
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) { initialized.current = true; setRaiseAmt(minRaiseTotal); return; }
    setRaiseAmt(v => Math.max(minRaiseTotal, Math.min(v, maxRaise)));
    setShowRaise(false);
  }, [minRaiseTotal, maxRaise]);

  const clamp = (v: number) => Math.min(Math.max(Math.round(v), minRaiseTotal), maxRaise);

  // プリセット定義（有効なものだけ）
  const presets = [
    { label: '½P',  val: Math.round(gameState.pot * 0.5 + gameState.currentBet) },
    { label: 'P',   val: gameState.pot + gameState.currentBet },
    { label: '2BB', val: gameState.bigBlind * 2 + gameState.currentBet },
    { label: '3BB', val: gameState.bigBlind * 3 + gameState.currentBet },
    { label: '5BB', val: gameState.bigBlind * 5 + gameState.currentBet },
  ].filter((p, i, arr) => {
    const v = p.val;
    return v >= minRaiseTotal && v <= maxRaise - 1 && arr.findIndex(q => q.val === v) === i;
  }).slice(0, 4);

  const activePresetIdx = presets.findIndex(p => p.val === raiseAmt);

  return (
    <div style={{ background: 'rgba(0,0,0,0.75)', borderTop: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>

      {/* ── メインボタン行 ── */}
      <div style={{
        display: 'flex', gap: 6,
        padding: isMobile ? '8px 10px' : '10px 16px',
      }}>
        <Btn bg="linear-gradient(180deg,#546e7a,#37474f)" label="FOLD" onClick={() => onAction('fold')} />

        {canCheck
          ? <Btn bg="linear-gradient(180deg,#00897b,#00695c)" label="CHECK" onClick={() => onAction('check')} large />
          : (
            <Btn
              bg="linear-gradient(180deg,#1976d2,#0d47a1)"
              onClick={() => onAction('call')}
              large
            >
              <span style={{ fontSize: isMobile ? 15 : 17, fontWeight: 900, letterSpacing: 0.5 }}>CALL</span>
              <span style={{ fontSize: 12, opacity: 0.85 }}>+{callAmount.toLocaleString()}</span>
            </Btn>
          )
        }

        <Btn bg="linear-gradient(180deg,#c62828,#b71c1c)" onClick={() => onAction('allin')}>
          <span style={{ fontSize: 12, fontWeight: 900, letterSpacing: 0.5 }}>ALL IN</span>
          <span style={{ fontSize: 10, opacity: 0.8 }}>{(me.chips + me.bet).toLocaleString()}</span>
        </Btn>

        {canRaise && (
          <Btn
            bg={showRaise
              ? 'linear-gradient(180deg,#6a1b9a,#4a148c)'
              : 'linear-gradient(180deg,#7b1fa2,#6a1b9a)'}
            onClick={() => setShowRaise(v => !v)}
          >
            <span style={{ fontSize: 12, fontWeight: 900 }}>RAISE</span>
            <span style={{ fontSize: 11, opacity: 0.75 }}>{showRaise ? '▲' : '▼'}</span>
          </Btn>
        )}
      </div>

      {/* ── レイズセクション（展開） ── */}
      {showRaise && canRaise && (
        <div style={{
          padding: isMobile ? '0 10px 10px' : '0 16px 12px',
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          {/* プリセットボタン */}
          {presets.length > 0 && (
            <div style={{ display: 'flex', gap: 5 }}>
              {presets.map((p, i) => (
                <button
                  key={p.label}
                  onClick={() => setRaiseAmt(clamp(p.val))}
                  style={{
                    flex: 1,
                    background: activePresetIdx === i
                      ? 'rgba(171,71,188,0.6)'
                      : 'rgba(171,71,188,0.15)',
                    border: `1px solid ${activePresetIdx === i ? '#ab47bc' : 'rgba(171,71,188,0.4)'}`,
                    borderRadius: 8, color: activePresetIdx === i ? '#fff' : '#ce93d8',
                    padding: isMobile ? '6px 4px' : '7px 6px',
                    fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    transition: 'all 0.15s',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
                  }}
                >
                  <span>{p.label}</span>
                  <span style={{ fontSize: 10, opacity: 0.75 }}>{p.val.toLocaleString()}</span>
                </button>
              ))}
            </div>
          )}

          {/* スライダー + 数値入力 */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ flex: 1, position: 'relative', padding: '4px 0' }}>
              {/* プリセット位置のマーカー */}
              {presets.map(p => {
                const pct = ((p.val - minRaiseTotal) / (maxRaise - minRaiseTotal)) * 100;
                return (
                  <div key={p.label} style={{
                    position: 'absolute', left: `${pct}%`,
                    top: '50%', transform: 'translate(-50%,-50%)',
                    width: 3, height: 10,
                    background: 'rgba(171,71,188,0.6)',
                    borderRadius: 2, pointerEvents: 'none', zIndex: 1,
                  }} />
                );
              })}
              <input
                type="range"
                min={minRaiseTotal} max={maxRaise}
                step={gameState.bigBlind}
                value={raiseAmt}
                onChange={e => setRaiseAmt(clamp(Number(e.target.value)))}
                style={{ width: '100%', accentColor: '#ab47bc', height: 18, position: 'relative', zIndex: 2 }}
              />
            </div>
            <div style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 8, color: '#fff',
              padding: '5px 8px', fontSize: 13, fontWeight: 700,
              minWidth: 80, textAlign: 'center',
            }}>
              ${raiseAmt.toLocaleString()}
            </div>
          </div>

          {/* RAISE 実行ボタン */}
          <button
            style={{
              background: 'linear-gradient(135deg,#ab47bc,#7b1fa2)',
              color: '#fff', border: 'none', borderRadius: 10,
              padding: '11px', fontSize: 15, fontWeight: 900, cursor: 'pointer',
              letterSpacing: 0.5,
              boxShadow: '0 2px 12px rgba(171,71,188,0.4)',
            }}
            onClick={() => { onAction('raise', raiseAmt); setShowRaise(false); }}
          >
            RAISE ${raiseAmt.toLocaleString()}
          </button>
        </div>
      )}
    </div>
  );
}

// ── ボタンコンポーネント ──────────────────────────────

function Btn({ bg, label, onClick, large, children }: {
  bg: string; label?: string; onClick: () => void;
  large?: boolean; children?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: bg, color: '#fff', border: 'none',
        borderRadius: 12,
        padding: large ? '12px 14px' : '10px 10px',
        fontSize: label ? 14 : undefined,
        fontWeight: label ? 800 : undefined,
        cursor: 'pointer',
        flex: large ? 2 : 1,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 2, minWidth: 54,
        letterSpacing: label ? 0.5 : undefined,
        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
        transition: 'filter 0.1s',
      }}
    >
      {label ?? children}
    </button>
  );
}
