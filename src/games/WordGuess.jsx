import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabase";
import { IconArrowLeft, IconCopy, IconCheck, IconRotateCcw, IconVolume2, IconVolumeX } from "../components/Icons";
import { playMoveSound, playWinSound, playDrawSound, playTone } from "../utils/audio";
import { fireConfetti, ConfettiContainer } from "../utils/confetti";
import { Capacitor } from '@capacitor/core';
import { AdMob, RewardAdPluginEvents } from '@capacitor-community/admob';

const MAX_GUESSES = 6;
const WORD_LENGTH = 5;

const BOT_WORDS = [
  "REACT", "STATE", "PROPS", "HOOKS", "VITES", 
  "BUILD", "INDEX", "TOKEN", "STYLE", "SMART", 
  "GAMES", "PIXEL", "AUDIO", "VIDEO", "MOUSE",
  "BOARD", "SCORE", "CLOUD", "DEBUG", "LOGIC"
];

const KEYBOARD_ROWS = [
  ["Q","W","E","R","T","Y","U","I","O","P"],
  ["A","S","D","F","G","H","J","K","L"],
  ["ENTER","Z","X","C","V","B","N","M","DEL"]
];

const REACTIONS = ["😀", "😂", "🔥", "😱", "👏", "😢"];

export default function WordGuess({ roomId, mode, exitRoom, soundOn, toggleSound }) {
  const [localPlayer, setLocalPlayer] = useState(mode === "bot" ? "P2" : null); // P1 = Setter, P2 = Guesser
  
  // Game State
  const [word, setWord] = useState("");
  const [guesses, setGuesses] = useState([]); // array of 5-letter strings
  const [currentGuess, setCurrentGuess] = useState("");
  const [status, setStatus] = useState("setup"); // setup, playing, finished
  const [winner, setWinner] = useState(null); // P1 (Setter), P2 (Guesser)
  const [score, setScore] = useState({ P1: 0, P2: 0 });

  const [inputWord, setInputWord] = useState("");
  
  const [isAdLoading, setIsAdLoading] = useState(false);
  const [confetti, setConfetti] = useState([]);
  const [floatingEmojis, setFloatingEmojis] = useState([]);
  const [copied, setCopied] = useState(false);
  const channelRef = useRef(null);
  const prevStatusRef = useRef("setup");
  const prevGuessesRef = useRef(0);

  useEffect(() => {
    if (status === "finished" && prevStatusRef.current !== "finished") {
      if (winner === "P2") {
        playWinSound(soundOn);
        fireConfetti(setConfetti);
      } else {
        playDrawSound(soundOn);
      }
      setScore(s => ({ ...s, [winner]: s[winner] + 1 }));
    }
    prevStatusRef.current = status;
  }, [status, winner, soundOn]);

  useEffect(() => {
    if (guesses.length > prevGuessesRef.current) {
      // Last guess was submitted
      const last = guesses[guesses.length - 1];
      if (last === word) {
        playWinSound(soundOn);
      } else {
        playMoveSound("O", soundOn); // thud sound
      }
    }
    prevGuessesRef.current = guesses.length;
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
            if (data.board?.game_type === 'wordguess') {
              const state = data.board || {};
              setWord(state.word || "");
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
    if (data && data.board?.game_type === 'wordguess') {
      const state = data.board || {};
      setWord(state.word || "");
      setGuesses(state.guesses || []);
      setStatus(state.status || "setup");
      setWinner(state.winner || null);
    }
  }

  const syncState = async (newState) => {
    if (mode === "online") {
      await supabase.from("games").upsert({
        id: roomId,
        board: { game_type: 'wordguess', ...newState }
      });
    }
  };

  const startGame = (w) => {
    const newWord = w.toUpperCase().replace(/[^A-Z]/g, "");
    if (newWord.length !== WORD_LENGTH) return;
    
    setWord(newWord);
    setGuesses([]);
    setCurrentGuess("");
    setStatus("playing");
    setWinner(null);

    syncState({ word: newWord, guesses: [], status: "playing", winner: null });
  };

  const resetGame = () => {
    if (mode === "bot") {
      const randomWord = BOT_WORDS[Math.floor(Math.random() * BOT_WORDS.length)];
      startGame(randomWord);
    } else {
      setWord("");
      setGuesses([]);
      setCurrentGuess("");
      setStatus("setup");
      setWinner(null);
      setInputWord("");
      syncState({ word: "", guesses: [], status: "setup", winner: null });
    }
  };

  useEffect(() => {
    if (mode === "bot" && status === "setup") {
      resetGame();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, status]);

  // Handle local keyboard
  useEffect(() => {
    if (status !== "playing" || (mode === "online" && localPlayer !== "P2")) return;
    
    const handleKeyDown = (e) => {
      if (e.key === "Enter") {
        submitGuess();
      } else if (e.key === "Backspace") {
        setCurrentGuess(prev => prev.slice(0, -1));
        playTone(300, 0.05, "sine", 0, soundOn);
      } else {
        const key = e.key.toUpperCase();
        if (/^[A-Z]$/.test(key)) {
          handleKeyPress(key);
        }
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  const handleKeyPress = (key) => {
    if (status !== "playing") return;
    if (mode === "online" && localPlayer !== "P2") return;

    if (key === "DEL" || key === "BACKSPACE") {
      setCurrentGuess(prev => prev.slice(0, -1));
      playTone(300, 0.05, "sine", 0, soundOn);
    } else if (key === "ENTER") {
      submitGuess();
    } else if (currentGuess.length < WORD_LENGTH && /^[A-Z]$/.test(key)) {
      setCurrentGuess(prev => prev + key);
      playTone(400 + currentGuess.length * 50, 0.05, "sine", 0, soundOn);
    }
  };

  const submitGuess = () => {
    if (currentGuess.length !== WORD_LENGTH) return;
    if (guesses.length >= MAX_GUESSES) return;
    
    const nextGuesses = [...guesses, currentGuess];
    let nextStatus = "playing";
    let nextWinner = null;
    
    if (currentGuess === word) {
      nextStatus = "finished";
      nextWinner = "P2"; // Guesser wins
    } else if (nextGuesses.length >= MAX_GUESSES) {
      nextStatus = "finished";
      nextWinner = "P1"; // Setter wins
    }
    
    setGuesses(nextGuesses);
    setCurrentGuess("");
    setStatus(nextStatus);
    setWinner(nextWinner);
    
    syncState({ word, guesses: nextGuesses, status: nextStatus, winner: nextWinner });
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
         // Hint: Give them one correct letter in its position that they haven't found yet
         let knownPositions = new Array(WORD_LENGTH).fill(false);
         guesses.forEach(g => {
           for(let i=0; i<WORD_LENGTH; i++){
             if(g[i] === word[i]) knownPositions[i] = true;
           }
         });
         
         let missingIndices = [];
         for(let i=0; i<WORD_LENGTH; i++) {
           if(!knownPositions[i]) missingIndices.push(i);
         }
         
         if (missingIndices.length > 0) {
           const randIdx = missingIndices[Math.floor(Math.random() * missingIndices.length)];
           alert(`💡 คำใบ้: ตัวอักษรตำแหน่งที่ ${randIdx + 1} คือ "${word[randIdx]}"`);
         } else {
           alert("คำใบ้: คุณรู้ทุกตัวอักษรแล้ว เรียงให้ถูก!");
         }
      });

      await AdMob.showRewardVideoAd();
      
      setTimeout(() => listener.remove(), 5000);
      
    } catch(e) {
      alert("ไม่สามารถโหลดโฆษณาได้ ลองใหม่อีกครั้งครับ");
      console.error(e);
    } finally {
      setIsAdLoading(false);
    }
  };

  // Helper logic for colors
  const checkGuessColors = (guessStr) => {
    const result = new Array(WORD_LENGTH).fill("gray");
    const wordArr = word.split("");
    const guessArr = guessStr.split("");
    
    // Check greens
    guessArr.forEach((letter, i) => {
      if (letter === wordArr[i]) {
        result[i] = "green";
        wordArr[i] = null; // consume
      }
    });
    
    // Check yellows
    guessArr.forEach((letter, i) => {
      if (result[i] !== "green" && wordArr.includes(letter)) {
        result[i] = "yellow";
        wordArr[wordArr.indexOf(letter)] = null; // consume
      }
    });
    return result;
  };

  // Calculate keyboard colors
  const keyColors = {};
  guesses.forEach(g => {
    const colors = checkGuessColors(g);
    g.split("").forEach((letter, i) => {
      const c = colors[i];
      if (c === "green") keyColors[letter] = "green";
      else if (c === "yellow" && keyColors[letter] !== "green") keyColors[letter] = "yellow";
      else if (c === "gray" && !keyColors[letter]) keyColors[letter] = "gray";
    });
  });

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  function showFloatingEmoji(emoji) {
    const id = `${Date.now()}-${Math.random()}`;
    const left = 15 + Math.random() * 70;
    setFloatingEmojis((prev) => [...prev, { id, emoji, left }]);
    setTimeout(() => setFloatingEmojis((prev) => prev.filter((f) => f.id !== id)), 1800);
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
        <h2 className="text-2xl font-bold text-white mb-6 neon-text">เลือกบทบาทของคุณ</h2>
        <div className="flex flex-col gap-4 w-full">
          <button onClick={() => setLocalPlayer("P1")} className="btn-arcade w-full py-6 rounded-3xl glass border border-indigo-500/50 hover:bg-indigo-600/30 text-indigo-300 font-bold text-xl transition-all shadow-[0_0_15px_rgba(99,102,241,0.2)] text-left px-6">
            P1: คนตั้งโจทย์ (Setter)
            <p className="text-sm text-indigo-400 font-medium mt-1">พิมพ์คำศัพท์ 5 ตัวอักษร</p>
          </button>
          <button onClick={() => setLocalPlayer("P2")} className="btn-arcade w-full py-6 rounded-3xl glass border border-emerald-500/50 hover:bg-emerald-600/30 text-emerald-300 font-bold text-xl transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)] text-left px-6">
            P2: คนทาย (Guesser)
            <p className="text-sm text-emerald-400 font-medium mt-1">ทายคำศัพท์ 5 ตัวอักษร</p>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md animate-fade-in-up relative flex flex-col h-[calc(100vh-80px)]">
      <ConfettiContainer confetti={confetti} />
      
      <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
        {floatingEmojis.map((f) => (
          <div key={f.id} style={{ position: "absolute", left: `${f.left}%`, bottom: "120px", fontSize: "32px", animation: "float-up 1.8s ease-out forwards" }}>{f.emoji}</div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-2">
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
      <div className="flex items-center justify-between mb-4 glass-dark border border-indigo-500/30 rounded-2xl px-4 py-2 shadow-lg shrink-0">
        <div className="flex items-center gap-4 text-sm w-full justify-between px-2">
          <span className="font-bold text-indigo-400 flex flex-col items-center">
            <span className="text-[10px] text-indigo-300/70">P1 (โจทย์)</span>
            <span className="text-lg text-white neon-text-x">{score.P1}</span>
          </span>
          <span className="font-bold text-emerald-400 flex flex-col items-center">
            <span className="text-[10px] text-emerald-300/70">P2 (ทาย)</span>
            <span className="text-lg text-white drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]">{score.P2}</span>
          </span>
        </div>
      </div>

      {status === "setup" && (
        <div className="glass-dark p-6 rounded-3xl shadow-[0_0_20px_rgba(0,0,0,0.3)] border border-indigo-500/20 animate-fade-in-up mt-8">
          {localPlayer === "P1" ? (
            <div className="flex flex-col gap-4">
              <h3 className="font-bold text-indigo-300 text-center uppercase tracking-widest text-sm">พิมพ์คำศัพท์ภาษาอังกฤษ 5 ตัวอักษร</h3>
              <input 
                type="text" 
                value={inputWord}
                onChange={(e) => setInputWord(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
                className="w-full text-center text-4xl font-black py-4 border-b-2 border-indigo-500/30 bg-transparent text-white focus:outline-none focus:border-indigo-400 tracking-[0.5em] uppercase transition-colors"
                placeholder="WORD!"
                maxLength={5}
              />
              <button 
                onClick={() => startGame(inputWord)}
                disabled={inputWord.length !== 5}
                className="btn-arcade w-full py-4 mt-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-500 disabled:opacity-50 transition-all shadow-[0_0_15px_rgba(99,102,241,0.4)]"
              >
                เริ่มเกม!
              </button>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-400 rounded-full animate-spin mx-auto mb-4"></div>
              <h3 className="font-bold text-emerald-300/80 animate-pulse text-lg">รอ P1 ตั้งคำศัพท์...</h3>
            </div>
          )}
        </div>
      )}

      {(status === "playing" || status === "finished") && (
        <div className="flex flex-col flex-grow items-center justify-between pb-2">
          
          <div className="w-full flex justify-end shrink-0 mb-2">
            {status === "playing" && localPlayer === "P2" && Capacitor.isNativePlatform() && (
              <button 
                onClick={getAdHint}
                disabled={isAdLoading}
                className="btn-arcade bg-amber-500/20 text-amber-300 border border-amber-400/50 hover:bg-amber-500/40 py-2 px-4 rounded-xl font-bold text-xs transition-all shadow-[0_0_10px_rgba(251,191,36,0.3)] flex items-center gap-2 disabled:opacity-50"
              >
                🎁 {isAdLoading ? "กำลังโหลด..." : "ขอตัวช่วย (ดูโฆษณา)"}
              </button>
            )}
          </div>

          {/* Grid */}
          <div className="grid grid-rows-6 gap-2 shrink-0 mb-4">
            {Array.from({ length: MAX_GUESSES }).map((_, rowIdx) => {
              const isCurrentRow = rowIdx === guesses.length;
              const guess = guesses[rowIdx] || (isCurrentRow ? currentGuess.padEnd(5, " ") : "     ");
              const isSubmitted = rowIdx < guesses.length;
              const colors = isSubmitted ? checkGuessColors(guess) : Array(5).fill("");

              return (
                <div key={rowIdx} className="grid grid-cols-5 gap-2">
                  {guess.split("").map((letter, colIdx) => {
                    const c = colors[colIdx];
                    let style = "border-indigo-800/50 bg-transparent text-white"; // default empty
                    
                    if (letter !== " " && !isSubmitted) {
                      style = "border-indigo-400/80 bg-indigo-900/30 text-white drop-shadow-[0_0_5px_rgba(99,102,241,0.5)] animate-pop";
                    }
                    if (isSubmitted) {
                      if (c === "green") style = "border-emerald-500 bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)]";
                      else if (c === "yellow") style = "border-amber-500 bg-amber-500 text-white shadow-[0_0_15px_rgba(245,158,11,0.4)]";
                      else if (c === "gray") style = "border-slate-700 bg-slate-800 text-slate-400 opacity-60";
                    }

                    return (
                      <div key={colIdx} className={`w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center text-2xl sm:text-3xl font-black rounded-lg border-2 transition-all duration-300 ${style}`}>
                        {letter.trim() !== "" ? letter : ""}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {status === "finished" && (
            <div className="text-center glass border border-indigo-500/30 p-4 rounded-2xl animate-pop shadow-[0_0_20px_rgba(0,0,0,0.3)] mb-4 w-full">
              <h2 className={`text-2xl font-black drop-shadow-[0_0_10px_currentColor] ${winner === localPlayer || (mode === "bot" && winner === "P2") ? "text-emerald-400" : "text-pink-500"}`}>
                {winner === localPlayer || (mode === "bot" && winner === "P2") ? "คุณชนะ! 🎉" : "คุณแพ้! 😢"}
              </h2>
              {winner === "P1" && (
                <p className="text-white mt-2 font-bold text-lg">คำตอบคือ: <span className="text-amber-400 tracking-widest">{word}</span></p>
              )}
            </div>
          )}

          {/* Keyboard */}
          <div className={`w-full max-w-sm flex flex-col gap-2 shrink-0 ${localPlayer === "P1" && mode !== "bot" ? "opacity-50 pointer-events-none" : ""}`}>
            {KEYBOARD_ROWS.map((row, i) => (
              <div key={i} className="flex justify-center gap-1.5 sm:gap-2">
                {row.map(key => {
                  const c = keyColors[key];
                  let style = "glass border border-indigo-500/20 text-indigo-200 hover:bg-white/10 hover:border-indigo-400/50 active:scale-95";
                  
                  if (c === "green") style = "bg-emerald-500 text-white border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.4)] pointer-events-none";
                  else if (c === "yellow") style = "bg-amber-500 text-white border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.4)] pointer-events-none";
                  else if (c === "gray") style = "bg-slate-800 text-slate-500 border-slate-700 pointer-events-none opacity-50";
                  
                  if (key === "ENTER" || key === "DEL") {
                    style = "glass-dark border border-indigo-400/30 text-indigo-300 font-bold active:scale-95 px-2";
                  }

                  const flex = (key === "ENTER" || key === "DEL") ? "flex-[1.5]" : "flex-1";
                  
                  return (
                    <button
                      key={key}
                      onClick={() => handleKeyPress(key)}
                      className={`btn-arcade ${flex} h-12 sm:h-14 rounded-lg font-bold text-sm sm:text-base flex items-center justify-center transition-all ${style}`}
                    >
                      {key}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          
        </div>
      )}

      {/* Emoji Reactions */}
      {status === "finished" && (
        <div className="absolute bottom-20 right-0 flex flex-col gap-2 z-20">
          {REACTIONS.map((emoji) => (
            <button key={emoji} onClick={() => sendEmoji(emoji)} className="btn-arcade text-xl glass-dark border border-indigo-500/30 rounded-full w-10 h-10 flex items-center justify-center hover:bg-white/10 hover:border-indigo-400/50 transition-all shadow-sm">
              {emoji}
            </button>
          ))}
        </div>
      )}

    </div>
  );
}
