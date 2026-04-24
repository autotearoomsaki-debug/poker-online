import { io } from 'socket.io-client';

// 同じネットワーク内の友達が接続できるよう、現在のホストのポート3001を使用
const SERVER_URL = import.meta.env.VITE_SERVER_URL ||
  `http://${window.location.hostname}:3001`;

export const socket = io(SERVER_URL, { autoConnect: false });
