import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabase";
import { IconArrowLeft, IconCopy, IconCheck, IconRotateCcw, IconVolume2, IconVolumeX } from "../components/Icons";
import { playMoveSound, playWinSound, playDrawSound } from "../utils/audio";
import { fireConfetti, ConfettiContainer } from "../utils/confetti";

const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function checkWinner(board) {
  for (const [a, b, c] of WIN_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line: [a, b, c] };
    }
  }
  if (board.every(Boolean)) return { winner: "draw", line: [] };
  return null;
}

function getBotMove(board) {
  const empty = board.map((c, i) => (c ? null : i)).filter((i) => i !== null);
  if (empty.length === 0) return -1;

  for (const i of empty) {
    const test = [...board];
    test[i] = "O";
    if (checkWinner(test)?.winner === "O") return i;
  }
  for (const i of empty) {
    const test = [...board];
    test[i] = "X";
    if (checkWinner(test)?.winner === "X") return i;
  }
  if (board[4] === null) return 4;
  const corners = [0, 2, 6, 8].filter((i) => board[i] === null);
  if (corners.length) return corners[Math.floor(Math.random() * corners.length)];
  return empty[Math.floor(Math.random() * empty.length)];
}

const REACTIONS = ["😀", "😂", "🔥", "😱", "👏", "😢"];

export default function TicTacToe({ roomId, mode, exitRoom, soundOn, toggleSound }) {
  const [board, setBoard] = useState(Array(9).fill(null));
  const [turn, setTurn] = useState("X");
  const [winner, setWinner] = useState(null);
  const [winLine, setWinLine] = useState([]);
  const [score, setScore] = useState({ X: 0, O: 0, draw: 0 });
  
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
      playMoveSound(filled % 2 === 1 ? "X" : "O", soundOn);
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
            if (data.board?.game_type === 'tictactoe') {
              const state = data.board || {};
              setBoard(state.board || Array(9).fill(null));
              setTurn(state.turn || "X");
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
    if (mode !== "bot" || turn !== "O" || winner) return;
    const t = setTimeout(() => {
      const move = getBotMove(board);
      if (move !== -1) applyLocalMove(move, "O");
    }, 550);
    return () => clearTimeout(t);
  }, [mode, turn, winner, board]);

  async function loadGame() {
    const { data } = await supabase.from("games").select("*").eq("id", roomId).single();
    if (data && data.board?.game_type === 'tictactoe') {
      const state = data.board || {};
      setBoard(state.board || Array(9).fill(null));
      setTurn(state.turn || "X");
      setWinner(state.winner || null);
      setWinLine(state.winLine || []);
    }
  }

  function applyLocalMove(i, symbol) {
    setBoard((prev) => {
      if (prev[i]) return prev;
      const next = [...prev];
      next[i] = symbol;
      const result = checkWinner(next);
      setTurn(symbol === "X" ? "O" : "X");
      setWinner(result ? result.winner : null);
      setWinLine(result ? result.line : []);
      return next;
    });
  }

  const syncState = async (newState) => {
    if (mode === "online") {
      await supabase.from("games").upsert({
        id: roomId,
        board: { game_type: 'tictactoe', ...newState }
      });
    }
  };

  const play = async (i) => {
    if (board[i] || winner) return;
    if (mode === "bot" && turn !== "X") return;

    const newBoard = [...board];
    newBoard[i] = turn;
    const result = checkWinner(newBoard);
    const nextTurn = turn === "X" ? "O" : "X";
    const nextWinner = result ? result.winner : null;
    const nextWinLine = result ? result.line : [];

    setBoard(newBoard);
    setTurn(nextTurn);
    setWinner(nextWinner);
    setWinLine(nextWinLine);

    if (mode === "online") {
      await syncState({ board: newBoard, turn: nextTurn, winner: nextWinner, winLine: nextWinLine });
    }
  };

  const resetGame = async () => {
    setBoard(Array(9).fill(null));
    setTurn("X");
    setWinner(null);
    setWinLine([]);

    if (mode === "online") {
      await supabase.from("games").upsert({
        id: roomId,
        game_type: 'tictactoe',
        state: { board: Array(9).fill(null), turn: "X", winner: null, winLine: [] }
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
  const statusValue = winner === "draw" ? "เสมอ!" : winner ? winner : turn;

  const getStatusColors = () => {
    if (winner === "draw") return "glass text-slate-300 border-slate-500/50";
    if (statusValue === "X") return "glass border-indigo-400/50 text-indigo-300 shadow-[0_0_15px_rgba(99,102,241,0.2)]";
    if (statusValue === "O") return "glass border-pink-400/50 text-pink-300 shadow-[0_0_15px_rgba(244,114,182,0.2)]";
    return "glass-dark text-slate-200";
  };

  return (
    <div className="w-full max-w-[360px] md:max-w-[480px] lg:max-w-[600px] animate-fade-in-up relative">
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
        <button onClick={exitRoom} className="btn-arcade p-2 text-indigo-200 hover:text-white glass-dark hover:bg-indigo-600/50 rounded-xl transition-all border border-indigo-500/30">
          <IconArrowLeft className="w-6 h-6" />
        </button>

        {mode === "online" && (
          <button onClick={copyRoomCode} className="btn-arcade flex items-center gap-2 px-4 py-2 glass-dark border border-indigo-500/30 rounded-full shadow-sm hover:border-indigo-400 hover:bg-indigo-900/50 transition-all group">
            <span className="font-mono font-bold text-indigo-200 tracking-wider neon-text">{roomId}</span>
            {copied ? <IconCheck className="w-4 h-4 text-emerald-400" /> : <IconCopy className="w-4 h-4 text-indigo-400 group-hover:text-indigo-300" />}
          </button>
        )}

        <div className="flex items-center gap-2">
          <button onClick={toggleSound} className="btn-arcade p-2 text-indigo-300 hover:text-white glass-dark hover:bg-indigo-600/50 border border-indigo-500/30 rounded-xl transition-all">
            {soundOn ? <IconVolume2 className="w-5 h-5" /> : <IconVolumeX className="w-5 h-5" />}
          </button>
          <button onClick={resetGame} className="btn-arcade p-2 text-indigo-300 hover:text-white glass-dark hover:bg-indigo-600/50 border border-indigo-500/30 rounded-xl transition-all">
            <IconRotateCcw className="w-6 h-6" />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4 glass-dark border border-indigo-500/30 rounded-2xl px-4 py-3 shadow-lg">
        <div className="flex items-center gap-4 text-sm w-full justify-between px-2">
          <span className="font-bold text-indigo-400 flex flex-col items-center">
            <span className="text-xs text-indigo-300/70">ผู้เล่น X</span>
            <span className="text-xl text-white neon-text-x">{score.X}</span>
          </span>
          <span className="font-bold text-slate-400 flex flex-col items-center">
             <span className="text-xs">เสมอ</span>
             <span className="text-xl text-slate-300">{score.draw}</span>
          </span>
          <span className="font-bold text-pink-400 flex flex-col items-center">
            <span className="text-xs text-pink-300/70">ผู้เล่น O</span>
            <span className="text-xl text-white neon-text-o">{score.O}</span>
          </span>
        </div>
      </div>

      <div className={`mb-6 p-4 rounded-2xl border-2 shadow-md text-center transition-all duration-300 ${getStatusColors()}`}>
        <p className="text-xs font-bold uppercase tracking-widest opacity-60 mb-1">{statusLabel}</p>
        <p className="text-3xl font-black animate-pop">{statusValue}</p>
      </div>

      <div className="grid grid-cols-3 gap-3 aspect-square mb-6">
        {board.map((cell, i) => {
          const isWinCell = winLine.includes(i);
          const isX = cell === "X";
          const isO = cell === "O";

          let cellStyle = "glass-dark border-indigo-500/20";
          if (isX) cellStyle = "glass border-indigo-500/40 text-indigo-400 shadow-[inset_0_0_15px_rgba(99,102,241,0.2)]";
          if (isO) cellStyle = "glass border-pink-500/40 text-pink-400 shadow-[inset_0_0_15px_rgba(244,114,182,0.2)]";
          if (isWinCell && isX) cellStyle = "glass border-indigo-400 bg-indigo-500/20 text-indigo-300 shadow-[0_0_20px_rgba(99,102,241,0.5)] z-10 scale-105";
          if (isWinCell && isO) cellStyle = "glass border-pink-400 bg-pink-500/20 text-pink-300 shadow-[0_0_20px_rgba(244,114,182,0.5)] z-10 scale-105";

          return (
            <button
              key={i}
              onClick={() => play(i)}
              disabled={!!cell || !!winner || (mode === "bot" && turn !== "X")}
              className={`
                relative flex items-center justify-center rounded-2xl
                transition-all duration-300 border backdrop-blur-md
                ${!cell && !winner ? "hover:bg-white/5 hover:border-indigo-400/50 hover:scale-[1.03] active:scale-[0.97] cursor-pointer" : "cursor-default"}
                ${cellStyle}
              `}
            >
              {cell && (
                <div className={`${isWinCell ? "animate-pulse" : ""}`}>
                  {isX && (
                    <svg viewBox="0 0 100 100" className="w-16 h-16 sm:w-20 sm:h-20 drop-shadow-[0_0_8px_rgba(99,102,241,0.8)]">
                      <path d="M 25 25 L 75 75" stroke="currentColor" strokeWidth="12" strokeLinecap="round" fill="none" className="animate-draw" />
                      <path d="M 75 25 L 25 75" stroke="currentColor" strokeWidth="12" strokeLinecap="round" fill="none" className="animate-draw" style={{animationDelay: '0.2s', animationFillMode: 'forwards'}} />
                    </svg>
                  )}
                  {isO && (
                    <svg viewBox="0 0 100 100" className="w-16 h-16 sm:w-20 sm:h-20 drop-shadow-[0_0_8px_rgba(244,114,182,0.8)]">
                      <circle cx="50" cy="50" r="30" fill="none" stroke="currentColor" strokeWidth="12" strokeLinecap="round" className="animate-draw" />
                    </svg>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-2 mb-6">
        {REACTIONS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => sendEmoji(emoji)}
            className="btn-arcade text-2xl glass-dark border border-indigo-500/30 rounded-xl w-12 h-12 flex items-center justify-center hover:bg-white/10 hover:border-indigo-400/50 transition-all shadow-sm"
          >
            {emoji}
          </button>
        ))}
      </div>

      {winner && (
        <div className="animate-fade-in-up">
          <button onClick={resetGame} className="btn-arcade w-full py-4 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-500 border border-indigo-400 transition-all shadow-[0_0_15px_rgba(99,102,241,0.5)] flex items-center justify-center gap-2 text-lg">
            <IconRotateCcw className="w-6 h-6" /> เล่นใหม่อีกครั้ง
          </button>
        </div>
      )}
    </div>
  );
}
