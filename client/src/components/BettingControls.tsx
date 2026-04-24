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
  useEffect(() => { setRaiseAmt(Math.max(minRaiseTotal, raiseAmt)); }, [minRaiseTotal]);

  const clampRaise = (v: number) =>
    setRaiseAmt(Math.min(Math.max(Math.round(v), minRaiseTotal), maxRaise));

  const presets = [
    { label: '½ポット', val: Math.round(gameState.pot / 2 + gameState.currentBet) },
    { label: 'ポット', val: gameState.pot + gameState.currentBet },
    { label: '2倍BB', val: gameState.bigBlind * 2 + gameState.currentBet },
  ].filter(p => p.val >= minRaiseTotal && p.val <= maxRaise);

  return (
    <div style={{ ...styles.container, padding: isMobile ? '12px' : '14px 24px' }}>
      {/* 情報行 */}
      <div style={styles.infoRow}>
        <Chip label="現在のBET" value={`$${gameState.currentBet}`} />
        <Chip label="POT" value={`$${gameState.pot.toLocaleString()}`} />
        <Chip label="手持ち" value={`$${me.chips.toLocaleString()}`} />
      </div>

      {/* ボタン行 */}
      <div style={{ ...styles.btnRow, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
        <ActionBtn color="#636e72" label="フォールド" onClick={() => onAction('fold')} grow />
        {canCheck
          ? <ActionBtn color="#00b894" label="チェック" onClick={() => onAction('check')} grow />
          : <ActionBtn color="#0984e3" label={`コール $${callAmount}`} onClick={() => onAction('call')} grow />
        }
        <ActionBtn
          color="linear-gradient(135deg,#d63031,#e17055)"
          label={`オールイン $${me.chips + me.bet}`}
          onClick={() => onAction('allin')}
          grow
        />
      </div>

      {/* レイズセクション */}
      {canRaise && (
        <div style={styles.raiseSection}>
          {presets.length > 0 && (
            <div style={styles.presetRow}>
              {presets.map(p => (
                <button key={p.label} style={styles.presetBtn} onClick={() => clampRaise(p.val)}>
                  {p.label}
                </button>
              ))}
            </div>
          )}
          <div style={styles.sliderRow}>
            <input
              type="range"
              min={minRaiseTotal} max={maxRaise}
              step={gameState.bigBlind}
              value={raiseAmt}
              onChange={e => clampRaise(Number(e.target.value))}
              style={{ flex: 1, accentColor: '#6c5ce7', height: 20 }}
            />
            <input
              type="number"
              value={raiseAmt}
              min={minRaiseTotal} max={maxRaise}
              onChange={e => clampRaise(Number(e.target.value))}
              style={styles.numInput}
            />
          </div>
          <ActionBtn
            color="#6c5ce7"
            label={`レイズ → $${raiseAmt}`}
            onClick={() => onAction('raise', raiseAmt)}
          />
        </div>
      )}
    </div>
  );
}

function ActionBtn({ color, label, onClick, grow }: {
  color: string; label: string; onClick: () => void; grow?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: color, color: '#fff', border: 'none',
        borderRadius: 8, padding: '12px 16px',
        fontSize: 14, fontWeight: 700, cursor: 'pointer',
        flex: grow ? 1 : undefined, minWidth: 80,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ color: '#666', fontSize: 11 }}>{label}</div>
      <div style={{ color: '#f0c040', fontWeight: 700, fontSize: 14 }}>{value}</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: 'rgba(0,0,0,0.65)',
    borderTop: '1px solid rgba(255,255,255,0.08)',
    display: 'flex', flexDirection: 'column', gap: 10,
  },
  infoRow: {
    display: 'flex', justifyContent: 'center', gap: 28,
  },
  btnRow: {
    display: 'flex', gap: 8, justifyContent: 'center',
  },
  raiseSection: {
    display: 'flex', flexDirection: 'column', gap: 6,
    maxWidth: 460, margin: '0 auto', width: '100%',
  },
  presetRow: {
    display: 'flex', gap: 6,
  },
  presetBtn: {
    flex: 1,
    background: 'rgba(108,92,231,0.25)',
    border: '1px solid rgba(108,92,231,0.5)',
    borderRadius: 6, color: '#a29bfe',
    padding: '5px 8px', fontSize: 12, cursor: 'pointer',
  },
  sliderRow: {
    display: 'flex', gap: 8, alignItems: 'center',
  },
  numInput: {
    background: 'rgba(255,255,255,0.1)',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: 6, color: '#fff',
    padding: '6px 8px', width: 88, fontSize: 13,
  },
};
