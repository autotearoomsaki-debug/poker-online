import { useEffect, useState } from 'react';

interface Props {
  action: string;
}

interface ToastData {
  id: number;
  text: string;
  type: ActionType;
  amount?: string;
}

type ActionType = 'fold' | 'check' | 'call' | 'raise' | 'allin' | 'blind' | 'other';

const ACTION_CONFIG: Record<ActionType, { bg: string; accent: string; icon: string; label: string }> = {
  fold:  { bg: '#37474f',  accent: '#90a4ae', icon: '✖', label: 'FOLD' },
  check: { bg: '#00695c',  accent: '#80cbc4', icon: '✓', label: 'CHECK' },
  call:  { bg: '#1565c0',  accent: '#90caf9', icon: '→', label: 'CALL' },
  raise: { bg: '#6a1b9a',  accent: '#ce93d8', icon: '↑', label: 'RAISE' },
  allin: { bg: '#b71c1c',  accent: '#ef9a9a', icon: '★', label: 'ALL IN' },
  blind: { bg: '#e65100',  accent: '#ffcc02', icon: '◎', label: 'BLIND' },
  other: { bg: '#263238',  accent: '#90a4ae', icon: '·', label: '' },
};

function detectType(action: string): { type: ActionType; amount?: string } {
  if (action.includes('フォールド') || action.includes('切断')) return { type: 'fold' };
  if (action.includes('チェック')) return { type: 'check' };
  if (action.includes('オールイン')) {
    const m = action.match(/\$([0-9,]+)/);
    return { type: 'allin', amount: m ? m[1] : undefined };
  }
  if (action.includes('レイズ')) {
    const m = action.match(/\$([0-9,]+)$/);
    return { type: 'raise', amount: m ? m[1] : undefined };
  }
  if (action.includes('コール')) {
    const m = action.match(/\$([0-9,]+)/);
    return { type: 'call', amount: m ? m[1] : undefined };
  }
  if (action.includes('ブラインド')) return { type: 'blind' };
  return { type: 'other' };
}

function extractName(action: string): string {
  const m = action.match(/^(.+?)\s+(が|:)/);
  return m ? m[1] : action;
}

let toastIdCounter = 0;

export default function ActionToast({ action }: Props) {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  useEffect(() => {
    if (!action) return;
    const { type, amount } = detectType(action);
    if (type === 'blind') return; // ブラインド投稿は静かに無視
    const name = extractName(action);
    const id = ++toastIdCounter;

    setToasts(prev => [...prev.slice(-2), { id, text: name, type, amount }]);
    const t = setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 2600);
    return () => clearTimeout(t);
  }, [action]);

  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 120px)',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 120,
      display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center',
      pointerEvents: 'none',
    }}>
      {toasts.map(toast => {
        const cfg = ACTION_CONFIG[toast.type];
        return (
          <div
            key={toast.id}
            style={{
              background: cfg.bg,
              border: `1.5px solid ${cfg.accent}44`,
              borderRadius: 14,
              padding: '8px 20px',
              display: 'flex', alignItems: 'center', gap: 10,
              boxShadow: `0 4px 24px rgba(0,0,0,0.5), 0 0 0 1px ${cfg.accent}22`,
              animation: 'toastSlide 2.6s ease-out both',
              whiteSpace: 'nowrap',
            }}
          >
            {/* Action icon + label */}
            <div style={{
              background: cfg.accent + '28',
              border: `1px solid ${cfg.accent}55`,
              borderRadius: 8,
              padding: '4px 10px',
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <span style={{ fontSize: 14, color: cfg.accent }}>{cfg.icon}</span>
              <span style={{ fontSize: 13, fontWeight: 900, color: cfg.accent, letterSpacing: 1 }}>
                {cfg.label}
              </span>
              {toast.amount && (
                <span style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>
                  ${toast.amount}
                </span>
              )}
            </div>
            {/* Player name */}
            <span style={{ fontSize: 14, fontWeight: 700, color: '#eee' }}>
              {toast.text}
            </span>
          </div>
        );
      })}
    </div>
  );
}
