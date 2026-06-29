import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabase";
import { IconArrowLeft, IconCopy, IconCheck, IconRotateCcw, IconVolume2, IconVolumeX } from "../components/Icons";
import { playWinSound, playDrawSound, playDropSound } from "../utils/audio";
import { fireConfetti, ConfettiContainer } from "../utils/confetti";

const ROWS = 6;
const COLS = 7;

function checkConnectFourWinner(board) {
  // Check horizontal
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS - 3; c++) {
      const idx = r * COLS + c;
      if (board[idx] && board[idx] === board[idx + 1] && board[idx] === board[idx + 2] && board[idx] === board[idx + 3]) {
        return { winner: board[idx], line: [idx, idx+1, idx+2, idx+3] };
      }
    }
  }
  // Check vertical
  for (let r = 0; r < ROWS - 3; r++) {
    for (let c = 0; c < COLS; c++) {
      const idx = r * COLS + c;
      if (board[idx] && board[idx] === board[idx + COLS] && board[idx] === board[idx + COLS * 2] && board[idx] === board[idx + COLS * 3]) {
        return { winner: board[idx], line: [idx, idx+COLS, idx+COLS*2, idx+COLS*3] };
      }
    }
  }
  // Check diagonal right
  for (let r = 0; r < ROWS - 3; r++) {
    for (let c = 0; c < COLS - 3; c++) {
      const idx = r * COLS + c;
      if (board[idx] && board[idx] === board[idx + COLS + 1] && board[idx] === board[idx + (COLS+1) * 2] && board[idx] === board[idx + (COLS+1) * 3]) {
        return { winner: board[idx], line: [idx, idx+COLS+1, idx+(COLS+1)*2, idx+(COLS+1)*3] };
      }
    }
  }
  // Check diagonal left
  for (let r = 0; r < ROWS - 3; r++) {
    for (let c = 3; c < COLS; c++) {
      const idx = r * COLS + c;
      if (board[idx] && board[idx] === board[idx + COLS - 1] && board[idx] === board[idx + (COLS-1) * 2] && board[idx] === board[idx + (COLS-1) * 3]) {
        return { winner: board[idx], line: [idx, idx+COLS-1, idx+(COLS-1)*2, idx+(COLS-1)*3] };
      }
    }
  }

  if (board.every(Boolean)) return { winner: "draw", line: [] };
  return null;
}

function getLowestEmptyRow(board, col) {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (!board[r * COLS + col]) return r;
  }
  return -1;
}

function getBotMoveConnectFour(board) {
  const validCols = [];
  for (let c = 0; c < COLS; c++) {
    if (getLowestEmptyRow(board, c) !== -1) validCols.push(c);
  }
  if (validCols.length === 0) return -1;

  // Simple bot logic: Check for win, check for block, random move
  for (const c of validCols) {
    const r = getLowestEmptyRow(board, c);
    const test = [...board];
    test[r * COLS + c] = "P2"; // Bot is P2
    if (checkConnectFourWinner(test)?.winner === "P2") return c;
  }
  for (const c of validCols) {
    const r = getLowestEmptyRow(board, c);
    const test = [...board];
    test[r * COLS + c] = "P1";
    if (checkConnectFourWinner(test)?.winner === "P1") return c;
  }
  return validCols[Math.floor(Math.random() * validCols.length)];
}

const REACTIONS = ["😀", "😂", "🔥", "😱", "👏", "😢"];

export default function ConnectFour({ roomId, mode, exitRoom, soundOn, toggleSound }) {
  const [board, setBoard] = useState(Array(ROWS * COLS).fill(null));
  const [turn, setTurn] = useState("P1"); // P1 (Red), P2 (Yellow)
  const [winner, setWinner] = useState(null);
  const [winLine, setWinLine] = useState([]);
  const [score, setScore] = useState({ P1: 0, P2: 0, draw: 0 });
  const [animatingCell, setAnimatingCell] = useState(null);
  
  const [confetti, setConfetti] = useState([]);
  const [floatingEmojis, setFloatingEmojis] = useState([]);
  const [copied, setCopied] = useState(false);

  const channelRef = useRef(null);
  const prevWinnerRef = useRef(null);
  const prevFilledRef = useRef(0);

  useEffect(() => {
    if (winner && prevWinnerRef.current === null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (winner === "draw") {
        playDrawSound(soundOn);
        setScore((s) => ({ ...s, draw: s.draw + 1 }));
      } else {
        playWinSound(soundOn);
        fireConfetti(setConfetti);
        setScore((s) => ({ ...s, [winner]: s[winner] + 1 }));
      }
    }
    prevWinnerRef.current = winner;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winner, soundOn]);

  useEffect(() => {
    const filled = board.filter(Boolean).length;
    if (filled > prevFilledRef.current) {
      playDropSound(soundOn);
    }
    prevFilledRef.current = filled;
  }, [board, soundOn]);

  useEffect(() => {
    if (mode !== "online") return;
    loadGame();

    const channel = supabase
      .channel(`room-${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "games", filter: `id=eq.${roomId}` },
        (payload) => {
          if (payload.new && Object.keys(payload.new).length > 0) {
            const data = payload.new;
            if (data.state?.game_type === 'connectfour') {
              const state = data.state || {};
              setBoard(state.board || Array(ROWS * COLS).fill(null));
              setTurn(state.turn || "P1");
              setWinner(state.winner || null);
              setWinLine(state.winLine || []);
            }
          }
        }
      )
      .on("broadcast", { event: "emoji" }, ({ payload }) => {
        showFloatingEmoji(payload.emoji);
      })
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error("เชื่อมต่อ Realtime ไม่สำเร็จ");
        }
      });

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, mode]);

  useEffect(() => {
    if (mode !== "bot" || turn !== "P2" || winner) return;
    const t = setTimeout(() => {
      const col = getBotMoveConnectFour(board);
      if (col !== -1) play(col, true);
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, turn, winner, board]);

  async function loadGame() {
    const { data } = await supabase.from("games").select("*").eq("id", roomId).single();
    if (data && data.state?.game_type === 'connectfour') {
      const state = data.state || {};
      setBoard(state.board || Array(ROWS * COLS).fill(null));
      setTurn(state.turn || "P1");
      setWinner(state.winner || null);
      setWinLine(state.winLine || []);
    }
  }

  const play = async (colIndex, isBot = false) => {
    if (winner) return;
    if (mode === "bot" && turn !== "P1" && !isBot) return; // Wait for bot

    const r = getLowestEmptyRow(board, colIndex);
    if (r === -1) return; // Column full

    const idx = r * COLS + colIndex;
    const newBoard = [...board];
    newBoard[idx] = turn;
    
    setAnimatingCell(idx);
    setTimeout(() => setAnimatingCell(null), 400);

    const result = checkConnectFourWinner(newBoard);
    const nextTurn = turn === "P1" ? "P2" : "P1";
    const nextWinner = result ? result.winner : null;
    const nextWinLine = result ? result.line : [];

    setBoard(newBoard);
    setTurn(nextTurn);
    setWinner(nextWinner);
    setWinLine(nextWinLine);

    if (mode === "online") {
      await supabase.from("games").upsert({
        id: roomId,
        state: { game_type: 'connectfour', board: newBoard, turn: nextTurn, winner: nextWinner, winLine: nextWinLine }
      });
    }
  };

  const resetGame = async () => {
    setBoard(Array(ROWS * COLS).fill(null));
    setTurn("P1");
    setWinner(null);
    setWinLine([]);

    if (mode === "online") {
      await supabase.from("games").upsert({
        id: roomId,
        game_type: 'connectfour',
        state: { board: Array(ROWS * COLS).fill(null), turn: "P1", winner: null, winLine: [] }
      });
    }
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  function showFloatingEmoji(emoji) {
    const id = `${Date.now()}-${Math.random()}`;
    const left = 15 + Math.random() * 70;
    setFloatingEmojis((prev) => [...prev, { id, emoji, left }]);
    setTimeout(() => {
      setFloatingEmojis((prev) => prev.filter((f) => f.id !== id));
    }, 1800);
  }

  function sendEmoji(emoji) {
    showFloatingEmoji(emoji);
    if (mode === "online" && channelRef.current) {
      channelRef.current.send({ type: "broadcast", event: "emoji", payload: { emoji } });
    }
  }

  const statusLabel = winner ? "ผลการแข่งขัน" : "เทิร์นของ";
  const statusValue = winner === "draw" ? "เสมอ!" : winner === "P1" ? "แดง (P1)" : winner === "P2" ? "เหลือง (P2)" : turn === "P1" ? "แดง (P1)" : "เหลือง (P2)";

  const getStatusColors = () => {
    if (winner === "draw") return "bg-slate-100 text-slate-600 border-slate-200";
    if (turn === "P1" || winner === "P1") return "bg-red-50 text-red-600 border-red-200 shadow-red-100";
    if (turn === "P2" || winner === "P2") return "bg-yellow-50 text-yellow-600 border-yellow-200 shadow-yellow-100";
    return "bg-white text-slate-800";
  };

  return (
    <div className="w-full max-w-sm animate-fade-in-up relative">
      <ConfettiContainer confetti={confetti} />
      
      {/* Floating emoji reactions */}
      <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
        {floatingEmojis.map((f) => (
          <div
            key={f.id}
            style={{ position: "absolute", left: `${f.left}%`, bottom: "120px", fontSize: "32px", animation: "float-up 1.8s ease-out forwards" }}
          >
            {f.emoji}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mb-4">
        <button onClick={exitRoom} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-xl transition-all">
          <IconArrowLeft className="w-6 h-6" />
        </button>

        {mode === "online" && (
          <button onClick={copyRoomCode} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-full shadow-sm hover:border-indigo-300 hover:bg-indigo-50 transition-all group">
            <span className="font-mono font-bold text-slate-600 tracking-wider">{roomId}</span>
            {copied ? <IconCheck className="w-4 h-4 text-green-500" /> : <IconCopy className="w-4 h-4 text-slate-400 group-hover:text-indigo-500" />}
          </button>
        )}

        <div className="flex items-center gap-1">
          <button onClick={toggleSound} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
            {soundOn ? <IconVolume2 className="w-5 h-5" /> : <IconVolumeX className="w-5 h-5" />}
          </button>
          <button onClick={resetGame} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
            <IconRotateCcw className="w-6 h-6" />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4 bg-white/80 backdrop-blur-sm border border-slate-100 rounded-2xl px-4 py-3 shadow-sm">
        <div className="flex items-center gap-4 text-sm w-full justify-between px-2">
          <span className="font-bold text-red-600 flex flex-col items-center">
            <span className="text-xs text-slate-400">P1 (แดง)</span>
            <span className="text-xl text-slate-800">{score.P1}</span>
          </span>
          <span className="font-bold text-slate-400 flex flex-col items-center">
             <span className="text-xs">เสมอ</span>
             <span className="text-xl text-slate-700">{score.draw}</span>
          </span>
          <span className="font-bold text-yellow-500 flex flex-col items-center">
            <span className="text-xs text-slate-400">P2 (เหลือง)</span>
            <span className="text-xl text-slate-800">{score.P2}</span>
          </span>
        </div>
      </div>

      <div className={`mb-6 p-4 rounded-2xl border-2 shadow-md text-center transition-all duration-300 ${getStatusColors()}`}>
        <p className="text-xs font-bold uppercase tracking-widest opacity-60 mb-1">{statusLabel}</p>
        <p className="text-xl font-black animate-pop">{statusValue}</p>
      </div>

      {/* Connect 4 Board */}
      <div className="bg-blue-600 p-3 rounded-2xl shadow-xl shadow-blue-200 border-b-8 border-blue-800 mb-6">
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {board.map((cell, i) => {
            const isWinCell = winLine.includes(i);
            const c = i % COLS;
            
            let color = "bg-white shadow-inner shadow-slate-300";
            if (cell === "P1") color = "bg-red-500 shadow-md shadow-red-900";
            if (cell === "P2") color = "bg-yellow-400 shadow-md shadow-yellow-700";
            
            const dropClass = animatingCell === i ? "animate-drop" : "";
            const pulseClass = isWinCell ? "animate-pulse ring-4 ring-white" : "";

            return (
              <div 
                key={i} 
                className="w-full aspect-square relative flex items-center justify-center cursor-pointer group"
                onClick={() => play(c)}
              >
                {/* Hole cut out effect via border and rounded-full */}
                <div className={`w-[85%] h-[85%] rounded-full ${color} ${dropClass} ${pulseClass} transition-colors duration-200`}></div>
                
                {/* Hover indicator (only on empty top row or lowest available row) */}
                {!cell && !winner && (turn === "P1" || mode !== "bot") && (
                  <div className={`absolute top-0 w-[85%] h-[85%] rounded-full opacity-0 group-hover:opacity-40 transition-opacity ${turn === "P1" ? "bg-red-300" : "bg-yellow-200"}`}></div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <style>{`
        @keyframes dropIn {
          0% { transform: translateY(-300%); opacity: 0; }
          60% { transform: translateY(10%); opacity: 1; }
          80% { transform: translateY(-5%); }
          100% { transform: translateY(0); }
        }
        .animate-drop { animation: dropIn 0.4s ease-out forwards; }
      `}</style>

      <div className="flex items-center justify-center gap-2 mb-6">
        {REACTIONS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => sendEmoji(emoji)}
            className="text-2xl bg-white border border-slate-100 rounded-xl w-10 h-10 flex items-center justify-center hover:bg-slate-50 hover:scale-110 active:scale-95 transition-all shadow-sm"
          >
            {emoji}
          </button>
        ))}
      </div>

      {winner && (
        <div className="animate-fade-in-up">
          <button onClick={resetGame} className="w-full py-4 rounded-xl font-bold text-white bg-slate-800 hover:bg-slate-900 active:scale-95 transition-all shadow-xl flex items-center justify-center gap-2">
            <IconRotateCcw className="w-5 h-5" /> เล่นใหม่อีกครั้ง
          </button>
        </div>
      )}
    </div>
  );
}
