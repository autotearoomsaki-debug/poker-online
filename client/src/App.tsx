import { useEffect, useState } from 'react';
import { socket, getPlayerId } from './socket';
import { GameState } from './types';
import Lobby from './components/Lobby';
import PokerTable from './components/PokerTable';

export default function App() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [myId] = useState<string>(getPlayerId);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    socket.on('disconnect', () => {
      setJoined(false);
      setGameState(null);
    });
    socket.on('game-state', (state: GameState) => setGameState(state));
    return () => {
      socket.off('disconnect');
      socket.off('game-state');
    };
  }, []);

  const handleJoin = (roomId: string, playerName: string) => {
    const playerId = getPlayerId();
    socket.connect();
    socket.emit(
      'join-room',
      { roomId, playerName, playerId },
      (ok: boolean, err?: string) => {
        if (ok) { setJoined(true); setError(''); }
        else { setError(err || '参加に失敗しました'); socket.disconnect(); }
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

  if (!joined) return <Lobby onJoin={handleJoin} error={error} />;

  return (
    <PokerTable
      gameState={gameState}
      myId={myId}
      onStartGame={handleStartGame}
      onAction={handleAction}
      onNewHand={handleNewHand}
      error={error}
    />
  );
}
