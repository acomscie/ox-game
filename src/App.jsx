import React, { useState, useEffect } from "react";
import { supabase } from "./supabase";
import TicTacToe from "./games/TicTacToe";
import ConnectFour from "./games/ConnectFour";
import RockPaperScissors from "./games/RockPaperScissors";
import Hangman from "./games/Hangman";
import { IconSparkles, IconRobot, IconGamepad, IconCircle, IconHandRock, IconType } from "./components/Icons";

function useTailwindReady() {
  const [ready, setReady] = useState(
    typeof window !== "undefined" && window.__tailwindLoaded === true
  );

  useEffect(() => {
    if (ready) return;
    if (typeof document === "undefined") return;

    const existing = document.getElementById("tailwind-cdn");
    if (existing) {
      existing.addEventListener("load", () => {
        window.__tailwindLoaded = true;
        setReady(true);
      });
      if (window.__tailwindLoaded) setReady(true);
      return;
    }

    const script = document.createElement("script");
    script.id = "tailwind-cdn";
    script.src = "https://cdn.tailwindcss.com";
    script.onload = () => {
      window.__tailwindLoaded = true;
      setReady(true);
    };
    document.head.appendChild(script);
  }, [ready]);

  return ready;
}

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

const GAMES = [
  { id: "tictactoe", name: "Tic-Tac-Toe", icon: <IconGamepad className="w-8 h-8 text-indigo-500" />, desc: "เกมโอเอ็กซ์สุดคลาสสิก เล่นง่ายจบไว", color: "from-indigo-100 to-blue-50", hover: "hover:border-indigo-300 hover:shadow-indigo-200" },
  { id: "connectfour", name: "Connect 4", icon: <IconCircle className="w-8 h-8 text-blue-500" />, desc: "หยอดเหรียญให้เรียงติดกัน 4 แถว", color: "from-blue-100 to-cyan-50", hover: "hover:border-blue-300 hover:shadow-blue-200" },
  { id: "rps", name: "เป่ายิ้งฉุบ", icon: <IconHandRock className="w-8 h-8 text-rose-500" />, desc: "วัดดวงและความไว ใครจะชนะ?", color: "from-rose-100 to-orange-50", hover: "hover:border-rose-300 hover:shadow-rose-200" },
  { id: "hangman", name: "Hangman", icon: <IconType className="w-8 h-8 text-cyan-500" />, desc: "ทายคำศัพท์ภาษาอังกฤษ ก่อนที่จะโดนแขวนคอ!", color: "from-cyan-100 to-blue-50", hover: "hover:border-cyan-300 hover:shadow-cyan-200" },
];

export default function App() {
  const tailwindReady = useTailwindReady();
  const [inputRoom, setInputRoom] = useState("");
  const [roomId, setRoomId] = useState("");
  const [joined, setJoined] = useState(false);
  const [mode, setMode] = useState("online"); // "online" | "bot"
  const [loadError, setLoadError] = useState("");
  const [soundOn, setSoundOn] = useState(true);
  
  // Game Hub State
  const [selectedGame, setSelectedGame] = useState("tictactoe");

  const joinRoom = async () => {
    const code = inputRoom.trim().toUpperCase();
    if (code) {
      setLoadError("");
      const { data, error } = await supabase.from("games").select("board").eq("id", code).single();
      if (error || !data) {
        setLoadError("ไม่พบห้องนี้ หรือเกิดข้อผิดพลาดในการโหลดข้อมูล");
        return;
      }
      setSelectedGame(data?.board?.game_type || "tictactoe");
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
      board: { game_type: selectedGame } // specific game will initialize its state
    });
    if (error) {
      console.error("Create room error:", error);
      setLoadError(`สร้างห้องไม่สำเร็จ: ${error.message}`);
    }
  };

  const playWithBot = () => {
    setMode("bot");
    setRoomId("BOT");
    setJoined(true);
  };

  const exitRoom = () => {
    setJoined(false);
    setRoomId("");
    setInputRoom("");
    setMode("online");
    setLoadError("");
  };

  const toggleSound = () => setSoundOn(s => !s);

  if (!tailwindReady) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8f7ff", fontFamily: "sans-serif" }}>
        <div style={{ width: "36px", height: "36px", border: "3px solid #e0e0f0", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── Render: Game Hub Lobby ─────────────────────────────────────────
  if (!joined) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex flex-col items-center py-12 px-6 font-sans selection:bg-indigo-100">
        
        <style>{`
          @keyframes fade-in-up {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-fade-in-up { animation: fade-in-up 0.5s ease-out forwards; }
        `}</style>

        <div className="mb-10 text-center animate-fade-in-up">
          <div className="inline-flex items-center justify-center p-3 bg-white rounded-2xl shadow-xl shadow-indigo-100 mb-4 ring-1 ring-slate-100">
            <IconGamepad className="w-10 h-10 text-indigo-600" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 tracking-tight mb-2">
            Game Hub
          </h1>
          <p className="text-slate-500 font-medium">ศูนย์รวมมินิเกม เล่นสนุกกับเพื่อนได้ทันที</p>
        </div>

        <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
          
          {/* Left Column: Select Game */}
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-bold text-slate-700 ml-2">1. เลือกเกมที่อยากเล่น</h2>
            <div className="flex flex-col gap-3">
              {GAMES.map((game) => (
                <button
                  key={game.id}
                  onClick={() => setSelectedGame(game.id)}
                  className={`flex items-center gap-4 p-4 rounded-3xl transition-all duration-300 text-left border-2
                    ${selectedGame === game.id 
                      ? `bg-gradient-to-r ${game.color} border-transparent shadow-lg scale-[1.02] ring-4 ring-indigo-50` 
                      : `bg-white border-slate-100 ${game.hover} hover:scale-[1.01]`
                    }
                  `}
                >
                  <div className={`p-3 rounded-2xl bg-white shadow-sm ${selectedGame === game.id ? 'shadow-md' : ''}`}>
                    {game.icon}
                  </div>
                  <div>
                    <h3 className={`font-bold text-lg ${selectedGame === game.id ? 'text-slate-800' : 'text-slate-700'}`}>{game.name}</h3>
                    <p className="text-sm text-slate-500 font-medium">{game.desc}</p>
                  </div>
                  {selectedGame === game.id && (
                    <div className="ml-auto p-2">
                      <div className="w-3 h-3 rounded-full bg-indigo-500 animate-pulse"></div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Right Column: Play Options */}
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-bold text-slate-700 ml-2">2. เลือกวิธีเล่น</h2>
            <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 p-8 h-full flex flex-col">
              <div className="space-y-6 flex-grow flex flex-col justify-center">
                
                {/* Create Room */}
                <div>
                  <button
                    onClick={createRoom}
                    className="w-full py-4 rounded-2xl font-bold text-indigo-600 bg-indigo-50 border-2 border-indigo-100 hover:bg-indigo-100 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-lg shadow-sm"
                  >
                    <IconSparkles className="w-6 h-6" /> สร้างห้องใหม่
                  </button>
                  <p className="text-center text-xs text-slate-400 mt-2 font-medium">สร้างห้องแล้วส่งรหัสให้เพื่อน</p>
                </div>

                <div className="relative flex items-center py-2">
                  <div className="flex-grow border-t border-slate-100"></div>
                  <span className="flex-shrink-0 mx-4 text-xs text-slate-400 font-bold uppercase tracking-widest">หรือ</span>
                  <div className="flex-grow border-t border-slate-100"></div>
                </div>

                {/* Join Room */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <label className="text-xs font-bold tracking-wider text-slate-500 uppercase mb-3 block text-center">
                    เข้าร่วมห้องที่มีอยู่
                  </label>
                  <div className="flex gap-2">
                    <input
                      className="w-full px-4 py-3 text-center text-lg font-bold tracking-widest uppercase border-2 border-slate-200 rounded-xl bg-white text-slate-700 placeholder:text-slate-300 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all"
                      value={inputRoom}
                      onChange={(e) => setInputRoom(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && joinRoom()}
                      placeholder="รหัส 6 หลัก"
                      maxLength={6}
                    />
                    <button
                      onClick={joinRoom}
                      disabled={!inputRoom.trim()}
                      className="px-6 rounded-xl font-bold text-white bg-slate-800 hover:bg-slate-900 active:scale-95 disabled:opacity-50 disabled:active:scale-100 transition-all shadow-md"
                    >
                      ลุย!
                    </button>
                  </div>
                </div>

                <div className="relative flex items-center py-2">
                  <div className="flex-grow border-t border-slate-100"></div>
                  <span className="flex-shrink-0 mx-4 text-xs text-slate-400 font-bold uppercase tracking-widest">หรือ</span>
                  <div className="flex-grow border-t border-slate-100"></div>
                </div>

                {/* Play with Bot */}
                <button
                  onClick={playWithBot}
                  className="w-full py-4 rounded-2xl font-bold text-emerald-600 bg-emerald-50 border-2 border-emerald-100 hover:bg-emerald-100 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-lg shadow-sm"
                >
                  <IconRobot className="w-6 h-6" /> เล่นกับบอท (ออฟไลน์)
                </button>

                {loadError && (
                  <p className="text-sm text-rose-500 text-center font-bold bg-rose-50 border border-rose-100 rounded-xl px-4 py-3 mt-4 animate-fade-in-up">
                    {loadError}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: Selected Game ─────────────────────────────────────────
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
        @keyframes float-up {
          0% { transform: translateY(0) scale(0.6); opacity: 0; }
          15% { transform: translateY(-10px) scale(1.2); opacity: 1; }
          100% { transform: translateY(-140px) scale(1); opacity: 0; }
        }
        .animate-pop { animation: pop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        .animate-fade-in-up { animation: fade-in-up 0.4s ease-out forwards; }
      `}</style>

      {selectedGame === "tictactoe" && (
        <TicTacToe roomId={roomId} mode={mode} exitRoom={exitRoom} soundOn={soundOn} toggleSound={toggleSound} />
      )}
      {selectedGame === "connectfour" && (
        <ConnectFour roomId={roomId} mode={mode} exitRoom={exitRoom} soundOn={soundOn} toggleSound={toggleSound} />
      )}
      {selectedGame === "rps" && (
        <RockPaperScissors roomId={roomId} mode={mode} exitRoom={exitRoom} soundOn={soundOn} toggleSound={toggleSound} />
      )}
      {selectedGame === "hangman" && (
        <Hangman roomId={roomId} mode={mode} exitRoom={exitRoom} soundOn={soundOn} toggleSound={toggleSound} />
      )}

    </div>
  );
}