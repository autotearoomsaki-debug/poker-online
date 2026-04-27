import { useEffect, useRef, useState } from 'react';
import { GameState } from '../types';
import Card from './Card';
import PlayerSeat from './PlayerSeat';
import BettingControls from './BettingControls';
import { GameOverCelebration } from './Celebration';

interface Props {
  gameState: GameState | null;
  myId: string;
  onStartGame: () => void;
  onAction: (type: 'fold' | 'call' | 'check' | 'raise' | 'allin', amount?: number) => void;
  onNewHand: () => void;
  onResetGame: () => void;
  error: string;
}

const PHASE_LABEL: Record<string, string> = {
  waiting: '待機中', preflop: 'プリフロップ', flop: 'フロップ',
  turn: 'ターン', river: 'リバー', showdown: 'ショーダウン',
};

// テーブルカラーパレット [中心, 中間, 外縁, モバイル枠色]
const TABLE_PALETTES = [
  ['#2e7d32', '#1b5e20', '#0d3b10', 'rgba(100,200,80,0.18)'],   // 緑（デフォルト）
  ['#1565c0', '#0d47a1', '#072a6b', 'rgba(80,160,255,0.18)'],   // ブルー
  ['#6a1b9a', '#4a148c', '#2a0a52', 'rgba(180,80,255,0.18)'],   // パープル
  ['#b71c1c', '#7f0000', '#4a0000', 'rgba(255,80,80,0.18)'],    // レッド
  ['#00695c', '#004d40', '#00251a', 'rgba(80,220,190,0.18)'],   // ティール
  ['#e65100', '#bf360c', '#7a1a00', 'rgba(255,160,80,0.18)'],   // オレンジ
  ['#263238', '#1c2a30', '#0d1519', 'rgba(150,200,220,0.18)'],  // ダークブルーグレー
  ['#37474f', '#1c2f38', '#0a1520', 'rgba(100,180,220,0.18)'],  // スレート
];

function getSeatStyle(idx: number, myIdx: number, total: number): React.CSSProperties {
  const offset = ((idx - myIdx + total) % total) / total;
  const angle = Math.PI / 2 + offset * 2 * Math.PI;
  return {
    position: 'absolute',
    left: `${50 + 44 * Math.cos(angle)}%`,
    top: `${50 + 39 * Math.sin(angle)}%`,
    transform: 'translate(-50%, -50%)',
    zIndex: 2,
  };
}

export default function PokerTable({ gameState, myId, onStartGame, onAction, onNewHand, onResetGame, error }: Props) {
  const [windowW, setWindowW] = useState(window.innerWidth);
  const [judging, setJudging] = useState(false);
  const [allInFlash, setAllInFlash] = useState(false);
  // プレイヤーごとのアクション表示 {playerId → actionText}
  const [playerActions, setPlayerActions] = useState<Record<string, string>>({});
  // フロップ公開完了まで手役表示を遅らせる
  const [displayedHandDesc, setDisplayedHandDesc] = useState(gameState?.myHandDescription);
  const [displayedDraws, setDisplayedDraws] = useState(gameState?.myDraws);
  // 画面に実際に表示されているカード枚数（アニメーション進行に合わせる）
  const [visibleCardCount, setVisibleCardCount] = useState(gameState?.communityCards.length ?? 0);
  const prevCommunityLen = useRef(gameState?.communityCards.length ?? 0);
  // ラウンドごとにテーブルカラーを変更
  const [tablePaletteIdx, setTablePaletteIdx] = useState(0);
  const prevDealerIdx = useRef(gameState?.dealerIndex ?? -1);

  useEffect(() => {
    const h = () => setWindowW(window.innerWidth);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  // ショーダウン 1 秒待機
  useEffect(() => {
    if (gameState?.phase === 'showdown') {
      setJudging(true);
      const t = setTimeout(() => setJudging(false), 1000);
      return () => clearTimeout(t);
    } else {
      setJudging(false);
    }
  }, [gameState?.phase, gameState?.winners]);

  // ALL-IN フラッシュ
  useEffect(() => {
    if (gameState?.lastAction?.includes('オールイン')) {
      setAllInFlash(true);
      const t = setTimeout(() => setAllInFlash(false), 1800);
      return () => clearTimeout(t);
    }
  }, [gameState?.lastAction]);

  // 誰がアクションしたか追跡（座席バッジ用）
  useEffect(() => {
    const action = gameState?.lastAction;
    if (!action || !gameState) return;
    const nameMatch = action.match(/^(.+?)\s+(が|→)/);
    if (!nameMatch) return;
    const name = nameMatch[1];
    const player = gameState.players.find(p => p.name === name);
    if (!player) return;
    const id = player.id;
    // アクションのコア部分（名前を除く）
    const core = action.replace(/^.+?が/, '');
    setPlayerActions(prev => ({ ...prev, [id]: core }));
    const t = setTimeout(() => setPlayerActions(prev => {
      const n = { ...prev }; delete n[id]; return n;
    }), 5000);
    return () => clearTimeout(t);
  }, [gameState?.lastAction]);

  // ディーラーが変わったら（＝新ハンド）テーブルカラーをランダムに変更
  useEffect(() => {
    const d = gameState?.dealerIndex ?? -1;
    if (d !== prevDealerIdx.current && gameState?.phase === 'preflop') {
      setTablePaletteIdx(Math.floor(Math.random() * TABLE_PALETTES.length));
    }
    prevDealerIdx.current = d;
  }, [gameState?.dealerIndex, gameState?.phase]);

  // コミュニティカードが更新されたら即時反映（手役・勝率も同時更新）
  useEffect(() => {
    const currLen = gameState?.communityCards.length ?? 0;
    prevCommunityLen.current = currLen;
    setVisibleCardCount(currLen);
    setDisplayedHandDesc(gameState?.myHandDescription);
    setDisplayedDraws(gameState?.myDraws);
  }, [gameState?.communityCards.length, gameState?.myHandDescription]);

  const [copied, setCopied] = useState(false);
  const copyRoomId = () => {
    if (!gameState) return;
    navigator.clipboard.writeText(gameState.roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isMobile = windowW < 700;

  if (!gameState) {
    return (
      <div style={styles.loading}>
        <div style={styles.spinner} />
        <p style={{ color: '#aaa', marginTop: 16 }}>接続中...</p>
      </div>
    );
  }

  const myIdx = gameState.players.findIndex(p => p.id === myId);
  const me = myIdx >= 0 ? gameState.players[myIdx] : null;
  const isMyTurn =
    gameState.phase !== 'waiting' && gameState.phase !== 'showdown' &&
    gameState.players[gameState.currentPlayerIndex]?.id === myId &&
    me?.status === 'active';
  const isHost = gameState.players[0]?.id === myId;

  const handleNext = () => onNewHand();
  const handleReset = () => onResetGame();

  return (
    <div style={styles.wrapper}>
      {/* ── ALL-IN フラッシュ ── */}
      {allInFlash && (
        <div style={styles.allInOverlay}>
          <div style={styles.allInText}>ALL IN!</div>
          {/* チップ雨 */}
          {Array.from({ length: 18 }, (_, i) => (
            <div key={i} style={{
              position: 'absolute',
              left: `${5 + i * 5.2}%`,
              top: `${20 + (i % 5) * 8}%`,
              fontSize: 20 + (i % 4) * 6,
              animation: `chipRain ${0.8 + (i % 4) * 0.3}s ${(i % 6) * 0.15}s ease-in both`,
              pointerEvents: 'none',
            }}>
              {['🪙', '💰', '🎰', '💎'][i % 4]}
            </div>
          ))}
        </div>
      )}

      {/* ── ゲームオーバー演出 ── */}
      {!judging && gameState.gameOver && (
        <GameOverCelebration winnerName={gameState.gameOver.winnerName} isMe={gameState.gameOver.winnerId === myId} onReset={handleReset} />
      )}


      {/* ── ヘッダー ── */}
      <div style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: '#888', fontSize: 10 }}>ROOM</span>
          <strong style={styles.roomId}>{gameState.roomId}</strong>
          <button onClick={copyRoomId} style={styles.copyBtn}>{copied ? '✓' : 'コピー'}</button>
        </div>
        <div style={styles.phaseBadge}>{PHASE_LABEL[gameState.phase]}</div>
        {!isMobile && <div style={{ fontSize: 12, color: '#888' }}>{gameState.players.length}人参加中</div>}
      </div>

      {error && <div style={styles.errorBar}>{error}</div>}

      {/* ── テーブル ── */}
      <div style={styles.tableSection}>
        {isMobile
          ? <MobileLayout gameState={gameState} myId={myId} myIdx={myIdx} onStartGame={onStartGame} isHost={isHost} playerActions={playerActions} onNewHand={handleNext} judging={judging} palette={TABLE_PALETTES[tablePaletteIdx]} visibleCardCount={visibleCardCount} />
          : <OvalLayout gameState={gameState} myId={myId} myIdx={myIdx} onStartGame={onStartGame} isHost={isHost} playerActions={playerActions} onNewHand={handleNext} judging={judging} palette={TABLE_PALETTES[tablePaletteIdx]} visibleCardCount={visibleCardCount} />
        }
      </div>

      {/* ── 自分のホールカード ── */}
      {me && me.cards.length > 0 && gameState.phase !== 'waiting' && (
        <div style={{
          ...styles.myHoleCards,
          padding: isMobile ? '4px 12px' : '8px 16px',
        }}>
          <div style={{ display: 'flex', gap: isMobile ? 6 : 10, alignItems: 'center' }}>
            {me.cards.map((c, i) => (
              <Card key={i} card={c} small={isMobile} animationDelay={i * 150} />
            ))}
          </div>
          {me.status !== 'folded' && gameState.phase !== 'showdown' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {/* 手役名 */}
              {displayedHandDesc && (
                <span style={{
                  color: '#f0c040', fontWeight: 800,
                  fontSize: isMobile ? 11 : 13,
                }}>
                  {displayedHandDesc}
                </span>
              )}
              {/* ドロー小タグ */}
              {displayedDraws && displayedDraws.length > 0 && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {displayedDraws.slice(0, 2).map((d, i) => (
                    <span key={i} style={{
                      fontSize: isMobile ? 9 : 10,
                      padding: '1px 5px', borderRadius: 4,
                      border: '1px solid rgba(255,255,255,0.2)',
                      color: '#90a4ae', fontWeight: 600,
                      background: 'rgba(255,255,255,0.05)',
                      whiteSpace: 'nowrap',
                    }}>
                      {d.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── ベット操作 ── */}
      {isMyTurn && me && (
        <BettingControls gameState={gameState} me={me} onAction={onAction} isMobile={isMobile} />
      )}
      {!isMyTurn && gameState.phase !== 'waiting' && gameState.phase !== 'showdown' && me?.status === 'active' && (
        <div style={styles.waitingTurn}>他のプレイヤーのターンを待っています...</div>
      )}
    </div>
  );
}

// ─── チップビジュアル ──────────────────────────────────

const CHIP_COLORS = ['#f0c040', '#e17055', '#74b9ff', '#00b894', '#a29bfe', '#fd79a8'];

function ChipPile({ amount, size = 12 }: { amount: number; size?: number }) {
  const count = amount >= 1000 ? 6 : amount >= 500 ? 5 : amount >= 200 ? 4 : amount >= 100 ? 3 : amount >= 30 ? 2 : 1;
  const overlap = Math.round(size * 0.45);
  return (
    <div style={{ position: 'relative', width: size + (count - 1) * overlap, height: size, flexShrink: 0 }}>
      {CHIP_COLORS.slice(0, count).map((color, i) => (
        <div key={i} style={{
          position: 'absolute', left: i * overlap,
          width: size, height: size, borderRadius: '50%',
          background: `radial-gradient(circle at 35% 30%, ${color}, ${color}99)`,
          border: `${size >= 14 ? 2 : 1.5}px solid rgba(0,0,0,0.5)`,
          boxShadow: `0 1px 4px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.3)`,
          zIndex: i,
        }} />
      ))}
    </div>
  );
}

// ─── 楕円レイアウト ───────────────────────────────────

function OvalLayout({ gameState, myId, myIdx, onStartGame, isHost, playerActions, onNewHand, judging, palette, visibleCardCount }: {
  gameState: GameState; myId: string; myIdx: number;
  onStartGame: () => void; isHost: boolean;
  playerActions: Record<string, string>;
  onNewHand: () => void; judging: boolean; palette: string[]; visibleCardCount: number;
}) {
  const total = gameState.players.length;
  const [c1, c2, c3] = palette;
  return (
    <div style={styles.tableWrapper}>
      <div style={{
        ...styles.tableOval,
        background: `radial-gradient(ellipse at 50% 38%, ${c1} 0%, ${c2} 55%, ${c3} 100%)`,
        transition: 'background 1s ease',
      }}>
        {/* ── テーブル上のチップパイル ── */}
        {gameState.phase !== 'waiting' && gameState.players.map((player, idx) => {
          if (player.bet <= 0) return null;
          const offset = ((idx - myIdx + total) % total) / total;
          const angle = Math.PI / 2 + offset * 2 * Math.PI;
          const chipX = 50 + 26 * Math.cos(angle);
          const chipY = 50 + 23 * Math.sin(angle);
          return (
            <div key={player.id} style={{
              position: 'absolute',
              left: `${chipX}%`, top: `${chipY}%`,
              transform: 'translate(-50%, -50%)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              zIndex: 2, pointerEvents: 'none',
              animation: 'chipPop 0.3s cubic-bezier(0.34,1.6,0.64,1) both',
            }}>
              <ChipPile amount={player.bet} size={14} />
              <span style={{
                fontSize: 9, fontWeight: 800, color: '#74b9ff',
                background: 'rgba(0,0,0,0.7)', borderRadius: 4, padding: '1px 4px',
                letterSpacing: 0.2,
              }}>
                ${player.bet.toLocaleString()}
              </span>
            </div>
          );
        })}
        <Board gameState={gameState} onStartGame={onStartGame} isHost={isHost} onNewHand={onNewHand} judging={judging} myId={myId} palette={palette} visibleCardCount={visibleCardCount} />
      </div>
      {gameState.players.map((player, idx) => {
        // equity は AllInPanel で表示するので PlayerSeat では非表示
        const maskedPlayer = { ...player, equity: undefined };
        return (
          <div key={player.id} style={getSeatStyle(idx, myIdx, gameState.players.length)}>
            <PlayerSeat
              player={maskedPlayer}
              isCurrentPlayer={gameState.phase !== 'waiting' && gameState.phase !== 'showdown' && idx === gameState.currentPlayerIndex}
              isMe={player.id === myId}
              isDealer={idx === gameState.dealerIndex}
              isSB={gameState.phase !== 'waiting' && idx === gameState.smallBlindIndex}
              isBB={gameState.phase !== 'waiting' && idx === gameState.bigBlindIndex}
              hideCards={player.id === myId}
              latestAction={playerActions[player.id]}
            />
          </div>
        );
      })}
    </div>
  );
}

// ─── モバイルレイアウト ───────────────────────────────

function MobileLayout({ gameState, myId, myIdx, onStartGame, isHost, playerActions, onNewHand, judging, palette, visibleCardCount }: {
  gameState: GameState; myId: string; myIdx: number;
  onStartGame: () => void; isHost: boolean;
  playerActions: Record<string, string>;
  onNewHand: () => void; judging: boolean; palette: string[]; visibleCardCount: number;
}) {
  const others = gameState.players.filter(p => p.id !== myId);
  const me = gameState.players[myIdx];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 6, padding: '6px 10px', overflow: 'hidden' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center', flexShrink: 0 }}>
        {others.map(player => {
          const idx = gameState.players.indexOf(player);
          return (
            <PlayerSeat
              key={player.id}
              player={player}
              isCurrentPlayer={gameState.phase !== 'waiting' && gameState.phase !== 'showdown' && idx === gameState.currentPlayerIndex}
              isMe={false}
              isDealer={idx === gameState.dealerIndex}
              isSB={gameState.phase !== 'waiting' && idx === gameState.smallBlindIndex}
              isBB={gameState.phase !== 'waiting' && idx === gameState.bigBlindIndex}
              compact
              latestAction={playerActions[player.id]}
            />
          );
        })}
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <Board gameState={gameState} onStartGame={onStartGame} isHost={isHost} mobile onNewHand={onNewHand} judging={judging} myId={myId} palette={palette} visibleCardCount={visibleCardCount} />
      </div>
      {me && (
        <div style={{ display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
          <PlayerSeat
            player={me}
            isCurrentPlayer={gameState.phase !== 'waiting' && gameState.phase !== 'showdown' && myIdx === gameState.currentPlayerIndex}
            isMe
            isDealer={myIdx === gameState.dealerIndex}
            isSB={gameState.phase !== 'waiting' && myIdx === gameState.smallBlindIndex}
            isBB={gameState.phase !== 'waiting' && myIdx === gameState.bigBlindIndex}
            hideCards
            latestAction={playerActions[me.id]}
          />
        </div>
      )}
    </div>
  );
}

// ─── オールインパネル ─────────────────────────────────

const PLAYER_COLORS = ['#e17055', '#00b894', '#74b9ff', '#a29bfe', '#fd79a8', '#f0c040'];

function AllInPanel({ players, mobile, myId }: {
  players: GameState['players']; mobile: boolean; myId: string;
}) {
  const eligible = players.filter(p => p.equity !== undefined && p.status !== 'folded' && p.status !== 'sitting_out');
  if (eligible.length < 2) return null;

  const totalEquity = eligible.reduce((s, p) => s + (p.equity ?? 0), 0) || 100;

  return (
    <div style={{
      width: '100%',
      background: 'rgba(0,0,0,0.6)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: mobile ? 12 : 14,
      padding: mobile ? '8px 10px' : '10px 14px',
      display: 'flex', flexDirection: 'column', gap: mobile ? 7 : 9,
      animation: 'celebrationIn 0.35s ease-out',
    }}>

      {/* プレイヤー名 */}
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        {eligible.map((p, i) => (
          <span key={p.id} style={{
            fontSize: mobile ? 10 : 11, fontWeight: 800,
            color: p.id === myId ? '#74b9ff' : '#dfe6e9',
            textAlign: i % 2 === 0 ? 'left' : 'right',
            flex: 1,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {p.name}
          </span>
        ))}
      </div>

      {/* 勝率スプリットバー */}
      <div style={{ display: 'flex', height: mobile ? 28 : 32, borderRadius: 20, overflow: 'hidden', gap: 2 }}>
        {eligible.map((p, i) => {
          const pct = ((p.equity ?? 0) / totalEquity) * 100;
          const color = PLAYER_COLORS[i % PLAYER_COLORS.length];
          return (
            <div key={p.id} style={{
              flex: pct, background: color,
              display: 'flex', alignItems: 'center',
              justifyContent: eligible.length === 2 && i === 0 ? 'flex-start' : 'flex-end',
              padding: '0 10px',
              minWidth: 36,
              transition: 'flex 1s ease',
            }}>
              <span style={{ fontSize: mobile ? 13 : 15, fontWeight: 900, color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
                {p.equity}%
              </span>
            </div>
          );
        })}
      </div>

      {/* ハンド名 + カード */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        {eligible.map((p, i) => {
          const color = PLAYER_COLORS[i % PLAYER_COLORS.length];
          const visibleCards = p.cards.filter(c => !c.hidden);
          const align = eligible.length === 2 ? (i === 0 ? 'flex-start' : 'flex-end') : 'center';
          return (
            <div key={p.id} style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: align, gap: 4,
            }}>
              {p.handDescription && (
                <span style={{
                  fontSize: mobile ? 9 : 10, fontWeight: 800,
                  color, letterSpacing: 0.5,
                }}>
                  {p.handDescription}
                </span>
              )}
              {visibleCards.length > 0 && (
                <div style={{ display: 'flex', gap: mobile ? 3 : 4 }}>
                  {visibleCards.map((c, j) => (
                    <Card key={j} card={c} small={mobile} animationDelay={j * 80} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── ショーダウン結果パネル ──────────────────────────

function ShowdownPanel({ gameState, onNewHand, myId, mobile }: {
  gameState: GameState; onNewHand: () => void; myId: string; mobile: boolean;
}) {
  const winnerIds = new Set(gameState.winners.map(w => w.playerId));
  const eligible = gameState.players.filter(p => p.status !== 'sitting_out');

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: mobile ? 6 : 8,
      animation: 'celebrationIn 0.45s ease-out',
      width: '100%',
      maxWidth: mobile ? 340 : 480,
    }}>
      <div style={{ fontSize: mobile ? 10 : 11, fontWeight: 900, color: '#f0c040', letterSpacing: 2 }}>
        SHOWDOWN
      </div>

      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: mobile ? 5 : 8,
        justifyContent: 'center', width: '100%',
      }}>
        {eligible.map(player => {
          const isWinner = winnerIds.has(player.id);
          const isFolded = player.status === 'folded';
          const winner = gameState.winners.find(w => w.playerId === player.id);
          const isMe = player.id === myId;

          return (
            <div key={player.id} style={{
              background: isWinner
                ? 'rgba(240,192,64,0.15)'
                : isFolded ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.45)',
              border: isWinner
                ? '1.5px solid rgba(240,192,64,0.55)'
                : '1px solid rgba(255,255,255,0.1)',
              borderRadius: mobile ? 8 : 10,
              padding: mobile ? '5px 8px' : '7px 12px',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: mobile ? 3 : 4,
              minWidth: mobile ? 72 : 90,
              opacity: isFolded ? 0.55 : 1,
              boxShadow: isWinner ? '0 0 14px rgba(240,192,64,0.2)' : undefined,
            }}>
              <div style={{
                fontSize: mobile ? 9 : 10, fontWeight: 700,
                color: isMe ? '#74b9ff' : '#ddd',
                maxWidth: mobile ? 70 : 86,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {player.name}
              </div>

              {/* ホールカード */}
              {!isFolded && player.cards.filter(c => !c.hidden).length > 0 ? (
                <div style={{ display: 'flex', gap: mobile ? 2 : 3 }}>
                  {player.cards.map((c, i) => (
                    <Card key={i} card={c} small animationDelay={i * 100} />
                  ))}
                </div>
              ) : isFolded ? (
                <div style={{ display: 'flex', gap: 2 }}>
                  {[0, 1].map(i => (
                    <div key={i} style={{
                      width: mobile ? 18 : 22, height: mobile ? 26 : 32,
                      borderRadius: 3, opacity: 0.3,
                      background: 'linear-gradient(135deg,#1e3799,#0c2461)',
                      border: '1px solid rgba(255,255,255,0.12)',
                    }} />
                  ))}
                </div>
              ) : null}

              {/* ハンド説明 */}
              {player.handDescription && !isFolded && (
                <div style={{
                  fontSize: mobile ? 8 : 9, fontWeight: 800, textAlign: 'center',
                  color: isWinner ? '#f0c040' : '#aaa',
                  maxWidth: mobile ? 70 : 86,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {player.handDescription}
                </div>
              )}

              {/* 結果バッジ */}
              <div style={{
                fontSize: mobile ? 8 : 9, fontWeight: 900, letterSpacing: 0.8,
                padding: '1px 6px', borderRadius: 4,
                background: isWinner
                  ? 'rgba(240,192,64,0.25)'
                  : isFolded ? 'rgba(120,120,120,0.2)' : 'rgba(200,50,50,0.2)',
                color: isWinner ? '#f0c040' : isFolded ? '#888' : '#ef5350',
              }}>
                {isWinner
                  ? `WIN +$${winner?.amount.toLocaleString()}`
                  : isFolded ? 'FOLD' : 'LOSE'}
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={onNewHand}
        style={{
          background: 'linear-gradient(135deg,#f0c040,#e8a020)',
          color: '#1a1a2e', border: 'none', borderRadius: 8,
          padding: mobile ? '7px 18px' : '9px 22px',
          fontSize: mobile ? 12 : 13, fontWeight: 800, cursor: 'pointer',
          boxShadow: '0 3px 14px rgba(240,192,64,0.4)',
          animation: 'pulse 1.5s ease-in-out infinite',
        }}
      >
        次のハンド →
      </button>
    </div>
  );
}

// ─── ボード ───────────────────────────────────────────

function Board({ gameState, onStartGame, isHost, mobile = false, onNewHand, judging, myId, palette, visibleCardCount = 0 }: {
  gameState: GameState; onStartGame: () => void; isHost: boolean; mobile?: boolean;
  onNewHand?: () => void; judging?: boolean; myId?: string; palette?: string[]; visibleCardCount?: number;
}) {
  const [c1, c2, c3, border] = palette ?? ['#2e7d32', '#1b5e20', '#0d3b10', 'rgba(100,200,80,0.18)'];
  const visibleCards = gameState.communityCards.slice(0, visibleCardCount);

  const style: React.CSSProperties = mobile
    ? {
        background: `radial-gradient(ellipse at 50% 40%, ${c1}99 0%, ${c2}88 60%, ${c3}99 100%)`,
        border: `2px solid ${border}`,
        borderRadius: 14, padding: '10px 14px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        height: '100%', justifyContent: 'center',
        transition: 'background 1s ease, border-color 1s ease',
      }
    : {
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, zIndex: 1,
      };

  return (
    <div style={style}>
      {gameState.phase !== 'waiting' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: mobile ? 6 : 8,
          background: 'rgba(0,0,0,0.5)',
          borderRadius: 20, padding: mobile ? '4px 12px' : '4px 16px',
          border: '1px solid rgba(255,255,255,0.12)',
        }}>
          {gameState.pot > 0 && <ChipPile amount={gameState.pot} size={mobile ? 12 : 16} />}
          <span style={{ color: '#fff', fontWeight: 800, fontSize: mobile ? 12 : 14 }}>
            POT <span style={{ color: '#f0c040' }}>${gameState.pot.toLocaleString()}</span>
          </span>
          {gameState.pot > 0 && <ChipPile amount={gameState.pot} size={mobile ? 12 : 16} />}
        </div>
      )}

      <div style={{ display: 'flex', gap: mobile ? 4 : 6, alignItems: 'center', minHeight: mobile ? 52 : 80 }}>
        {visibleCards.length > 0
          ? visibleCards.map((c, i) => (
              <div key={i} style={{ animation: 'flopCard 0.45s cubic-bezier(0.34,1.4,0.64,1) both' }}>
                <Card card={c} small={mobile} />
              </div>
            ))
          : <p style={{ color: 'rgba(255,255,255,0.18)', fontSize: 12, fontStyle: 'italic' }}>
              コミュニティカード
            </p>
        }
        {/* まだ表示されていないカードのプレースホルダー */}
        {gameState.communityCards.length > visibleCardCount && (
          Array.from({ length: gameState.communityCards.length - visibleCardCount }, (_, i) => (
            <div key={`ph-${i}`} style={{
              width: mobile ? 38 : 56, height: mobile ? 52 : 78,
              borderRadius: mobile ? 5 : 8,
              background: 'rgba(255,255,255,0.08)',
              border: '1px dashed rgba(255,255,255,0.2)',
              animation: 'pulse 0.8s ease-in-out infinite',
            }} />
          ))
        )}
      </div>

      {/* ── オールインパネル（カード＋勝率） ── */}
      {gameState.players.some(p => p.equity !== undefined) && gameState.phase !== 'showdown' && (
        <AllInPanel players={gameState.players} mobile={mobile} myId={myId ?? ''} />
      )}

      {/* ── 判定中 ── */}
      {judging && (
        <div style={{
          fontSize: mobile ? 13 : 15, fontWeight: 900, color: '#f0c040',
          letterSpacing: 2, animation: 'pulse 0.8s ease-in-out infinite',
          background: 'rgba(0,0,0,0.5)', borderRadius: 8, padding: '6px 18px',
        }}>判定中...</div>
      )}

      {/* ── ショーダウン結果 ── */}
      {gameState.phase === 'showdown' && !judging && !gameState.gameOver && onNewHand && (
        <ShowdownPanel gameState={gameState} onNewHand={onNewHand} myId={myId || ''} mobile={mobile} />
      )}

      {gameState.phase === 'waiting' && (
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#b2bec3', fontSize: 13, marginBottom: 10 }}>
            {gameState.players.length}人が参加中
            {gameState.players.length < 2 && ' — あと1人以上必要'}
          </p>
          {isHost ? (
            <button
              style={{ ...styles.actionBtn, opacity: gameState.players.length >= 2 ? 1 : 0.4 }}
              onClick={onStartGame}
              disabled={gameState.players.length < 2}
            >
              ゲーム開始
            </button>
          ) : (
            <p style={{ color: '#636e72', fontSize: 13, fontStyle: 'italic' }}>
              ホストがゲームを開始するのを待っています...
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── スタイル ────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    height: '100dvh',
    display: 'flex', flexDirection: 'column',
    background: 'radial-gradient(ellipse at 50% 20%, #1a2e1a 0%, #0d1a0d 55%, #060e06 100%)',
    overflow: 'hidden',
  },
  loading: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', height: '100dvh',
  },
  spinner: {
    width: 40, height: 40,
    border: '3px solid rgba(240,192,64,0.2)',
    borderTop: '3px solid #f0c040',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '4px 12px',
    background: 'rgba(0,0,0,0.55)',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    flexWrap: 'nowrap', gap: 8,
    flexShrink: 0,
  },
  roomId: { color: '#f0c040', fontSize: 18, letterSpacing: 3, fontWeight: 900 },
  copyBtn: {
    background: 'rgba(240,192,64,0.12)',
    border: '1px solid rgba(240,192,64,0.35)',
    borderRadius: 6, color: '#f0c040',
    padding: '2px 8px', fontSize: 11, cursor: 'pointer',
  },
  phaseBadge: {
    background: 'rgba(76,175,80,0.22)', color: '#a5d6a7',
    border: '1px solid rgba(165,214,167,0.35)',
    borderRadius: 6, padding: '3px 10px', fontSize: 12, fontWeight: 700,
  },
  errorBar: {
    background: 'rgba(214,48,49,0.15)', color: '#ff6b6b',
    borderBottom: '1px solid rgba(214,48,49,0.3)',
    padding: '5px 20px', fontSize: 12, textAlign: 'center', flexShrink: 0,
  },
  actionLog: {
    background: 'rgba(255,255,255,0.03)', color: '#90a4ae',
    padding: '3px 20px', fontSize: 12, textAlign: 'center',
    borderBottom: '1px solid rgba(255,255,255,0.04)', flexShrink: 0,
  },
  tableSection: {
    flex: 1, minHeight: 0, position: 'relative',
  },
  tableWrapper: {
    position: 'absolute', inset: '8px 12px',
  },
  tableOval: {
    position: 'absolute',
    top: '10%', left: '7%', right: '7%', bottom: '10%',
    borderRadius: '50%',
    background: 'radial-gradient(ellipse at 50% 38%, #2e7d32 0%, #1b5e20 55%, #0d3b10 100%)',
    border: '7px solid #071f08',
    boxShadow: 'inset 0 0 60px rgba(0,0,0,0.5), 0 10px 50px rgba(0,0,0,0.8), 0 0 0 2px rgba(255,255,255,0.04)',
  },
  myHoleCards: {
    display: 'flex', alignItems: 'center', gap: 14,
    padding: '8px 16px',
    background: 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.7) 100%)',
    borderTop: '1px solid rgba(76,175,80,0.15)',
    flexShrink: 0,
  },
  myHandLabel: {
    display: 'flex', flexDirection: 'column', gap: 1,
  },
  actionBtn: {
    background: 'linear-gradient(135deg, #f0c040, #e8a020)',
    color: '#1a1a2e', border: 'none', borderRadius: 8,
    padding: '11px 26px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
  },
  waitingTurn: {
    textAlign: 'center', padding: '10px', color: '#546e7a', fontSize: 12,
    background: 'rgba(0,0,0,0.35)', borderTop: '1px solid rgba(255,255,255,0.05)',
    flexShrink: 0,
  },
  judging: {
    textAlign: 'center', padding: '12px', color: '#f0c040', fontSize: 15,
    fontWeight: 700, letterSpacing: 2,
    background: 'rgba(0,0,0,0.5)', borderTop: '1px solid rgba(240,192,64,0.2)',
    animation: 'pulse 0.8s ease-in-out infinite',
    flexShrink: 0,
  },
  allInOverlay: {
    position: 'fixed', inset: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    pointerEvents: 'none', zIndex: 150,
    overflow: 'hidden',
  },
  allInText: {
    fontSize: 80, fontWeight: 900, color: '#ff6b35',
    textShadow: '0 0 60px #ff6b35, 0 0 120px #e17055',
    letterSpacing: 4,
    animation: 'allInZoom 1.8s ease-out forwards',
  },
};
