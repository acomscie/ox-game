import { useEffect, useState } from "react";
import { supabase } from "./supabase";

// ── helpers ──────────────────────────────────────────────
const WIN_LINES = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6],
];

function checkWinner(b) {
  for (const [a, b1, c] of WIN_LINES) {
    if (b[a] && b[a] === b[b1] && b[a] === b[c])
      return { winner: b[a], line: [a, b1, c] };
  }
  if (b.every(Boolean)) return { winner: "draw", line: [] };
  return null;
}

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// ── design tokens ────────────────────────────────────────
const token = {
  purple:     "#7F77DD",
  purpleLight:"#EEEDFE",
  purpleMid:  "#AFA9EC",
  purpleDark: "#534AB7",
  coral:      "#D85A30",
  coralLight: "#FAECE7",
  coralMid:   "#F0997B",
  bg:         "#F8F8FC",
  surface:    "#FFFFFF",
  border:     "rgba(0,0,0,0.08)",
  borderHover:"rgba(0,0,0,0.18)",
  textPrimary:"#1A1A2E",
  textMuted:  "#6B6B80",
  textHint:   "#A0A0B0",
};

// ── global CSS (injected once) ───────────────────────────
const globalCSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Inter', sans-serif;
    background: ${token.bg};
    color: ${token.textPrimary};
    min-height: 100vh;
  }

  @keyframes popIn {
    0%   { transform: scale(0.3) rotate(-10deg); opacity: 0; }
    65%  { transform: scale(1.15) rotate(3deg); }
    100% { transform: scale(1) rotate(0deg); opacity: 1; }
  }
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(127,119,221,0.4); }
    50%       { box-shadow: 0 0 0 8px rgba(127,119,221,0); }
  }

  .ox-page {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 24px 16px;
  }

  .ox-logo {
    font-size: 26px;
    font-weight: 600;
    letter-spacing: -0.5px;
    color: ${token.textPrimary};
    margin-bottom: 4px;
  }
  .ox-logo span { color: ${token.purple}; }
  .ox-tagline {
    font-size: 13px;
    color: ${token.textMuted};
    margin-bottom: 28px;
  }

  /* ── lobby ── */
  .ox-card {
    background: ${token.surface};
    border: 1px solid ${token.border};
    border-radius: 20px;
    padding: 28px 24px;
    width: 100%;
    max-width: 340px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.06);
    animation: fadeUp 0.25s ease both;
  }
  .ox-section-label {
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: ${token.textHint};
    margin-bottom: 8px;
  }
  .ox-input {
    width: 100%;
    padding: 11px 14px;
    font-size: 15px;
    font-weight: 600;
    letter-spacing: 0.1em;
    font-family: 'Inter', monospace;
    border: 1px solid ${token.border};
    border-radius: 12px;
    background: ${token.bg};
    color: ${token.textPrimary};
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
    margin-bottom: 10px;
  }
  .ox-input:focus {
    border-color: ${token.purple};
    box-shadow: 0 0 0 3px rgba(127,119,221,0.15);
  }
  .ox-btn {
    width: 100%;
    padding: 11px 16px;
    font-size: 14px;
    font-weight: 500;
    font-family: 'Inter', sans-serif;
    border-radius: 12px;
    border: 1px solid ${token.border};
    cursor: pointer;
    background: ${token.surface};
    color: ${token.textPrimary};
    transition: background 0.12s, border-color 0.12s, transform 0.1s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }
  .ox-btn:hover   { background: ${token.bg}; border-color: ${token.borderHover}; }
  .ox-btn:active  { transform: scale(0.97); }
  .ox-btn-primary {
    background: ${token.purple};
    color: white;
    border-color: ${token.purple};
  }
  .ox-btn-primary:hover { background: ${token.purpleDark}; border-color: ${token.purpleDark}; }

  .ox-divider {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 16px 0;
    font-size: 12px;
    color: ${token.textHint};
  }
  .ox-divider::before,
  .ox-divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: ${token.border};
  }

  /* ── game screen ── */
  .ox-game-wrap {
    width: 100%;
    max-width: 360px;
    animation: fadeUp 0.25s ease both;
  }
  .ox-game-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
  }
  .ox-back-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: ${token.textMuted};
    font-size: 13px;
    font-family: 'Inter', sans-serif;
    padding: 6px 10px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    gap: 5px;
    transition: background 0.12s;
  }
  .ox-back-btn:hover { background: ${token.border}; }
  .ox-room-badge {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.08em;
    color: ${token.textMuted};
    background: ${token.bg};
    padding: 5px 12px;
    border-radius: 20px;
    border: 1px solid ${token.border};
    font-family: 'Inter', monospace;
  }
  .ox-reset-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: ${token.textMuted};
    font-size: 13px;
    font-family: 'Inter', sans-serif;
    padding: 6px 10px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    gap: 5px;
    transition: background 0.12s;
  }
  .ox-reset-btn:hover { background: ${token.border}; }

  .ox-status {
    text-align: center;
    padding: 14px 16px;
    border-radius: 14px;
    background: ${token.surface};
    border: 1px solid ${token.border};
    margin-bottom: 16px;
    transition: border-color 0.3s, box-shadow 0.3s;
    box-shadow: 0 2px 12px rgba(0,0,0,0.04);
  }
  .ox-status-label {
    font-size: 12px;
    color: ${token.textHint};
    margin-bottom: 3px;
  }
  .ox-status-value {
    font-size: 22px;
    font-weight: 600;
    transition: color 0.2s;
  }
  .ox-status-value.is-x { color: ${token.purple}; }
  .ox-status-value.is-o { color: ${token.coral}; }
  .ox-status-value.is-draw { color: ${token.textMuted}; }
  .ox-status.win-x { border-color: ${token.purpleMid}; box-shadow: 0 0 0 3px ${token.purpleLight}; }
  .ox-status.win-o { border-color: ${token.coralMid};  box-shadow: 0 0 0 3px ${token.coralLight}; }

  /* ── board ── */
  .ox-board {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin-bottom: 16px;
  }
  .ox-cell {
    aspect-ratio: 1;
    border-radius: 16px;
    border: 1px solid ${token.border};
    background: ${token.surface};
    font-size: 38px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.12s, border-color 0.12s, transform 0.1s;
    position: relative;
    overflow: hidden;
    box-shadow: 0 1px 4px rgba(0,0,0,0.04);
  }
  .ox-cell:hover:not(.is-taken):not(:disabled) {
    background: ${token.bg};
    border-color: ${token.borderHover};
    transform: scale(1.02);
  }
  .ox-cell:active:not(.is-taken):not(:disabled) { transform: scale(0.95); }
  .ox-cell.is-taken   { cursor: default; }
  .ox-cell.is-x       { background: ${token.purpleLight}; border-color: ${token.purpleMid}; }
  .ox-cell.is-o       { background: ${token.coralLight};  border-color: ${token.coralMid}; }
  .ox-cell.is-win     { animation: pulse 1.2s ease infinite; }
  .ox-cell.is-win.is-x { border-color: ${token.purple}; border-width: 2px; }
  .ox-cell.is-win.is-o { border-color: ${token.coral};  border-width: 2px; }

  .ox-symbol {
    display: inline-block;
    animation: popIn 0.22s cubic-bezier(0.34, 1.56, 0.64, 1) both;
    line-height: 1;
  }
  .ox-symbol.is-x { color: ${token.purple}; }
  .ox-symbol.is-o { color: ${token.coral}; }
`;

function injectCSS(css) {
  if (document.getElementById("ox-styles")) return;
  const style = document.createElement("style");
  style.id = "ox-styles";
  style.textContent = css;
  document.head.appendChild(style);
}

// ── component ─────────────────────────────────────────────
export default function App() {
  injectCSS(globalCSS);

  const [inputRoom, setInputRoom] = useState("");
  const [roomId, setRoomId]       = useState("");
  const [joined, setJoined]       = useState(false);
  const [board, setBoard]         = useState(Array(9).fill(null));
  const [turn, setTurn]           = useState("X");
  const [winner, setWinner]       = useState(null);
  const [winLine, setWinLine]     = useState([]);

  useEffect(() => {
    if (!joined || !roomId) return;

    loadGame();

    const channel = supabase
      .channel(`game-room-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "games" }, loadGame)
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [joined, roomId]);

  const loadGame = async () => {
    const { data } = await supabase.from("games").select("*").eq("id", roomId).single();
    if (data) {
      setBoard(data.board);
      setTurn(data.turn);
      setWinner(data.winner);
      setWinLine(data.win_line ?? []);
    }
  };

  const joinRoom = () => {
    const code = inputRoom.trim().toUpperCase();
    if (code) { setRoomId(code); setJoined(true); }
  };

  const createRoom = () => {
    const code = generateRoomCode();
    setInputRoom(code);
    setRoomId(code);
    setJoined(true);
  };

  const play = async (i) => {
    if (board[i] || winner) return;
    const newBoard = [...board];
    newBoard[i] = turn;
    const result = checkWinner(newBoard);

    await supabase.from("games").upsert({
      id: roomId,
      board: newBoard,
      turn: turn === "X" ? "O" : "X",
      winner: result ? result.winner : null,
      win_line: result ? result.line : [],
    });
  };

  const resetGame = async () => {
    await supabase.from("games").upsert({
      id: roomId,
      board: Array(9).fill(null),
      turn: "X",
      winner: null,
      win_line: [],
    });
  };

  const exitRoom = () => {
    setJoined(false);
    setRoomId("");
    setInputRoom("");
    setBoard(Array(9).fill(null));
    setTurn("X");
    setWinner(null);
    setWinLine([]);
  };

  // ── lobby ────────────────────────────────────────────────
  if (!joined) {
    return (
      <div className="ox-page">
        <p className="ox-logo">O<span>/</span>X Online</p>
        <p className="ox-tagline">เล่นกับเพื่อนแบบ realtime</p>

        <div className="ox-card">
          <p className="ox-section-label">เข้าห้องที่มีอยู่</p>
          <input
            className="ox-input"
            value={inputRoom}
            onChange={(e) => setInputRoom(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && joinRoom()}
            placeholder="รหัสห้อง เช่น AB12CD"
            maxLength={6}
          />
          <button className="ox-btn ox-btn-primary" onClick={joinRoom}>
            เข้าห้อง
          </button>

          <div className="ox-divider">หรือ</div>

          <p className="ox-section-label">ยังไม่มีห้อง?</p>
          <button className="ox-btn" onClick={createRoom}>
            + สร้างห้องใหม่
          </button>
        </div>
      </div>
    );
  }

  // ── status text ──────────────────────────────────────────
  const statusLabel = winner ? "ผลการแข่งขัน" : "เทิร์นของ";
  const statusValue =
    winner === "draw" ? "เสมอ!" : winner ? winner : turn;
  const statusClass =
    winner === "draw" ? "is-draw" : winner ? `is-${winner.toLowerCase()}` : `is-${turn.toLowerCase()}`;
  const statusBarClass =
    winner && winner !== "draw" ? `win-${winner.toLowerCase()}` : "";

  // ── game screen ──────────────────────────────────────────
  return (
    <div className="ox-page">
      <div className="ox-game-wrap">
        <div className="ox-game-header">
          <button className="ox-back-btn" onClick={exitRoom}>← ออก</button>
          <span className="ox-room-badge">{roomId}</span>
          <button className="ox-reset-btn" onClick={resetGame}>↺ รีเซ็ต</button>
        </div>

        <div className={`ox-status ${statusBarClass}`}>
          <p className="ox-status-label">{statusLabel}</p>
          <p className={`ox-status-value ${statusClass}`}>{statusValue}</p>
        </div>

        <div className="ox-board">
          {board.map((cell, i) => {
            const isWin = winLine.includes(i);
            const cls = [
              "ox-cell",
              cell ? "is-taken" : "",
              cell === "X" ? "is-x" : cell === "O" ? "is-o" : "",
              isWin ? "is-win" : "",
            ].filter(Boolean).join(" ");

            return (
              <button
                key={i}
                className={cls}
                onClick={() => play(i)}
                disabled={!!cell || !!winner}
              >
                {cell && (
                  <span className={`ox-symbol is-${cell.toLowerCase()}`}>{cell}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}