import { io } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL ||
  `http://${window.location.hostname}:3001`;

export const socket = io(SERVER_URL, { autoConnect: false });

/** localStorage に保存した永続プレイヤーID（再接続に使用） */
export const getPlayerId = (): string => {
  let id = localStorage.getItem('poker-pid');
  if (!id) {
    id = Math.random().toString(36).slice(2, 14);
    localStorage.setItem('poker-pid', id);
  }
  return id;
};
