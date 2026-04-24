import { useState } from 'react';

interface Props {
  onJoin: (roomId: string, playerName: string) => void;
  error: string;
}

export default function Lobby({ onJoin, error }: Props) {
  const [roomId, setRoomId] = useState('');
  const [playerName, setPlayerName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomId.trim() || !playerName.trim()) return;
    onJoin(roomId.trim(), playerName.trim());
  };

  const createRoom = () => {
    const id = String(Math.floor(1000 + Math.random() * 9000));
    setRoomId(id);
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>♠ Poker Online ♠</h1>
        <p style={styles.subtitle}>友達とテキサスホールデムを楽しもう</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>プレイヤー名</label>
            <input
              style={styles.input}
              type="text"
              value={playerName}
              onChange={e => setPlayerName(e.target.value)}
              placeholder="名前を入力"
              maxLength={16}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>ルームID</label>
            <div style={styles.row}>
              <input
                style={{ ...styles.input, flex: 1 }}
                type="text"
                value={roomId}
                onChange={e => setRoomId(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="1234"
                maxLength={4}
                inputMode="numeric"
              />
              <button type="button" onClick={createRoom} style={styles.createBtn}>
                新規作成
              </button>
            </div>
          </div>

          {error && <p style={styles.error}>{error}</p>}

          <button type="submit" style={styles.joinBtn}>
            参加する
          </button>
        </form>

        <p style={styles.hint}>
          新しいルームを作成するか、友達のルームIDを入力して参加してください
        </p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
  },
  card: {
    background: 'rgba(255,255,255,0.05)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: '48px 40px',
    width: '100%',
    maxWidth: 440,
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
  },
  title: {
    textAlign: 'center',
    fontSize: 32,
    fontWeight: 700,
    color: '#f0c040',
    marginBottom: 8,
    letterSpacing: 2,
  },
  subtitle: {
    textAlign: 'center',
    color: '#aaa',
    marginBottom: 32,
    fontSize: 14,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  label: {
    fontSize: 13,
    color: '#ccc',
    fontWeight: 600,
  },
  input: {
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: 8,
    padding: '12px 16px',
    color: '#fff',
    fontSize: 16,
    outline: 'none',
  },
  row: {
    display: 'flex',
    gap: 8,
  },
  createBtn: {
    background: '#4a6fa5',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '12px 16px',
    cursor: 'pointer',
    fontSize: 14,
    whiteSpace: 'nowrap',
  },
  joinBtn: {
    background: 'linear-gradient(135deg, #f0c040, #e8a020)',
    color: '#1a1a2e',
    border: 'none',
    borderRadius: 8,
    padding: '14px',
    cursor: 'pointer',
    fontSize: 16,
    fontWeight: 700,
    marginTop: 8,
  },
  error: {
    color: '#ff6b6b',
    fontSize: 13,
    textAlign: 'center',
  },
  hint: {
    marginTop: 24,
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 1.6,
  },
};
