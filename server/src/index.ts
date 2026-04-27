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
  pingTimeout: 60000,
  pingInterval: 25000,
});

const rooms = new Map<string, PokerGame>();

function broadcastState(roomId: string, communityCardsLimit?: number) {
  const game = rooms.get(roomId);
  if (!game) return;
  const sockets = io.sockets.adapter.rooms.get(roomId);
  if (!sockets) return;
  for (const sid of sockets) {
    const s = io.sockets.sockets.get(sid);
    if (s) s.emit('game-state', game.getState(s.data.playerId as string, communityCardsLimit));
  }
}

// オールイン時に 1.2 秒ごとにフロップ→ターン→リバー→ショーダウンを順に公開する
function scheduleRunout(roomId: string) {
  const game = rooms.get(roomId);
  if (!game?.isPendingRunout()) return;
  setTimeout(() => {
    const g = rooms.get(roomId);
    if (!g?.isPendingRunout()) return;
    const result = g.advanceRunout();
    broadcastState(roomId);
    if (result === 'continue') scheduleRunout(roomId);
  }, 1200);
}

io.on('connection', (socket) => {
  console.log(`接続: ${socket.id}`);

  // join-room: playerId はクライアントが localStorage で永続管理する固有ID
  socket.on('join-room', (
    { roomId, playerName, playerId }: { roomId: string; playerName: string; playerId: string },
    callback: (ok: boolean, err?: string) => void,
  ) => {
    if (!roomId || !playerName || !playerId) return callback(false, '必須情報が不足しています');

    let game = rooms.get(roomId);
    if (!game) {
      game = new PokerGame(roomId);
      rooms.set(roomId, game);
      console.log(`ルーム作成: ${roomId}`);
    }

    // 再接続チェック（同じ playerId がルームに存在する）
    if (game.hasPlayer(playerId)) {
      game.reconnectPlayer(playerId);
      socket.data.playerId = playerId;
      socket.data.roomId = roomId;
      socket.join(roomId);
      console.log(`再接続: ${playerName} (${playerId}) → ルーム ${roomId}`);
      callback(true);
      broadcastState(roomId);
      return;
    }

    const ok = game.addPlayer(playerId, playerName);
    if (!ok) return callback(false, 'ルームに参加できません（満員またはゲーム中）');

    socket.data.playerId = playerId;
    socket.data.playerName = playerName;
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
    if (!game.isHost(socket.data.playerId)) return callback(false, 'ホストのみ開始できます');
    if (!game.canStart()) return callback(false, 'プレイヤーが2人以上必要です');

    const ok = game.startHand();
    if (!ok) return callback(false, 'ゲームを開始できません');
    callback(true);
    broadcastState(roomId);
  });

  socket.on('action', (
    { type, amount }: { type: 'fold' | 'call' | 'check' | 'raise' | 'allin'; amount?: number },
    callback: (ok: boolean, err?: string) => void,
  ) => {
    const { roomId } = socket.data;
    const game = rooms.get(roomId);
    if (!game) return callback(false, 'ルームが見つかりません');

    const phaseBefore = game.getPhase();
    const cardsBefore = game.getCommunityCardCount();
    const result = game.handleAction(socket.data.playerId, type, amount);
    if (!result.success) return callback(false, result.error);
    callback(true);
    const phaseAfter = game.getPhase();
    if (phaseBefore !== phaseAfter) {
      // アクション結果を即座に表示（新カードはまだ隠す）
      broadcastState(roomId, cardsBefore);
      // 3秒後に新カードを公開
      setTimeout(() => {
        broadcastState(roomId);
        scheduleRunout(roomId);
      }, 3000);
    } else {
      broadcastState(roomId);
      scheduleRunout(roomId);
    }
  });

  // 誰でも次のハンドを開始できる（ホスト制限撤廃）
  socket.on('new-hand', (callback: (ok: boolean, err?: string) => void) => {
    const { roomId } = socket.data;
    const game = rooms.get(roomId);
    if (!game) return callback(false, 'ルームが見つかりません');
    if (game.getPhase() !== 'showdown') return callback(false, 'ショーダウン後のみ有効です');

    game.resetForNewHand();

    // ゲームオーバー（チップのあるプレイヤーが1人以下）
    if (game.isGameOver()) {
      callback(true);
      broadcastState(roomId);
      return;
    }

    const ok = game.startHand();
    if (!ok) return callback(false, 'ゲームを続けられません（チップのある参加者が2人以上必要）');
    callback(true);
    broadcastState(roomId);
  });

  // ゲームをリセットして最初から（全員チップ1000でロビーへ）
  socket.on('reset-game', (callback: (ok: boolean, err?: string) => void) => {
    const { roomId } = socket.data;
    if (!rooms.has(roomId)) return callback(false, 'ルームが見つかりません');

    const newGame = new PokerGame(roomId);
    rooms.set(roomId, newGame);

    // 接続中の全ソケットを新ゲームに再登録
    const sockets = io.sockets.adapter.rooms.get(roomId);
    if (sockets) {
      for (const sid of sockets) {
        const s = io.sockets.sockets.get(sid);
        if (s?.data?.playerId && s?.data?.playerName) {
          newGame.addPlayer(s.data.playerId as string, s.data.playerName as string);
        }
      }
    }

    callback(true);
    broadcastState(roomId);
  });

  socket.on('disconnect', () => {
    const { roomId, playerId } = socket.data;
    if (!roomId) return;
    const game = rooms.get(roomId);
    if (!game) return;

    console.log(`切断: ${playerId} (ルーム: ${roomId})`);

    game.markDisconnected(playerId, () => {
      // 自動フォールド後にブロードキャスト
      broadcastState(roomId);
    });

    if (game.getConnectedCount() === 0) {
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
