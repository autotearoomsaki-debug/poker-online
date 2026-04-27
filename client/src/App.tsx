import { useEffect, useRef, useState } from 'react';
import { socket, getPlayerId } from './socket';
import { GameState } from './types';
import Lobby from './components/Lobby';
import PokerTable from './components/PokerTable';

export default function App() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [myId] = useState<string>(getPlayerId);
  const [joined, setJoined] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [error, setError] = useState('');

  // 再接続のためにルーム情報を保持
  const savedRoom = useRef<{ roomId: string; playerName: string } | null>(null);

  useEffect(() => {
    const playerId = getPlayerId();

    // 再接続時に自動でルームに再参加
    const handleConnect = () => {
      if (savedRoom.current) {
        const { roomId, playerName } = savedRoom.current;
        socket.emit(
          'join-room',
          { roomId, playerName, playerId },
          (ok: boolean) => {
            if (ok) {
              setReconnecting(false);
              setJoined(true);
            } else {
              // 再参加失敗 → ロビーへ
              savedRoom.current = null;
              setReconnecting(false);
              setJoined(false);
              setGameState(null);
            }
          },
        );
      }
    };

    const handleDisconnect = () => {
      if (savedRoom.current) {
        // ルーム情報があれば再接続待機画面を表示
        setReconnecting(true);
      } else {
        setJoined(false);
        setGameState(null);
      }
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('game-state', (state: GameState) => {
      setGameState(state);
      setReconnecting(false);
    });

    // タブが前面に戻ったとき、切断していれば再接続
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !socket.connected && savedRoom.current) {
        setReconnecting(true);
        socket.connect();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('game-state');
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const handleJoin = (roomId: string, playerName: string) => {
    const playerId = getPlayerId();
    savedRoom.current = { roomId, playerName };
    socket.connect();
    socket.emit(
      'join-room',
      { roomId, playerName, playerId },
      (ok: boolean, err?: string) => {
        if (ok) { setJoined(true); setError(''); }
        else {
          savedRoom.current = null;
          setError(err || '参加に失敗しました');
          socket.disconnect();
        }
      },
    );
  };

  const handleStartGame = () => {
    socket.emit('start-game', (ok: boolean, err?: string) => {
      if (!ok) setError(err || '開始に失敗しました');
    });
  };

  const handleAction = (
    type: 'fold' | 'call' | 'check' | 'raise' | 'allin',
    amount?: number,
  ) => {
    socket.emit('action', { type, amount }, (ok: boolean, err?: string) => {
      if (!ok) setError(err || 'アクションに失敗しました');
      else setError('');
    });
  };

  const handleNewHand = () => {
    socket.emit('new-hand', (ok: boolean, err?: string) => {
      if (!ok) setError(err || '次のハンドの開始に失敗しました');
      else setError('');
    });
  };

  const handleResetGame = () => {
    socket.emit('reset-game', (ok: boolean, err?: string) => {
      if (!ok) setError(err || 'リセットに失敗しました');
      else setError('');
    });
  };

  // 再接続中オーバーレイ
  if (reconnecting) {
    return (
      <div style={{
        position: 'fixed', inset: 0,
        background: 'rgba(6,14,6,0.92)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 16, color: '#eee',
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          border: '4px solid rgba(255,255,255,0.1)',
          borderTop: '4px solid #74b9ff',
          animation: 'spin 0.9s linear infinite',
        }} />
        <div style={{ fontSize: 16, fontWeight: 600 }}>再接続中...</div>
      </div>
    );
  }

  if (!joined) return <Lobby onJoin={handleJoin} error={error} />;

  return (
    <PokerTable
      gameState={gameState}
      myId={myId}
      onStartGame={handleStartGame}
      onAction={handleAction}
      onNewHand={handleNewHand}
      onResetGame={handleResetGame}
      error={error}
    />
  );
}
