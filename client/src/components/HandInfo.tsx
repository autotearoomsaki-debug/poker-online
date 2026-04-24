import { DrawInfo } from '../types';

interface Props {
  handDescription?: string;
  draws?: DrawInfo[];
  phase: string;
}

const PHASE_LABELS: Record<string, string> = {
  preflop: 'プリフロップ',
  flop: 'フロップ',
  turn: 'ターン',
  river: 'リバー',
};

const DRAW_COLORS: Record<string, string> = {
  'フラッシュドロー': '#74b9ff',
  'ストレートドロー': '#a29bfe',
  'ガットショット': '#fd79a8',
  'スリーカード': '#00b894',
  'ツーペア': '#fdcb6e',
  'ワンペア': '#b2bec3',
};

const OUTS_HINT: Record<number, string> = {
  9: 'フラッシュ完成率 ターン35% リバー20%',
  8: 'ストレート完成率 ターン32% リバー17%',
  7: '完成率 ターン28% リバー15%',
  4: 'ガットショット完成率 ターン17% リバー9%',
  2: 'トリップス率 ターン8% リバー4%',
};

export default function HandInfo({ handDescription, draws, phase }: Props) {
  if (!handDescription || phase === 'waiting' || phase === 'showdown') return null;

  const filteredDraws = (draws ?? []).slice(0, 3);

  return (
    <div style={styles.container}>
      {/* 現在のハンド */}
      <div style={styles.section}>
        <span style={styles.label}>{PHASE_LABELS[phase] ?? phase}</span>
        <span style={styles.hand}>{handDescription}</span>
      </div>

      {/* ドロー情報 */}
      {filteredDraws.length > 0 && (
        <div style={styles.draws}>
          {filteredDraws.map((d, i) => (
            <div key={i} style={styles.drawItem}>
              <span style={{
                ...styles.drawBadge,
                background: `${DRAW_COLORS[d.label] ?? '#636e72'}22`,
                borderColor: DRAW_COLORS[d.label] ?? '#636e72',
                color: DRAW_COLORS[d.label] ?? '#b2bec3',
              }}>
                {d.label}
              </span>
              <span style={styles.drawDetail}>
                {d.detail}
                {OUTS_HINT[d.outs] && (
                  <span style={styles.hint}> — {OUTS_HINT[d.outs]}</span>
                )}
              </span>
              <span style={styles.outs}>{d.outs}out</span>
            </div>
          ))}
        </div>
      )}

      {/* リバー（ドローなし）のメッセージ */}
      {phase === 'river' && filteredDraws.length === 0 && (
        <div style={{ color: '#636e72', fontSize: 11 }}>
          これ以上カードはありません — 現在の手役が最終結果です
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: 'rgba(0,0,0,0.5)',
    borderTop: '1px solid rgba(255,255,255,0.07)',
    padding: '8px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  section: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    color: '#636e72',
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flexShrink: 0,
  },
  hand: {
    color: '#f0c040',
    fontWeight: 700,
    fontSize: 14,
  },
  draws: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  drawItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  drawBadge: {
    border: '1px solid',
    borderRadius: 4,
    padding: '1px 7px',
    fontSize: 11,
    fontWeight: 700,
    flexShrink: 0,
  },
  drawDetail: {
    color: '#dfe6e9',
    fontSize: 12,
    flex: 1,
  },
  hint: {
    color: '#636e72',
    fontSize: 11,
  },
  outs: {
    color: '#636e72',
    fontSize: 11,
    flexShrink: 0,
  },
};
