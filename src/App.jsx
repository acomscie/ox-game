import React, { useState, useEffect } from "react";
import { supabase } from "./supabase";
import { Capacitor } from '@capacitor/core';
import { AdMob } from '@capacitor-community/admob';
import TicTacToe from "./games/TicTacToe";
import ConnectFour from "./games/ConnectFour";
import RockPaperScissors from "./games/RockPaperScissors";
import Hangman from "./games/Hangman";
import WordGuess from "./games/WordGuess";
import MemoryMatch from "./games/MemoryMatch";
import { IconSparkles, IconRobot, IconGamepad, IconCircle, IconHandRock, IconType, IconLayoutGrid } from "./components/Icons";

function useTailwindReady() {
  const [ready, setReady] = useState(
    typeof window !== "undefined" && window.__tailwindLoaded === true
  );

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      AdMob.initialize({
        initializeForTesting: true,
      }).catch(err => console.log('AdMob Init Error', err));
    }

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
  { id: "wordguess", name: "Word Guess", icon: <IconType className="w-8 h-8 text-emerald-500" />, desc: "ทายคำศัพท์ 5 ตัวอักษรสไตล์ Wordle", color: "from-emerald-100 to-teal-50", hover: "hover:border-emerald-300 hover:shadow-emerald-200" },
  { id: "memory", name: "Memory Match", icon: <IconLayoutGrid className="w-8 h-8 text-amber-500" />, desc: "เปิดการ์ดจับคู่ภาพ ทดสอบความจำ", color: "from-amber-100 to-yellow-50", hover: "hover:border-amber-300 hover:shadow-amber-200" },
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

  const showSupportAd = async () => {
    if (!Capacitor.isNativePlatform()) {
      alert("คุณสามารถดูโฆษณาเพื่อสนับสนุนเราได้บนแอปพลิเคชันมือถือ (Android/iOS) เท่านั้นครับ! 📱");
      return;
    }
    
    try {
      await AdMob.prepareRewardVideoAd({
        adId: "ca-app-pub-3940256099942544/5224354917", // Test Ad ID for Android Rewarded Video
      });
      await AdMob.showRewardVideoAd();
      alert("ขอบคุณที่สนับสนุนนักพัฒนาครับ! 🙏🎉");
    } catch (e) {
      alert("ขออภัย ไม่สามารถโหลดโฆษณาได้ในขณะนี้ครับ");
      console.error(e);
    }
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
      <div className="min-h-screen animated-bg flex flex-col items-center py-12 px-6 font-sans text-slate-100">
        
        <style>{`
          @keyframes fade-in-up {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-fade-in-up { animation: fade-in-up 0.5s ease-out forwards; }
        `}</style>

        <div className="mb-10 text-center animate-fade-in-up relative">
          <div className="absolute -top-20 -left-20 w-64 h-64 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30"></div>
          <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30"></div>
          
          <div className="inline-flex items-center justify-center p-4 glass-dark rounded-3xl shadow-xl mb-4 neon-border relative z-10">
            <IconGamepad className="w-12 h-12 text-indigo-400" />
          </div>
          <h1 className="text-5xl sm:text-6xl font-black neon-text tracking-tight mb-2 relative z-10">
            Game Hub
          </h1>
          <p className="text-indigo-200 font-medium relative z-10 text-lg">ศูนย์รวมมินิเกม เล่นสนุกกับเพื่อนได้ทันที</p>
        </div>

        <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
          
          {/* Left Column: Select Game */}
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-bold text-indigo-200 ml-2 neon-text text-left">1. เลือกเกมที่อยากเล่น</h2>
            <div className="flex flex-col gap-3">
              {GAMES.map((game) => (
                <button
                  key={game.id}
                  onClick={() => setSelectedGame(game.id)}
                  className={`btn-arcade flex items-center gap-4 p-4 rounded-3xl transition-all duration-300 text-left border-2
                    ${selectedGame === game.id 
                      ? `glass border-indigo-400 shadow-lg ring-4 ring-indigo-500/50 scale-[1.02]` 
                      : `glass-dark border-transparent hover:border-indigo-500/30 hover:scale-[1.01]`
                    }
                  `}
                >
                  <div className={`p-4 rounded-2xl ${selectedGame === game.id ? 'bg-indigo-500 text-white' : 'glass-dark text-indigo-300'} shadow-sm`}>
                    {game.icon}
                  </div>
                  <div>
                    <h3 className={`font-bold text-xl ${selectedGame === game.id ? 'text-white' : 'text-slate-200'}`}>{game.name}</h3>
                    <p className="text-sm text-indigo-200/70 font-medium">{game.desc}</p>
                  </div>
                  {selectedGame === game.id && (
                    <div className="ml-auto p-2">
                      <div className="w-4 h-4 rounded-full bg-indigo-400 animate-pulse shadow-[0_0_10px_#818cf8]"></div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Right Column: Play Options */}
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-bold text-indigo-200 ml-2 neon-text text-left">2. เลือกวิธีเล่น</h2>
            <div className="glass-dark rounded-3xl shadow-2xl border border-indigo-500/30 p-8 h-full flex flex-col relative z-10 overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>
              <div className="space-y-6 flex-grow flex flex-col justify-center relative z-10">
                
                {/* Create Room */}
                <div>
                  <button
                    onClick={createRoom}
                    className="btn-arcade w-full py-4 rounded-2xl font-bold text-white bg-indigo-600 hover:bg-indigo-500 border border-indigo-400/50 flex items-center justify-center gap-2 text-lg shadow-[0_0_15px_rgba(79,70,229,0.5)]"
                  >
                    <IconSparkles className="w-6 h-6" /> สร้างห้องใหม่
                  </button>
                  <p className="text-center text-xs text-indigo-300 mt-3 font-medium">สร้างห้องแล้วส่งรหัสให้เพื่อน</p>
                </div>

                <div className="relative flex items-center py-2">
                  <div className="flex-grow border-t border-indigo-500/30"></div>
                  <span className="flex-shrink-0 mx-4 text-xs text-indigo-400 font-bold uppercase tracking-widest">หรือ</span>
                  <div className="flex-grow border-t border-indigo-500/30"></div>
                </div>

                {/* Join Room */}
                <div className="glass-dark p-4 rounded-2xl border border-indigo-500/30">
                  <label className="text-xs font-bold tracking-wider text-indigo-300 uppercase mb-3 block text-center">
                    เข้าร่วมห้องที่มีอยู่
                  </label>
                  <div className="flex gap-2">
                    <input
                      className="w-full px-4 py-3 text-center text-lg font-bold tracking-widest uppercase border border-indigo-500/50 rounded-xl bg-slate-900/50 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/50 transition-all"
                      value={inputRoom}
                      onChange={(e) => setInputRoom(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && joinRoom()}
                      placeholder="รหัส 6 หลัก"
                      maxLength={6}
                    />
                    <button
                      onClick={joinRoom}
                      disabled={!inputRoom.trim()}
                      className="btn-arcade px-6 rounded-xl font-bold text-white bg-slate-700 hover:bg-slate-600 disabled:opacity-50 transition-all border border-slate-600"
                    >
                      ลุย!
                    </button>
                  </div>
                </div>

                <div className="relative flex items-center py-2">
                  <div className="flex-grow border-t border-indigo-500/30"></div>
                  <span className="flex-shrink-0 mx-4 text-xs text-indigo-400 font-bold uppercase tracking-widest">หรือ</span>
                  <div className="flex-grow border-t border-indigo-500/30"></div>
                </div>

                {/* Play with Bot */}
                <button
                  onClick={playWithBot}
                  className="btn-arcade w-full py-4 rounded-2xl font-bold text-white bg-emerald-600 hover:bg-emerald-500 border border-emerald-400/50 transition-all flex items-center justify-center gap-2 text-lg shadow-[0_0_15px_rgba(16,185,129,0.4)]"
                >
                  <IconRobot className="w-6 h-6" /> เล่นกับบอท (ออฟไลน์)
                </button>

                {loadError && (
                  <p className="text-sm text-rose-400 text-center font-bold glass-dark border border-rose-500/50 rounded-xl px-4 py-3 mt-4 animate-fade-in-up">
                    {loadError}
                  </p>
                )}
              </div>
              
              {/* Ad Support Button */}
              <div className="mt-8 animate-fade-in-up relative z-10" style={{animationDelay: '100ms'}}>
                <button 
                  onClick={showSupportAd}
                  className="btn-arcade w-full py-4 px-6 bg-gradient-to-r from-orange-600 to-pink-600 hover:from-orange-500 hover:to-pink-500 text-white rounded-2xl font-bold transition-all shadow-[0_0_20px_rgba(249,115,22,0.4)] flex items-center justify-center gap-3 border border-orange-400/50"
                >
                  <span className="text-2xl animate-pop">💖</span>
                  <span className="text-lg">สนับสนุนนักพัฒนา (ดูโฆษณา)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: Selected Game ─────────────────────────────────────────
  return (
    <div className="min-h-screen animated-bg flex flex-col items-center py-10 px-4 font-sans text-slate-100 relative overflow-hidden">
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
      {selectedGame === "wordguess" && (
        <WordGuess roomId={roomId} mode={mode} exitRoom={exitRoom} soundOn={soundOn} toggleSound={toggleSound} />
      )}
      {selectedGame === "memory" && (
        <MemoryMatch roomId={roomId} mode={mode} exitRoom={exitRoom} soundOn={soundOn} toggleSound={toggleSound} />
      )}

    </div>
  );
}