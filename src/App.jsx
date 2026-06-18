import React, { useState, useEffect } from "react";

// ── Supabase Setup ─────────────────────────────────────────
// ในโปรเจกต์จริงของคุณเอ้ ให้นำเอาคอมเมนต์บรรทัดด้านล่างนี้ออกเพื่อเชื่อมต่อฐานข้อมูลครับ
// import { supabase } from "./supabase";

// Mock object ด้านล่างนี้มีไว้เพื่อให้ระบบ Preview ในหน้าเว็บนี้ทำงานได้โดยไม่พัง
// ⚠️ ตอนที่คุณเอ้นำไปใช้ใน Vercel/เครื่องของคุณ สามารถลบ block const supabase นี้ทิ้งได้เลยครับ
const supabase = {
  channel: () => ({
    on: () => ({ subscribe: () => ({}) }),
  }),
  removeChannel: () => {},
  from: () => ({
    select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }),
    upsert: async () => ({}),
  }),
};
// ──────────────────────────────────────────────────────────

// ── Icons (Inline SVGs เพื่อแทนที่ lucide-react) ────────
const IconSparkles = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
);
const IconArrowLeft = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
);
const IconCopy = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
);
const IconCheck = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M20 6 9 17l-5-5"/></svg>
);
const IconRotateCcw = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
);

// ── Helpers ──────────────────────────────────────────────
const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // Cols
  [0, 4, 8], [2, 4, 6],            // Diagonals
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

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// ── Component ─────────────────────────────────────────────
export default function App() {
  // Room state
  const [inputRoom, setInputRoom] = useState("");
  const [roomId, setRoomId] = useState("");
  const [joined, setJoined] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Game state
  const [board, setBoard] = useState(Array(9).fill(null));
  const [turn, setTurn] = useState("X");
  const [winner, setWinner] = useState(null);
  const [winLine, setWinLine] = useState([]);

  // Sync Game Data with Supabase
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
    try {
      const { data, error } = await supabase.from("games").select("*").eq("id", roomId).single();
      if (data) {
        setBoard(data.board || Array(9).fill(null));
        setTurn(data.turn || "X");
        setWinner(data.winner || null);
        setWinLine(data.win_line || []);
      }
      if (error && error.code !== 'PGRST116') {
        console.error("Error loading game:", error);
      }
    } catch (e) {
      console.warn("Supabase fetch bypassed (Preview mode)");
    }
  };

  // ── Game Actions ──────────────────────────────────────────────
  const joinRoom = () => {
    const code = inputRoom.trim().toUpperCase();
    if (code) { 
      setRoomId(code); 
      setJoined(true); 
    }
  };

  const createRoom = async () => {
    const code = generateRoomCode();
    setInputRoom(code);
    setRoomId(code);
    
    // Initialize room in Supabase DB
    try {
      await supabase.from("games").upsert({
        id: code,
        board: Array(9).fill(null),
        turn: "X",
        winner: null,
        win_line: []
      });
    } catch (e) {
      console.warn("Supabase upsert bypassed (Preview mode)");
    }

    setJoined(true);
  };

  const play = async (i) => {
    if (board[i] || winner) return;
    
    const newBoard = [...board];
    newBoard[i] = turn;
    const result = checkWinner(newBoard);
    const nextTurn = turn === "X" ? "O" : "X";
    
    const nextWinner = result ? result.winner : null;
    const nextWinLine = result ? result.line : [];

    // Optimistic Update
    setBoard(newBoard);
    setTurn(nextTurn);
    setWinner(nextWinner);
    setWinLine(nextWinLine);

    // Sync to Supabase DB
    try {
      await supabase.from("games").upsert({
        id: roomId,
        board: newBoard,
        turn: nextTurn,
        winner: nextWinner,
        win_line: nextWinLine
      });
    } catch (e) {
      console.warn("Supabase upsert bypassed (Preview mode)");
    }
  };

  const resetGame = async () => {
    try {
      await supabase.from("games").upsert({
        id: roomId,
        board: Array(9).fill(null),
        turn: "X",
        winner: null,
        win_line: []
      });
    } catch (e) {
      console.warn("Supabase upsert bypassed (Preview mode)");
    }
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

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomId).catch(() => {
        // Fallback
        const textArea = document.createElement("textarea");
        textArea.value = roomId;
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try { document.execCommand('copy'); } catch (err) { }
        document.body.removeChild(textArea);
    });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Render ──────────────────────────────────────────────
  // Lobby View
  if (!joined) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans">
        <div className="mb-8 text-center animate-fade-in-up">
          <h1 className="text-4xl font-bold text-slate-800 tracking-tight flex justify-center items-center gap-2">
            <span className="text-indigo-500">O</span>
            <span className="text-slate-300">/</span>
            <span className="text-rose-500">X</span> 
            Online
          </h1>
          <p className="text-slate-500 mt-2 font-medium">เล่นกับเพื่อนผ่าน Supabase</p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 p-8 w-full max-w-sm animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <div className="space-y-6">
            <div>
              <label className="text-xs font-bold tracking-wider text-slate-400 uppercase mb-2 block">
                เข้าร่วมห้องที่มีอยู่
              </label>
              <input
                className="w-full px-4 py-3 text-center text-lg font-bold tracking-widest uppercase border-2 border-slate-100 rounded-xl bg-slate-50 text-slate-700 placeholder:text-slate-300 focus:outline-none focus:border-indigo-400 focus:bg-indigo-50/50 transition-all"
                value={inputRoom}
                onChange={(e) => setInputRoom(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && joinRoom()}
                placeholder="กรอกรหัส 6 หลัก"
                maxLength={6}
              />
              <button 
                onClick={joinRoom}
                disabled={!inputRoom.trim()}
                className="w-full mt-3 py-3 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 disabled:opacity-50 disabled:active:scale-100 transition-all shadow-md shadow-indigo-200"
              >
                เข้าห้องเล่น
              </button>
            </div>

            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-slate-100"></div>
              <span className="flex-shrink-0 mx-4 text-sm text-slate-400 font-medium">หรือ</span>
              <div className="flex-grow border-t border-slate-100"></div>
            </div>

            <div>
              <label className="text-xs font-bold tracking-wider text-slate-400 uppercase mb-2 block">
                สร้างห้องใหม่ชวนเพื่อน
              </label>
              <button 
                onClick={createRoom}
                className="w-full py-3 rounded-xl font-bold text-indigo-600 bg-indigo-50 border-2 border-indigo-100 hover:bg-indigo-100 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <IconSparkles className="w-5 h-5" /> สร้างห้องใหม่
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Game View Setup
  const statusLabel = winner ? "ผลการแข่งขัน" : "เทิร์นของ";
  const statusValue = winner === "draw" ? "เสมอ!" : winner ? winner : turn;
  
  const getStatusColors = () => {
    if (winner === 'draw') return 'bg-slate-100 text-slate-600 border-slate-200';
    if (statusValue === 'X') return 'bg-indigo-50 text-indigo-600 border-indigo-200';
    if (statusValue === 'O') return 'bg-rose-50 text-rose-600 border-rose-200';
    return 'bg-white text-slate-800';
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-10 px-4 font-sans selection:bg-indigo-100">
      
      {/* Custom Keyframes for Animations */}
      <style>{`
        @keyframes pop {
          0% { transform: scale(0.5); opacity: 0; }
          60% { transform: scale(1.2); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-pop { animation: pop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        .animate-fade-in-up { animation: fade-in-up 0.4s ease-out forwards; }
      `}</style>

      <div className="w-full max-w-[360px] animate-fade-in-up">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={exitRoom} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-xl transition-all">
            <IconArrowLeft className="w-6 h-6" />
          </button>
          
          <button 
            onClick={copyRoomCode}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-full shadow-sm hover:border-indigo-300 hover:bg-indigo-50 transition-all group"
          >
            <span className="font-mono font-bold text-slate-600 tracking-wider">{roomId}</span>
            {copied ? <IconCheck className="w-4 h-4 text-green-500" /> : <IconCopy className="w-4 h-4 text-slate-400 group-hover:text-indigo-500" />}
          </button>
          
          <button onClick={resetGame} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
            <IconRotateCcw className="w-6 h-6" />
          </button>
        </div>

        {/* Status Indicator */}
        <div className={`mb-8 p-4 rounded-2xl border-2 shadow-sm text-center transition-colors duration-300 ${getStatusColors()}`}>
          <p className="text-xs font-bold uppercase tracking-widest opacity-60 mb-1">{statusLabel}</p>
          <p className="text-3xl font-black">{statusValue}</p>
        </div>

        {/* Board */}
        <div className="grid grid-cols-3 gap-3 aspect-square mb-8">
          {board.map((cell, i) => {
            const isWinCell = winLine.includes(i);
            const isX = cell === "X";
            const isO = cell === "O";
            
            let cellStyle = "bg-white border-2 border-slate-100 shadow-sm";
            if (isX) cellStyle = "bg-indigo-50 border-indigo-100 text-indigo-500";
            if (isO) cellStyle = "bg-rose-50 border-rose-100 text-rose-500";
            if (isWinCell && isX) cellStyle = "bg-indigo-500 border-indigo-600 text-white shadow-lg shadow-indigo-200 z-10 scale-105";
            if (isWinCell && isO) cellStyle = "bg-rose-500 border-rose-600 text-white shadow-lg shadow-rose-200 z-10 scale-105";

            return (
              <button
                key={i}
                onClick={() => play(i)}
                disabled={!!cell || !!winner}
                className={`
                  relative flex items-center justify-center rounded-2xl text-6xl font-black
                  transition-all duration-200
                  ${!cell && !winner ? 'hover:bg-slate-50 hover:border-slate-300 hover:scale-[1.03] active:scale-[0.97] cursor-pointer' : 'cursor-default'}
                  ${cellStyle}
                `}
              >
                {cell && (
                  <span className={`animate-pop ${isWinCell ? 'drop-shadow-md' : ''}`}>
                    {cell}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        
        {/* Play Again Button (Visible on Win/Draw) */}
        {winner && (
          <div className="animate-fade-in-up">
            <button 
              onClick={resetGame}
              className="w-full py-4 rounded-xl font-bold text-white bg-slate-800 hover:bg-slate-900 active:scale-95 transition-all shadow-xl flex items-center justify-center gap-2"
            >
              <IconRotateCcw className="w-5 h-5" /> เล่นใหม่อีกครั้ง
            </button>
          </div>
        )}

      </div>
    </div>
  );
}