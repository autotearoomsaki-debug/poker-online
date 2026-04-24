#!/bin/bash
set -e

# スクリプトがどこから実行されても正しく動くよう絶対パスで管理
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== Poker Online ==="
echo ""

# Get local IP
LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "localhost")

# Start server
echo "サーバー起動中 (ポート 3001)..."
(cd "$ROOT_DIR/server" && npm run dev) &
SERVER_PID=$!

sleep 2

# Start client
echo "クライアント起動中 (ポート 5173)..."
(cd "$ROOT_DIR/client" && npm run dev) &
CLIENT_PID=$!

sleep 2

echo ""
echo "============================="
echo "起動完了！"
echo ""
echo "  自分:     http://localhost:5173"
echo "  友達:     http://${LOCAL_IP}:5173"
echo ""
echo "友達には上記のURLを共有してください"
echo "CtrlキーとCで終了"
echo "============================="

# Wait for both processes
wait $SERVER_PID $CLIENT_PID
