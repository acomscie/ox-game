import React, { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";

// Tailwind ถูกโหลดผ่าน <script> ใน public/index.html แล้ว
// ไม่ต้อง inject ผ่าน JS อีกต่อไป (ป้องกันปัญหาหน้าจอไม่มีสไตล์ตอนโหลดครั้งแรก)

// ── Icons (Inline SVGs) ──────────────────────────────────
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
const IconRobot = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></svg>
);
const IconVolume2 = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
);
const IconVolumeX = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="22" y1="9" x2="16" y2="15"/><line x1="16" y1="9" x2="22" y2="15"/></svg>
);

// ── Helpers ──────────────────────────────────────────────
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

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// บอทเล่นเป็น O — เช็คชนะก่อน, บล็อกก่อน, แล้วค่อยเล่นตามจุดยุทธศาสตร์
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
const CONFETTI_COLORS = ["#6366f1", "#f43f5e", "#f59e0b", "#10b981", "#06b6d4"];

// ── Component ─────────────────────────────────────────────
export default function App() {
  const [inputRoom, setInputRoom] = useState("");
  const [roomId, setRoomId] = useState("");
  const [joined, setJoined] = useState(false);
  const [mode, setMode] = useState("online"); // "online" | "bot"
  const [copied, setCopied] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [soundOn, setSoundOn] = useState(true);

  const [board, setBoard] = useState(Array(9).fill(null));
  const [turn, setTurn] = useState("X");
  const [winner, setWinner] = useState(null);
  const [winLine, setWinLine] = useState([]);

  const [score, setScore] = useState({ X: 0, O: 0, draw: 0 });
  const [confetti, setConfetti] = useState([]);
  const [floatingEmojis, setFloatingEmojis] = useState([]);

  const audioCtxRef = useRef(null);
  const channelRef = useRef(null);
  const prevWinnerRef = useRef(null);
  const prevFilledRef = useRef(0);

  // ── Sound effects (Web Audio API, ไม่ต้องใช้ไฟล์เสียงภายนอก) ──
  const playTone = (freq, duration = 0.1, type = "sine", delay = 0) => {
    if (!soundOn) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.001, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + delay + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + duration + 0.02);
    } catch (e) {
      // เบราว์เซอร์บางตัวบล็อก AudioContext จนกว่าจะมี user gesture — ข้ามไปเงียบๆ
    }
  };

  const playMoveSound = (symbol) => playTone(symbol === "X" ? 520 : 380, 0.08, "triangle");
  const playWinSound = () => {
    [523, 659, 784].forEach((f, i) => playTone(f, 0.18, "sine", i * 0.12));
  };
  const playDrawSound = () => playTone(300, 0.3, "sawtooth");

  // ── Confetti (สร้างด้วย CSS div ไม่ต้องพึ่ง library) ───────
  const fireConfetti = () => {
    const pieces = Array.from({ length: 36 }, (_, i) => ({
      id: `${Date.now()}-${i}`,
      left: Math.random() * 100,
      bg: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      delay: Math.random() * 0.3,
      duration: 1.6 + Math.random() * 0.8,
      rotate: Math.random() * 360,
    }));
    setConfetti(pieces);
    setTimeout(() => setConfetti([]), 2600);
  };

  // ── ตรวจจับการเปลี่ยนแปลงของ winner เพื่อนับคะแนน + เสียง + confetti ──
  useEffect(() => {
    if (winner && prevWinnerRef.current === null) {
      if (winner === "draw") {
        playDrawSound();
        setScore((s) => ({ ...s, draw: s.draw + 1 }));
      } else {
        playWinSound();
        fireConfetti();
        setScore((s) => ({ ...s, [winner]: s[winner] + 1 }));
      }
    }
    prevWinnerRef.current = winner;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winner]);

  // ── เสียงตอนวางหมาก (เช็คจากจำนวนช่องที่เต็มเพิ่มขึ้น) ───────
  useEffect(() => {
    const filled = board.filter(Boolean).length;
    if (filled > prevFilledRef.current) {
      playMoveSound(filled % 2 === 1 ? "X" : "O");
    }
    prevFilledRef.current = filled;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board]);

  // ── Sync game data with Supabase (เฉพาะโหมด online) ─────────
  useEffect(() => {
    if (!joined || !roomId || mode !== "online") return;

    loadGame();

    const channel = supabase
      .channel(`room-${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "games", filter: `id=eq.${roomId}` },
        (payload) => {
          if (payload.new && Object.keys(payload.new).length > 0) {
            const data = payload.new;
            setBoard(data.board || Array(9).fill(null));
            setTurn(data.turn || "X");
            setWinner(data.winner || null);
            setWinLine(data.win_line || []);
          }
        }
      )
      .on("broadcast", { event: "emoji" }, ({ payload }) => {
        showFloatingEmoji(payload.emoji);
      })
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setLoadError("เชื่อมต่อ Realtime ไม่สำเร็จ ตรวจสอบว่าเปิด Replication ให้ table games แล้วหรือยัง");
        }
      });

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [joined, roomId, mode]);

  // ── บอทเดินหมาก (เฉพาะโหมด bot, ตาของ O) ─────────────────────
  useEffect(() => {
    if (mode !== "bot" || !joined || turn !== "O" || winner) return;
    const t = setTimeout(() => {
      const move = getBotMove(board);
      if (move !== -1) applyLocalMove(move, "O");
    }, 550);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, joined, turn, winner, board]);

  const loadGame = async () => {
    const { data, error } = await supabase.from("games").select("*").eq("id", roomId).single();

    if (data) {
      setBoard(data.board || Array(9).fill(null));
      setTurn(data.turn || "X");
      setWinner(data.winner || null);
      setWinLine(data.win_line || []);
      setLoadError("");
    }
    if (error && error.code !== "PGRST116") {
      console.error("Error loading game:", error);
      setLoadError(`โหลดเกมไม่สำเร็จ: ${error.message}`);
    }
  };

  // ── Game actions ──────────────────────────────────────────
  const joinRoom = () => {
    const code = inputRoom.trim().toUpperCase();
    if (code) {
      setMode("online");
      setRoomId(code);
      setJoined(true);
    }
  };

  const createRoom = async () => {
    const code = generateRoomCode();
    setInputRoom(code);
    setMode("online");
    setRoomId(code);
    setJoined(true);

    const { error } = await supabase.from("games").upsert({
      id: code,
      board: Array(9).fill(null),
      turn: "X",
      winner: null,
      win_line: [],
    });
    if (error) {
      console.error("Create room error:", error);
      setLoadError(`สร้างห้องไม่สำเร็จ: ${error.message}`);
    }
  };

  const playWithBot = () => {
    setMode("bot");
    setRoomId("BOT");
    setBoard(Array(9).fill(null));
    setTurn("X");
    setWinner(null);
    setWinLine([]);
    setJoined(true);
  };

  // คำนวณการเดินแบบ pure แล้วอัปเดต state ในเครื่อง (ใช้ทั้งโหมด bot และ optimistic update ของ online)
  const applyLocalMove = (i, symbol) => {
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
  };

  const play = async (i) => {
    if (board[i] || winner) return;
    if (mode === "bot" && turn !== "X") return; // รอบของบอท ห้ามผู้เล่นแทรก

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
      const { error } = await supabase.from("games").upsert({
        id: roomId,
        board: newBoard,
        turn: nextTurn,
        winner: nextWinner,
        win_line: nextWinLine,
      });
      if (error) {
        console.error("Play error:", error);
        setLoadError(`บันทึกการเดินไม่สำเร็จ: ${error.message}`);
      }
    }
  };

  const resetGame = async () => {
    setBoard(Array(9).fill(null));
    setTurn("X");
    setWinner(null);
    setWinLine([]);

    if (mode === "online") {
      const { error } = await supabase.from("games").upsert({
        id: roomId,
        board: Array(9).fill(null),
        turn: "X",
        winner: null,
        win_line: [],
      });
      if (error) {
        console.error("Reset error:", error);
        setLoadError(`รีเซ็ตไม่สำเร็จ: ${error.message}`);
      }
    }
  };

  const resetScore = () => setScore({ X: 0, O: 0, draw: 0 });

  const exitRoom = () => {
    setJoined(false);
    setRoomId("");
    setInputRoom("");
    setMode("online");
    setBoard(Array(9).fill(null));
    setTurn("X");
    setWinner(null);
    setWinLine([]);
    setLoadError("");
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomId).catch(() => {
      const textArea = document.createElement("textarea");
      textArea.value = roomId;
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try { document.execCommand("copy"); } catch (err) {}
      document.body.removeChild(textArea);
    });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Emoji / chat reactions ────────────────────────────────
  const showFloatingEmoji = (emoji) => {
    const id = `${Date.now()}-${Math.random()}`;
    const left = 15 + Math.random() * 70;
    setFloatingEmojis((prev) => [...prev, { id, emoji, left }]);
    setTimeout(() => {
      setFloatingEmojis((prev) => prev.filter((f) => f.id !== id));
    }, 1800);
  };

  const sendEmoji = (emoji) => {
    showFloatingEmoji(emoji); // โชว์ฝั่งตัวเองทันที
    if (mode === "online" && channelRef.current) {
      channelRef.current.send({ type: "broadcast", event: "emoji", payload: { emoji } });
    }
  };

  // ── Render: lobby ─────────────────────────────────────────
  if (!joined) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex flex-col items-center justify-center p-6 font-sans">
        <div className="mb-8 text-center animate-fade-in-up">
          <h1 className="text-4xl font-bold text-slate-800 tracking-tight flex justify-center items-center gap-2">
            <span className="text-indigo-500">O</span>
            <span className="text-slate-300">/</span>
            <span className="text-rose-500">X</span>
            Online
          </h1>
        </div>

        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 p-8 w-full max-w-sm animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
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

            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-slate-100"></div>
              <span className="flex-shrink-0 mx-4 text-sm text-slate-400 font-medium">หรือ</span>
              <div className="flex-grow border-t border-slate-100"></div>
            </div>

            <button
              onClick={playWithBot}
              className="w-full py-3 rounded-xl font-bold text-emerald-600 bg-emerald-50 border-2 border-emerald-100 hover:bg-emerald-100 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <IconRobot className="w-5 h-5" /> เล่นกับบอท
            </button>

            {loadError && (
              <p className="text-xs text-rose-500 text-center bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
                {loadError}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  const statusLabel = winner ? "ผลการแข่งขัน" : "เทิร์นของ";
  const statusValue = winner === "draw" ? "เสมอ!" : winner ? winner : turn;

  const getStatusColors = () => {
    if (winner === "draw") return "bg-slate-100 text-slate-600 border-slate-200";
    if (statusValue === "X") return "bg-indigo-50 text-indigo-600 border-indigo-200";
    if (statusValue === "O") return "bg-rose-50 text-rose-600 border-rose-200";
    return "bg-white text-slate-800";
  };

  // ── Render: game screen ───────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex flex-col items-center py-10 px-4 font-sans selection:bg-indigo-100 relative overflow-hidden">

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
        @keyframes confetti-fall {
          0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(540deg); opacity: 0.4; }
        }
        @keyframes float-up {
          0% { transform: translateY(0) scale(0.6); opacity: 0; }
          15% { transform: translateY(-10px) scale(1.2); opacity: 1; }
          100% { transform: translateY(-140px) scale(1); opacity: 0; }
        }
        .animate-pop { animation: pop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        .animate-fade-in-up { animation: fade-in-up 0.4s ease-out forwards; }
      `}</style>

      {/* Confetti */}
      <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
        {confetti.map((p) => (
          <div
            key={p.id}
            style={{
              position: "absolute",
              left: `${p.left}%`,
              top: "-10px",
              width: "8px",
              height: "14px",
              background: p.bg,
              transform: `rotate(${p.rotate}deg)`,
              animation: `confetti-fall ${p.duration}s ease-in ${p.delay}s forwards`,
              borderRadius: "2px",
            }}
          />
        ))}
      </div>

      {/* Floating emoji reactions */}
      <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
        {floatingEmojis.map((f) => (
          <div
            key={f.id}
            style={{
              position: "absolute",
              left: `${f.left}%`,
              bottom: "120px",
              fontSize: "32px",
              animation: "float-up 1.8s ease-out forwards",
            }}
          >
            {f.emoji}
          </div>
        ))}
      </div>

      <div className="w-full max-w-[360px] animate-fade-in-up">

        <div className="flex items-center justify-between mb-4">
          <button onClick={exitRoom} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-xl transition-all">
            <IconArrowLeft className="w-6 h-6" />
          </button>

          {mode === "online" ? (
            <button
              onClick={copyRoomCode}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-full shadow-sm hover:border-indigo-300 hover:bg-indigo-50 transition-all group"
            >
              <span className="font-mono font-bold text-slate-600 tracking-wider">{roomId}</span>
              {copied ? <IconCheck className="w-4 h-4 text-green-500" /> : <IconCopy className="w-4 h-4 text-slate-400 group-hover:text-indigo-500" />}
            </button>
          ) : (
            <span className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-100 rounded-full text-emerald-600 font-bold text-sm">
              <IconRobot className="w-4 h-4" /> โหมดเล่นกับบอท
            </span>
          )}

          <div className="flex items-center gap-1">
            <button
              onClick={() => setSoundOn((s) => !s)}
              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
              title={soundOn ? "ปิดเสียง" : "เปิดเสียง"}
            >
              {soundOn ? <IconVolume2 className="w-5 h-5" /> : <IconVolumeX className="w-5 h-5" />}
            </button>
            <button onClick={resetGame} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
              <IconRotateCcw className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Scoreboard */}
        <div className="flex items-center justify-between mb-4 bg-white border border-slate-100 rounded-2xl px-4 py-3 shadow-sm">
          <div className="flex items-center gap-4 text-sm">
            <span className="font-bold text-indigo-600">X <span className="text-slate-800">{score.X}</span></span>
            <span className="font-bold text-slate-400">เสมอ <span className="text-slate-700">{score.draw}</span></span>
            <span className="font-bold text-rose-600">O <span className="text-slate-800">{score.O}</span></span>
          </div>
          <button onClick={resetScore} className="text-xs text-slate-400 hover:text-slate-700 underline">
            ล้างคะแนน
          </button>
        </div>

        {loadError && (
          <p className="text-xs text-rose-500 text-center bg-rose-50 border border-rose-100 rounded-lg px-3 py-2 mb-4">
            {loadError}
          </p>
        )}

        <div className={`mb-6 p-4 rounded-2xl border-2 shadow-sm text-center transition-colors duration-300 ${getStatusColors()}`}>
          <p className="text-xs font-bold uppercase tracking-widest opacity-60 mb-1">{statusLabel}</p>
          <p className="text-3xl font-black">{statusValue}</p>
        </div>

        <div className="grid grid-cols-3 gap-3 aspect-square mb-6">
          {board.map((cell, i) => {
            const isWinCell = winLine.includes(i);
            const isX = cell === "X";
            const isO = cell === "O";

            let cellStyle = "bg-slate-200 border-2 border-slate-300 shadow-sm";
            if (isX) cellStyle = "bg-indigo-50 border-indigo-200 text-indigo-500";
            if (isO) cellStyle = "bg-rose-50 border-rose-200 text-rose-500";
            if (isWinCell && isX) cellStyle = "bg-indigo-500 border-indigo-600 text-white shadow-lg shadow-indigo-200 z-10 scale-105";
            if (isWinCell && isO) cellStyle = "bg-rose-500 border-rose-600 text-white shadow-lg shadow-rose-200 z-10 scale-105";

            return (
              <button
                key={i}
                onClick={() => play(i)}
                disabled={!!cell || !!winner || (mode === "bot" && turn !== "X")}
                className={`
                  relative flex items-center justify-center rounded-2xl text-6xl font-black
                  transition-all duration-200
                  ${!cell && !winner ? "hover:bg-slate-300 hover:border-slate-400 hover:scale-[1.03] active:scale-[0.97] cursor-pointer" : "cursor-default"}
                  ${cellStyle}
                `}
              >
                {cell && (
                  <span className={`animate-pop ${isWinCell ? "drop-shadow-md" : ""}`}>
                    {cell}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Emoji reactions */}
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