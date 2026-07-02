import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabase";
import { IconArrowLeft, IconCopy, IconCheck, IconRotateCcw, IconVolume2, IconVolumeX, IconLightbulb } from "../components/Icons";
import { playMoveSound, playWinSound, playDrawSound, playTone } from "../utils/audio";
import { fireConfetti, ConfettiContainer } from "../utils/confetti";
import { Capacitor } from '@capacitor/core';
import { AdMob, RewardAdPluginEvents } from '@capacitor-community/admob';

const MAX_ERRORS = 6;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const BOT_WORDS = [
  { word: "REACT", hint: "Library สร้าง UI ยอดนิยมจาก Facebook" },
  { word: "SUPABASE", hint: "Backend-as-a-Service ทางเลือกแทน Firebase" },
  { word: "JAVASCRIPT", hint: "ภาษาโปรแกรมที่ทำงานบนเบราว์เซอร์" },
  { word: "TAILWIND", hint: "Utility-first CSS framework" },
  { word: "GAMING", hint: "กิจกรรมเพื่อความบันเทิง เล่นกับเพื่อน" },
  { word: "FRONTEND", hint: "ส่วนหน้าของเว็บไซต์ที่ผู้ใช้มองเห็น" },
  { word: "DEVELOPER", hint: "ผู้พัฒนาซอฟต์แวร์หรือเว็บไซต์" },
  { word: "HANGMAN", hint: "ชื่อของเกมทายคำศัพท์ที่มีรูปคนแขวนคอ" },
  { word: "ONLINE", hint: "สถานะเชื่อมต่ออินเทอร์เน็ต" },
  { word: "MULTIPLAYER", hint: "เกมที่เล่นได้หลายคนพร้อมกัน" }
];

const REACTIONS = ["😀", "😂", "🔥", "😱", "👏", "😢"];

export default function Hangman({ roomId, mode, exitRoom, soundOn, toggleSound }) {
  const [localPlayer, setLocalPlayer] = useState(mode === "bot" ? "P2" : null); // In bot mode, you are always the guesser (P2)
  
  // Game State
  const [word, setWord] = useState("");
  const [hint, setHint] = useState("");
  const [guesses, setGuesses] = useState([]);
  const [status, setStatus] = useState("setup"); // setup, playing, finished
  const [winner, setWinner] = useState(null); // P1, P2
  const [score, setScore] = useState({ P1: 0, P2: 0 }); // P1 = Setter, P2 = Guesser

  const [inputWord, setInputWord] = useState("");
  const [inputHint, setInputHint] = useState("");
  
  const [isAdLoading, setIsAdLoading] = useState(false);
  
  const [confetti, setConfetti] = useState([]);
  const [floatingEmojis, setFloatingEmojis] = useState([]);
  const [copied, setCopied] = useState(false);
  const channelRef = useRef(null);
  const prevStatusRef = useRef("setup");
  const prevGuessesCountRef = useRef(0);

  // Derived state
  const wrongGuesses = guesses.filter(g => !word.includes(g)).length;
  const isWon = word.length > 0 && word.split("").every(l => guesses.includes(l));
  const isLost = wrongGuesses >= MAX_ERRORS;

  useEffect(() => {
    // Check win/loss on guesses update
    if (status === "playing") {
      if (isWon) {
        setStatus("finished");
        setWinner("P2"); // Guesser wins
      } else if (isLost) {
        setStatus("finished");
        setWinner("P1"); // Setter wins
      }
    }
  }, [guesses, word, status, isWon, isLost]);

  useEffect(() => {
    if (status === "finished" && prevStatusRef.current !== "finished") {
      if (winner === "P2") {
        playWinSound(soundOn);
        fireConfetti(setConfetti);
      } else {
        // Lose sound
        playDrawSound(soundOn); // Just use draw sound for loss
      }
      setScore(s => ({ ...s, [winner]: s[winner] + 1 }));
    }
    prevStatusRef.current = status;
  }, [status, winner, soundOn]);

  useEffect(() => {
    if (guesses.length > prevGuessesCountRef.current) {
      const lastGuess = guesses[guesses.length - 1];
      if (word.includes(lastGuess)) {
        playMoveSound("X", soundOn); // Good sound
      } else {
        playTone(200, 0.1, "sawtooth", 0, soundOn); // Bad sound
      }
    }
    prevGuessesCountRef.current = guesses.length;
  }, [guesses, word, soundOn]);

  // Network sync
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
            if (data.board?.game_type === 'hangman') {
              const state = data.board || {};
              setWord(state.word || "");
              setHint(state.hint || "");
              setGuesses(state.guesses || []);
              setStatus(state.status || "setup");
              setWinner(state.winner || null);
            }
          }
        }
      )
      .on("broadcast", { event: "emoji" }, ({ payload }) => {
        showFloatingEmoji(payload.emoji);
      })
      .subscribe();

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, mode]);

  async function loadGame() {
    const { data } = await supabase.from("games").select("*").eq("id", roomId).single();
    if (data && data.board?.game_type === 'hangman') {
      const state = data.board || {};
      setWord(state.word || "");
      setHint(state.hint || "");
      setGuesses(state.guesses || []);
      setStatus(state.status || "setup");
      setWinner(state.winner || null);
    }
  }

  const syncState = async (newState) => {
    if (mode === "online") {
      await supabase.from("games").upsert({
        id: roomId,
        board: { game_type: 'hangman', ...newState }
      });
    }
  };

  const startGame = (w, h = "") => {
    const newWord = w.toUpperCase().replace(/[^A-Z]/g, "");
    if (!newWord) return;
    
    setWord(newWord);
    setHint(h);
    setGuesses([]);
    setStatus("playing");
    setWinner(null);

    syncState({ word: newWord, hint: h, guesses: [], status: "playing", winner: null });
  };

  const handleGuess = (letter) => {
    if (status !== "playing") return;
    if (guesses.includes(letter)) return;
    if (mode === "online" && localPlayer !== "P2") return; // Only guesser can guess

    const nextGuesses = [...guesses, letter];
    setGuesses(nextGuesses);

    // Compute win/loss for immediate local response
    const wrong = nextGuesses.filter(g => !word.includes(g)).length;
    const won = word.split("").every(l => nextGuesses.includes(l));
    let nextStatus = "playing";
    let nextWinner = null;
    
    if (won) {
      nextStatus = "finished";
      nextWinner = "P2";
    } else if (wrong >= MAX_ERRORS) {
      nextStatus = "finished";
      nextWinner = "P1";
    }
    
    if (won || wrong >= MAX_ERRORS) {
      setStatus(nextStatus);
      setWinner(nextWinner);
    }

    syncState({ word, hint, guesses: nextGuesses, status: nextStatus, winner: nextWinner });
  };

  const resetGame = () => {
    if (mode === "bot") {
      // Bot picks new word
      const randomData = BOT_WORDS[Math.floor(Math.random() * BOT_WORDS.length)];
      startGame(randomData.word, randomData.hint);
    } else {
      setWord("");
      setHint("");
      setGuesses([]);
      setStatus("setup");
      setWinner(null);
      setInputWord("");
      setInputHint("");
      syncState({ word: "", hint: "", guesses: [], status: "setup", winner: null });
    }
  };

  const getAdHint = async () => {
    if (!Capacitor.isNativePlatform()) {
      alert("คำใบ้พิเศษมีเฉพาะบนแอปพลิเคชันมือถือครับ! 📱");
      return;
    }
    
    if (isAdLoading) return;
    setIsAdLoading(true);

    try {
      await AdMob.prepareRewardVideoAd({
        adId: "ca-app-pub-3940256099942544/5224354917", // Test Ad ID
      });
      
      const listener = await AdMob.addListener(RewardAdPluginEvents.Rewarded, () => {
         // Reward user by revealing first letter
         if (word && !guesses.includes(word[0])) {
           handleGuess(word[0]);
         } else {
           alert("คำใบ้เพิ่มเติม: คำนี้มีตัวอักษร " + word[word.length - 1]);
         }
      });

      await AdMob.showRewardVideoAd();
      
      // Cleanup listener after showing
      setTimeout(() => {
        listener.remove();
      }, 5000);
      
    } catch(e) {
      alert("ไม่สามารถโหลดโฆษณาได้ ลองใหม่อีกครั้งครับ");
      console.error(e);
    } finally {
      setIsAdLoading(false);
    }
  };

  // Run once for bot
  useEffect(() => {
    if (mode === "bot" && status === "setup") {
      resetGame();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, status]);

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

  // --- Seat Selection ---
  if (!localPlayer && mode === "online") {
    return (
      <div className="w-full max-w-sm md:max-w-md animate-fade-in-up flex flex-col items-center justify-center">
        <h2 className="text-2xl font-bold text-white mb-6 neon-text">เลือกบทบาทของคุณ</h2>
        <div className="flex flex-col gap-4 w-full">
          <button onClick={() => setLocalPlayer("P1")} className="btn-arcade w-full py-6 rounded-3xl glass border border-indigo-500/50 hover:bg-indigo-600/30 text-indigo-300 font-bold text-xl transition-all shadow-[0_0_15px_rgba(99,102,241,0.2)] text-left px-6">
            P1: คนตั้งโจทย์ (Setter)
            <p className="text-sm text-indigo-400 font-medium mt-1">พิมพ์คำศัพท์ให้เพื่อนทาย</p>
          </button>
          <button onClick={() => setLocalPlayer("P2")} className="btn-arcade w-full py-6 rounded-3xl glass border border-emerald-500/50 hover:bg-emerald-600/30 text-emerald-300 font-bold text-xl transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)] text-left px-6">
            P2: คนทาย (Guesser)
            <p className="text-sm text-emerald-400 font-medium mt-1">สุ่มเลือกตัวอักษรเพื่อทายคำ</p>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md md:max-w-xl lg:max-w-2xl animate-fade-in-up relative">
      <ConfettiContainer confetti={confetti} />
      
      <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
        {floatingEmojis.map((f) => (
          <div key={f.id} style={{ position: "absolute", left: `${f.left}%`, bottom: "120px", fontSize: "32px", animation: "float-up 1.8s ease-out forwards" }}>{f.emoji}</div>
        ))}
      </div>

      {/* Header */}
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
          {localPlayer === "P1" || mode === "bot" ? (
            <button onClick={resetGame} className="btn-arcade p-2 text-indigo-300 hover:text-white glass-dark hover:bg-indigo-600/50 border border-indigo-500/30 rounded-xl transition-all">
              <IconRotateCcw className="w-6 h-6" />
            </button>
          ) : (
            <div className="w-10"></div>
          )}
        </div>
      </div>

      {/* Scoreboard */}
      <div className="flex items-center justify-between mb-6 glass-dark border border-indigo-500/30 rounded-2xl px-4 py-3 shadow-lg">
        <div className="flex items-center gap-4 text-sm w-full justify-between px-2">
          <span className="font-bold text-indigo-400 flex flex-col items-center">
            <span className="text-xs text-indigo-300/70">P1 (ตั้งโจทย์)</span>
            <span className="text-xl text-white neon-text-x">{score.P1}</span>
          </span>
          <span className="font-bold text-emerald-400 flex flex-col items-center">
            <span className="text-xs text-emerald-300/70">P2 (ทาย)</span>
            <span className="text-xl text-white drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]">{score.P2}</span>
          </span>
        </div>
      </div>

      {status === "setup" && (
        <div className="glass-dark p-6 rounded-3xl shadow-[0_0_20px_rgba(0,0,0,0.3)] border border-indigo-500/20 animate-fade-in-up">
          {localPlayer === "P1" ? (
            <div className="flex flex-col gap-4">
              <h3 className="font-bold text-indigo-300 text-center uppercase tracking-widest text-sm">พิมพ์คำศัพท์ภาษาอังกฤษให้อีกฝ่ายทาย</h3>
              <input 
                type="text" 
                value={inputWord}
                onChange={(e) => setInputWord(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
                className="w-full text-center text-3xl font-black py-4 border-b-2 border-indigo-500/30 bg-transparent text-white focus:outline-none focus:border-indigo-400 tracking-widest uppercase transition-colors"
                placeholder="WORD"
                maxLength={12}
              />
              <input 
                type="text" 
                value={inputHint}
                onChange={(e) => setInputHint(e.target.value)}
                className="w-full text-center text-lg py-3 border-b-2 border-indigo-500/30 bg-transparent text-indigo-200 focus:outline-none focus:border-indigo-400 transition-colors"
                placeholder="คำใบ้ (ไม่บังคับ)"
                maxLength={40}
              />
              <button 
                onClick={() => startGame(inputWord, inputHint)}
                disabled={inputWord.length < 2}
                className="btn-arcade w-full py-4 mt-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-500 disabled:opacity-50 transition-all shadow-[0_0_15px_rgba(99,102,241,0.4)]"
              >
                เริ่มเกม!
              </button>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-10 h-10 border-4 border-emerald-500/30 border-t-emerald-400 rounded-full animate-spin mx-auto mb-4"></div>
              <h3 className="font-bold text-emerald-300/80 animate-pulse">รอ P1 ตั้งคำศัพท์...</h3>
            </div>
          )}
        </div>
      )}

      {(status === "playing" || status === "finished") && (
        <div className="flex flex-col gap-6 animate-fade-in-up">
          
          <div className="flex justify-between items-center gap-2">
            {hint ? (
              <div className="glass border border-indigo-400/30 text-indigo-200 p-3 rounded-2xl text-center text-sm sm:text-base font-medium shadow-[0_0_10px_rgba(99,102,241,0.2)] flex-1">
                💡 <span className="opacity-80">คำใบ้:</span> {hint}
              </div>
            ) : <div className="flex-1"></div>}

            {status === "playing" && localPlayer === "P2" && Capacitor.isNativePlatform() && (
              <button 
                onClick={getAdHint}
                disabled={isAdLoading}
                className="btn-arcade shrink-0 bg-amber-500/20 text-amber-300 border border-amber-400/50 hover:bg-amber-500/40 py-2 px-4 rounded-xl font-bold text-sm transition-all shadow-[0_0_10px_rgba(251,191,36,0.3)] flex items-center gap-2 disabled:opacity-50"
              >
                🎁 {isAdLoading ? "กำลังโหลด..." : "ขอตัวช่วย (ดูโฆษณา)"}
              </button>
            )}
          </div>

          {/* Hangman Drawing */}
          <div className="glass-dark rounded-3xl p-6 shadow-sm border border-indigo-500/20 flex justify-center items-center h-48 relative overflow-hidden">
            <svg viewBox="0 0 200 200" className="w-40 h-40 stroke-indigo-400 drop-shadow-[0_0_5px_rgba(99,102,241,0.8)]" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round">
              {/* Scaffold */}
              <line x1="20" y1="180" x2="100" y2="180" className="animate-draw" />
              <line x1="60" y1="180" x2="60" y2="20" className="animate-draw" />
              <line x1="60" y1="20" x2="140" y2="20" className="animate-draw" />
              <line x1="140" y1="20" x2="140" y2="40" className="animate-draw" />
              
              {/* Parts */}
              {wrongGuesses >= 1 && <circle cx="140" cy="60" r="20" className="stroke-pink-400 drop-shadow-[0_0_8px_rgba(244,114,182,0.8)] animate-draw" />}
              {wrongGuesses >= 2 && <line x1="140" y1="80" x2="140" y2="130" className="stroke-pink-400 drop-shadow-[0_0_8px_rgba(244,114,182,0.8)] animate-draw" />}
              {wrongGuesses >= 3 && <line x1="140" y1="90" x2="110" y2="110" className="stroke-pink-400 drop-shadow-[0_0_8px_rgba(244,114,182,0.8)] animate-draw" />}
              {wrongGuesses >= 4 && <line x1="140" y1="90" x2="170" y2="110" className="stroke-pink-400 drop-shadow-[0_0_8px_rgba(244,114,182,0.8)] animate-draw" />}
              {wrongGuesses >= 5 && <line x1="140" y1="130" x2="115" y2="160" className="stroke-pink-400 drop-shadow-[0_0_8px_rgba(244,114,182,0.8)] animate-draw" />}
              {wrongGuesses >= 6 && <line x1="140" y1="130" x2="165" y2="160" className="stroke-pink-400 drop-shadow-[0_0_8px_rgba(244,114,182,0.8)] animate-draw" />}
              
              {status === "finished" && winner === "P1" && (
                <g className="stroke-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,1)] animate-pulse">
                  <line x1="130" y1="55" x2="135" y2="60" /><line x1="135" y1="55" x2="130" y2="60" />
                  <line x1="145" y1="55" x2="150" y2="60" /><line x1="150" y1="55" x2="145" y2="60" />
                </g>
              )}
            </svg>
            
            <div className="absolute top-4 right-4 glass text-indigo-300 border border-indigo-500/30 px-3 py-1 rounded-full text-xs font-bold">
              ผิดได้อีก {MAX_ERRORS - wrongGuesses} ครั้ง
            </div>
          </div>

          {/* Word Display */}
          <div className="flex flex-wrap justify-center gap-2">
            {word.split("").map((letter, i) => {
              const isRevealed = guesses.includes(letter) || status === "finished";
              const isMissed = status === "finished" && winner === "P1" && !guesses.includes(letter);
              return (
                <div key={i} className={`w-10 h-12 flex items-center justify-center text-2xl font-black border-b-4 
                  ${isRevealed ? "border-indigo-400 text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]" : "border-indigo-900/50"}
                  ${isMissed ? "text-pink-500 drop-shadow-[0_0_8px_rgba(244,114,182,0.8)] border-pink-500/50" : ""}
                `}>
                  {isRevealed ? <span className="animate-pop">{letter}</span> : ""}
                </div>
              );
            })}
          </div>

          {status === "finished" && (
            <div className="text-center glass border border-indigo-500/30 p-4 rounded-2xl animate-pop shadow-[0_0_20px_rgba(0,0,0,0.3)]">
              <h2 className={`text-2xl font-black drop-shadow-[0_0_10px_currentColor] ${winner === localPlayer || (mode === "bot" && winner === "P2") ? "text-emerald-400" : "text-pink-500"}`}>
                {winner === localPlayer || (mode === "bot" && winner === "P2") ? "คุณชนะ! 🎉" : "คุณแพ้! 😢"}
              </h2>
            </div>
          )}

          {/* Keyboard (Only active for P2 / Guesser in playing status) */}
          <div className={`flex flex-wrap justify-center gap-1.5 ${(localPlayer === "P1" && mode !== "bot") ? "opacity-50 pointer-events-none" : ""}`}>
            {ALPHABET.map((letter) => {
              const isGuessed = guesses.includes(letter);
              const isCorrect = isGuessed && word.includes(letter);
              const isWrong = isGuessed && !word.includes(letter);
              
              let style = "glass border border-indigo-500/20 text-indigo-200 hover:bg-white/10 hover:border-indigo-400/50 active:scale-95";
              if (isCorrect) style = "glass bg-emerald-500/40 border-emerald-400 text-white shadow-[0_0_15px_rgba(16,185,129,0.5)] pointer-events-none";
              if (isWrong) style = "glass bg-slate-800/60 border-slate-700/50 text-slate-500 opacity-40 pointer-events-none grayscale";
              if (status === "finished") style += " pointer-events-none";

              return (
                <button
                  key={letter}
                  onClick={() => handleGuess(letter)}
                  className={`btn-arcade w-9 h-12 sm:w-10 sm:h-14 rounded-lg font-bold text-lg sm:text-xl flex items-center justify-center transition-all ${style}`}
                >
                  {letter}
                </button>
              );
            })}
          </div>

        </div>
      )}

      {/* Emoji Reactions */}
      <div className="flex items-center justify-center gap-2 mt-8 mb-6">
        {REACTIONS.map((emoji) => (
          <button key={emoji} onClick={() => sendEmoji(emoji)} className="btn-arcade text-2xl glass-dark border border-indigo-500/30 rounded-xl w-12 h-12 flex items-center justify-center hover:bg-white/10 hover:border-indigo-400/50 transition-all shadow-sm">
            {emoji}
          </button>
        ))}
      </div>

    </div>
  );
}
