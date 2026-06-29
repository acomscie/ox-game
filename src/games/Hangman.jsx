import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabase";
import { IconArrowLeft, IconCopy, IconCheck, IconRotateCcw, IconVolume2, IconVolumeX } from "../components/Icons";
import { playMoveSound, playWinSound, playDrawSound, playTone } from "../utils/audio";
import { fireConfetti, ConfettiContainer } from "../utils/confetti";

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

  // Local input for setter
  const [inputWord, setInputWord] = useState("");
  const [inputHint, setInputHint] = useState("");
  
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
            if (data.state?.game_type === 'hangman') {
              const state = data.state || {};
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
    if (data && data.state?.game_type === 'hangman') {
      const state = data.state || {};
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
        state: { game_type: 'hangman', ...newState }
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
      <div className="w-full max-w-sm animate-fade-in-up flex flex-col items-center justify-center">
        <h2 className="text-xl font-bold text-slate-700 mb-6">เลือกบทบาทของคุณ</h2>
        <div className="flex flex-col gap-4 w-full">
          <button onClick={() => setLocalPlayer("P1")} className="w-full py-6 rounded-3xl bg-indigo-50 border-2 border-indigo-100 hover:bg-indigo-100 text-indigo-700 font-bold text-xl transition-transform active:scale-95 text-left px-6">
            P1: คนตั้งโจทย์ (Setter)
            <p className="text-sm text-indigo-400 font-medium mt-1">พิมพ์คำศัพท์ให้เพื่อนทาย</p>
          </button>
          <button onClick={() => setLocalPlayer("P2")} className="w-full py-6 rounded-3xl bg-emerald-50 border-2 border-emerald-100 hover:bg-emerald-100 text-emerald-700 font-bold text-xl transition-transform active:scale-95 text-left px-6">
            P2: คนทาย (Guesser)
            <p className="text-sm text-emerald-400 font-medium mt-1">สุ่มเลือกตัวอักษรเพื่อทายคำ</p>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md animate-fade-in-up relative">
      <ConfettiContainer confetti={confetti} />
      
      <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
        {floatingEmojis.map((f) => (
          <div key={f.id} style={{ position: "absolute", left: `${f.left}%`, bottom: "120px", fontSize: "32px", animation: "float-up 1.8s ease-out forwards" }}>{f.emoji}</div>
        ))}
      </div>

      {/* Header */}
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
          {localPlayer === "P1" || mode === "bot" ? (
            <button onClick={resetGame} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
              <IconRotateCcw className="w-6 h-6" />
            </button>
          ) : (
            <div className="w-10"></div>
          )}
        </div>
      </div>

      {/* Scoreboard */}
      <div className="flex items-center justify-between mb-6 bg-white/80 backdrop-blur-sm border border-slate-100 rounded-2xl px-4 py-3 shadow-sm">
        <div className="flex items-center gap-4 text-sm w-full justify-between px-2">
          <span className="font-bold text-indigo-600 flex flex-col items-center">
            <span className="text-xs text-slate-400">P1 (ตั้งโจทย์)</span>
            <span className="text-xl text-slate-800">{score.P1}</span>
          </span>
          <span className="font-bold text-emerald-600 flex flex-col items-center">
            <span className="text-xs text-slate-400">P2 (ทาย)</span>
            <span className="text-xl text-slate-800">{score.P2}</span>
          </span>
        </div>
      </div>

      {status === "setup" && (
        <div className="bg-white p-6 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 animate-fade-in-up">
          {localPlayer === "P1" ? (
            <div className="flex flex-col gap-4">
              <h3 className="font-bold text-slate-700 text-center">พิมพ์คำศัพท์ภาษาอังกฤษให้อีกฝ่ายทาย</h3>
              <input 
                type="text" 
                value={inputWord}
                onChange={(e) => setInputWord(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
                className="w-full text-center text-3xl font-black py-4 border-b-2 border-slate-200 focus:outline-none focus:border-indigo-500 tracking-widest text-indigo-600 uppercase"
                placeholder="WORD"
                maxLength={12}
              />
              <input 
                type="text" 
                value={inputHint}
                onChange={(e) => setInputHint(e.target.value)}
                className="w-full text-center text-lg py-3 border-b-2 border-slate-200 focus:outline-none focus:border-indigo-500 text-slate-600"
                placeholder="คำใบ้ (ไม่บังคับ)"
                maxLength={40}
              />
              <button 
                onClick={() => startGame(inputWord, inputHint)}
                disabled={inputWord.length < 2}
                className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-md"
              >
                เริ่มเกม!
              </button>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4"></div>
              <h3 className="font-bold text-slate-500">รอ P1 ตั้งคำศัพท์...</h3>
            </div>
          )}
        </div>
      )}

      {(status === "playing" || status === "finished") && (
        <div className="flex flex-col gap-6 animate-fade-in-up">
          
          {hint && (
            <div className="bg-indigo-50 border border-indigo-100 text-indigo-700 p-3 rounded-2xl text-center text-sm sm:text-base font-medium shadow-sm">
              💡 <span className="opacity-80">คำใบ้:</span> {hint}
            </div>
          )}

          {/* Hangman Drawing */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex justify-center items-center h-48 relative">
            <svg viewBox="0 0 200 200" className="w-40 h-40 stroke-slate-800" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round">
              {/* Scaffold */}
              <line x1="20" y1="180" x2="100" y2="180" />
              <line x1="60" y1="180" x2="60" y2="20" />
              <line x1="60" y1="20" x2="140" y2="20" />
              <line x1="140" y1="20" x2="140" y2="40" />
              
              {/* Parts */}
              {wrongGuesses >= 1 && <circle cx="140" cy="60" r="20" />}
              {wrongGuesses >= 2 && <line x1="140" y1="80" x2="140" y2="130" />}
              {wrongGuesses >= 3 && <line x1="140" y1="90" x2="110" y2="110" />}
              {wrongGuesses >= 4 && <line x1="140" y1="90" x2="170" y2="110" />}
              {wrongGuesses >= 5 && <line x1="140" y1="130" x2="115" y2="160" />}
              {wrongGuesses >= 6 && <line x1="140" y1="130" x2="165" y2="160" />}
              
              {status === "finished" && winner === "P1" && (
                <g className="stroke-rose-500 animate-pulse">
                  <line x1="130" y1="55" x2="135" y2="60" /><line x1="135" y1="55" x2="130" y2="60" />
                  <line x1="145" y1="55" x2="150" y2="60" /><line x1="150" y1="55" x2="145" y2="60" />
                </g>
              )}
            </svg>
            
            <div className="absolute top-4 right-4 bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-xs font-bold">
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
                  ${isRevealed ? "border-slate-800 text-slate-800" : "border-slate-300"}
                  ${isMissed ? "text-rose-500" : ""}
                `}>
                  {isRevealed ? letter : ""}
                </div>
              );
            })}
          </div>

          {status === "finished" && (
            <div className="text-center bg-slate-50 p-4 rounded-2xl border border-slate-100 animate-pop">
              <h2 className={`text-2xl font-black ${winner === localPlayer || (mode === "bot" && winner === "P2") ? "text-emerald-500" : "text-rose-500"}`}>
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
              
              let style = "bg-white border-2 border-slate-200 text-slate-600 hover:bg-indigo-50 hover:border-indigo-300 active:scale-95";
              if (isCorrect) style = "bg-emerald-500 border-emerald-600 text-white shadow-inner pointer-events-none";
              if (isWrong) style = "bg-slate-300 border-slate-400 text-slate-500 opacity-50 pointer-events-none";
              if (status === "finished") style += " pointer-events-none";

              return (
                <button
                  key={letter}
                  onClick={() => handleGuess(letter)}
                  className={`w-9 h-12 sm:w-10 sm:h-14 rounded-lg font-bold text-lg sm:text-xl flex items-center justify-center transition-all ${style}`}
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
          <button key={emoji} onClick={() => sendEmoji(emoji)} className="text-2xl bg-white border border-slate-100 rounded-xl w-10 h-10 flex items-center justify-center hover:bg-slate-50 hover:scale-110 active:scale-95 transition-all shadow-sm">
            {emoji}
          </button>
        ))}
      </div>

    </div>
  );
}
