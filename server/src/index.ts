import cors from 'cors';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { PokerGame } from './game/PokerGame';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (_req, res) => res.send('Poker server running'));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

const rooms = new Map<string, PokerGame>();

function broadcastState(roomId: string) {
  const game = rooms.get(roomId);
  if (!game) return;
  const sockets = io.sockets.adapter.rooms.get(roomId);
  if (!sockets) return;
  for (const socketId of sockets) {
    const socket = io.sockets.sockets.get(socketId);
    if (socket) {
      const playerId = socket.data.playerId as string;
      socket.emit('game-state', game.getState(playerId));
    }
  }
}

io.on('connection', (socket) => {
  console.log(`接続: ${socket.id}`);

  socket.on('join-room', (
    { roomId, playerName }: { roomId: string; playerName: string },
    callback: (ok: boolean, err?: string) => void
  ) => {
    if (!roomId || !playerName) return callback(false, '必須情報が不足しています');

    let game = rooms.get(roomId);
    if (!game) {
      game = new PokerGame(roomId);
      rooms.set(roomId, game);
      console.log(`ルーム作成: ${roomId}`);
    }

    const ok = game.addPlayer(socket.id, playerName);
    if (!ok) return callback(false, 'ルームに参加できません（満員またはゲーム中）');

    socket.data.playerId = socket.id;
    socket.data.roomId = roomId;
    socket.join(roomId);

    console.log(`${playerName} がルーム ${roomId} に参加`);
    callback(true);
    broadcastState(roomId);
  });

  socket.on('start-game', (callback: (ok: boolean, err?: string) => void) => {
    const { roomId } = socket.data;
    const game = rooms.get(roomId);
    if (!game) return callback(false, 'ルームが見つかりません');
    if (!game.isHost(socket.id)) return callback(false, 'ホストのみ開始できます');

    const ok = game.startHand();
    if (!ok) return callback(false, 'ゲームを開始できません（プレイヤーが2人以上必要）');

    callback(true);
    broadcastState(roomId);
  });

  socket.on('action', (
    { type, amount }: { type: 'fold' | 'call' | 'check' | 'raise' | 'allin'; amount?: number },
    callback: (ok: boolean, err?: string) => void
  ) => {
    const { roomId } = socket.data;
    const game = rooms.get(roomId);
    if (!game) return callback(false, 'ルームが見つかりません');

    const result = game.handleAction(socket.id, type, amount);
    if (!result.success) return callback(false, result.error);

    callback(true);
    broadcastState(roomId);
  });

  socket.on('new-hand', (callback: (ok: boolean, err?: string) => void) => {
    const { roomId } = socket.data;
    const game = rooms.get(roomId);
    if (!game) return callback(false, 'ルームが見つかりません');
    if (!game.isHost(socket.id)) return callback(false, 'ホストのみ次のハンドを開始できます');
    if (game.getPhase() !== 'showdown') return callback(false, 'ショーダウン後のみ有効です');

    game.resetForNewHand();
    const ok = game.startHand();
    if (!ok) return callback(false, 'ゲームを続けられません');

    callback(true);
    broadcastState(roomId);
  });

  socket.on('disconnect', () => {
    const { roomId } = socket.data;
    if (!roomId) return;
    const game = rooms.get(roomId);
    if (!game) return;

    game.removePlayer(socket.id);
    console.log(`切断: ${socket.id} (ルーム: ${roomId})`);

    if (game.getPlayerCount() === 0) {
      rooms.delete(roomId);
      console.log(`ルーム削除: ${roomId}`);
    } else {
      broadcastState(roomId);
    }
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`サーバー起動: http://0.0.0.0:${PORT}`);
});
