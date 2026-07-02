import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabase";
import { IconArrowLeft, IconCopy, IconCheck, IconRotateCcw, IconVolume2, IconVolumeX } from "../components/Icons";
import { playMoveSound, playWinSound, playDrawSound } from "../utils/audio";
import { fireConfetti, ConfettiContainer } from "../utils/confetti";
import { Capacitor } from '@capacitor/core';
import { AdMob, RewardAdPluginEvents } from '@capacitor-community/admob';

const EMOJIS = ["🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼"];
const REACTIONS = ["😀", "😂", "🔥", "😱", "👏", "😢"];

function shuffle(array) {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
}

export default function MemoryMatch({ roomId, mode, exitRoom, soundOn, toggleSound }) {
  const [localPlayer, setLocalPlayer] = useState(mode === "bot" ? "P1" : null); // Bot mode: You are P1
  
  // Game State
  const [cards, setCards] = useState([]);
  const [flippedIndices, setFlippedIndices] = useState([]);
  const flippedRef = useRef([]); // Add ref for sync access
  const [turn, setTurn] = useState("P1");
  const [score, setScore] = useState({ P1: 0, P2: 0 });
  const [status, setStatus] = useState("setup"); // setup, playing, finished
  const [winner, setWinner] = useState(null);
  
  // Bot Memory
  const botMemoryRef = useRef({}); // { emoji: [index1, index2] }

  const [isAdLoading, setIsAdLoading] = useState(false);
  const [confetti, setConfetti] = useState([]);
  const [floatingEmojis, setFloatingEmojis] = useState([]);
  const [copied, setCopied] = useState(false);
  const channelRef = useRef(null);

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
            if (data.board?.game_type === 'memory') {
              const state = data.board || {};
              setCards(state.cards || []);
              setFlippedIndices(state.flippedIndices || []);
              flippedRef.current = state.flippedIndices || [];
              setTurn(state.turn || "P1");
              setScore(state.score || { P1: 0, P2: 0 });
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
    if (data && data.board?.game_type === 'memory') {
      const state = data.board || {};
      setCards(state.cards || []);
      setFlippedIndices(state.flippedIndices || []);
      flippedRef.current = state.flippedIndices || [];
      setTurn(state.turn || "P1");
      setScore(state.score || { P1: 0, P2: 0 });
      setStatus(state.status || "setup");
      setWinner(state.winner || null);
    }
  }

  const syncState = async (newState) => {
    if (mode === "online") {
      await supabase.from("games").upsert({
        id: roomId,
        board: { game_type: 'memory', ...newState }
      });
    }
  };

  const startGame = () => {
    const deck = shuffle([...EMOJIS, ...EMOJIS]).map((emoji, i) => ({
      id: i,
      emoji,
      isMatched: false
    }));
    
    const newState = {
      cards: deck,
      flippedIndices: [],
      turn: "P1",
      score: { P1: 0, P2: 0 },
      status: "playing",
      winner: null
    };
    
    setCards(newState.cards);
    setFlippedIndices(newState.flippedIndices);
    flippedRef.current = [];
    setTurn(newState.turn);
    setScore(newState.score);
    setStatus(newState.status);
    setWinner(newState.winner);
    botMemoryRef.current = {};

    syncState(newState);
  };

  const resetGame = () => {
    if (mode === "bot" && status === "setup") {
      startGame();
    } else if (mode === "bot") {
      startGame();
    } else {
      setStatus("setup");
      syncState({ status: "setup" });
    }
  };

  useEffect(() => {
    if (mode === "bot" && status === "setup") {
      startGame();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, status]);

  const handleCardClick = (index) => {
    if (status !== "playing") return;
    if (mode === "online" && turn !== localPlayer) return;
    if (mode === "bot" && turn !== "P1") return; // Bot is P2
    if (flippedRef.current.length >= 2) return;
    if (flippedRef.current.includes(index)) return;
    if (cards[index].isMatched) return;

    flipCard(index, turn);
  };

  const flipCard = (index, currentTurn) => {
    playMoveSound("O", soundOn);
    const nextFlipped = [...flippedRef.current, index];
    flippedRef.current = nextFlipped;
    setFlippedIndices(nextFlipped);
    
    // Update bot memory
    if (mode === "bot") {
      const emoji = cards[index].emoji;
      if (!botMemoryRef.current[emoji]) botMemoryRef.current[emoji] = [];
      if (!botMemoryRef.current[emoji].includes(index)) {
        botMemoryRef.current[emoji].push(index);
      }
    }

    if (nextFlipped.length === 2) {
      // Check match
      const [idx1, idx2] = nextFlipped;
      const card1 = cards[idx1];
      const card2 = cards[idx2];
      
      let nextCards = [...cards];
      let nextScore = { ...score };
      let nextTurn = currentTurn;
      
      if (card1.emoji === card2.emoji) {
        // Match!
        setTimeout(() => playWinSound(soundOn), 300);
        nextCards[idx1].isMatched = true;
        nextCards[idx2].isMatched = true;
        nextScore[currentTurn] += 1;
        // Keep turn if matched
      } else {
        // No match, switch turn
        nextTurn = currentTurn === "P1" ? "P2" : "P1";
      }

      // Check win
      let nextStatus = "playing";
      let nextWinner = null;
      if (nextCards.every(c => c.isMatched)) {
        nextStatus = "finished";
        if (nextScore.P1 > nextScore.P2) nextWinner = "P1";
        else if (nextScore.P2 > nextScore.P1) nextWinner = "P2";
        else nextWinner = "DRAW";
        
        if (nextWinner === localPlayer || nextWinner === "DRAW") {
          setTimeout(() => {
            fireConfetti(setConfetti);
            playWinSound(soundOn);
          }, 1000);
        }
      }

      syncState({ cards: nextCards, flippedIndices: nextFlipped, turn: currentTurn, score: nextScore, status: nextStatus, winner: nextWinner });
      
      setTimeout(() => {
        if (nextStatus === "playing") {
          setCards(nextCards);
          setFlippedIndices([]);
          flippedRef.current = [];
          setTurn(nextTurn);
          setScore(nextScore);
          syncState({ cards: nextCards, flippedIndices: [], turn: nextTurn, score: nextScore, status: nextStatus, winner: nextWinner });
        } else {
          setCards(nextCards);
          setStatus(nextStatus);
          setWinner(nextWinner);
          setScore(nextScore);
          syncState({ cards: nextCards, status: nextStatus, winner: nextWinner, score: nextScore });
        }
      }, 1500); // 1.5s delay to see cards
    } else {
      syncState({ flippedIndices: nextFlipped });
    }
  };

  // Bot Logic
  useEffect(() => {
    if (mode === "bot" && status === "playing" && turn === "P2" && flippedIndices.length === 0) {
      const timer = setTimeout(() => {
        botPlayTurn();
      }, 1000);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, status, flippedIndices]);

  const botPlayTurn = () => {
    // Basic bot logic:
    // 1. Check memory for a known pair
    let matchIdx1 = -1;
    let matchIdx2 = -1;
    
    for (const emoji in botMemoryRef.current) {
      const indices = botMemoryRef.current[emoji].filter(idx => !cards[idx].isMatched);
      if (indices.length >= 2) {
        matchIdx1 = indices[0];
        matchIdx2 = indices[1];
        break;
      }
    }
    
    if (matchIdx1 !== -1 && matchIdx2 !== -1) {
      // Found a match in memory
      flipCard(matchIdx1, "P2");
      setTimeout(() => {
        if (status === "playing") flipCard(matchIdx2, "P2");
      }, 800);
      return;
    }
    
    // 2. Pick a random unknown card
    const unknownIndices = cards.map((c, i) => i).filter(i => !cards[i].isMatched && !Object.values(botMemoryRef.current).flat().includes(i));
    const randomChoices = unknownIndices.length > 0 ? unknownIndices : cards.map((c, i) => i).filter(i => !cards[i].isMatched);
    
    const firstPick = randomChoices[Math.floor(Math.random() * randomChoices.length)];
    flipCard(firstPick, "P2");
    
    // 3. Second pick
    setTimeout(() => {
      if (status !== "playing") return;
      // After first pick, we might now have a match in memory!
      const firstEmoji = cards[firstPick].emoji;
      const memoryIndices = botMemoryRef.current[firstEmoji] || [];
      const knownMatch = memoryIndices.find(idx => idx !== firstPick && !cards[idx].isMatched);
      
      if (knownMatch !== undefined) {
        flipCard(knownMatch, "P2");
      } else {
        // Pick random again
        const remUnknown = unknownIndices.filter(i => i !== firstPick);
        const remChoices = remUnknown.length > 0 ? remUnknown : randomChoices.filter(i => i !== firstPick);
        const secondPick = remChoices[Math.floor(Math.random() * remChoices.length)];
        flipCard(secondPick, "P2");
      }
    }, 800);
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
         // Hint: Flip all cards temporarily
         const allIndices = cards.map((c, i) => i).filter(i => !cards[i].isMatched);
         setFlippedIndices(allIndices);
         flippedRef.current = allIndices;
         setTimeout(() => {
           setFlippedIndices([]);
           flippedRef.current = [];
         }, 2000);
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
            P1: เล่นก่อน
            <p className="text-sm text-indigo-400 font-medium mt-1">เริ่มเปิดการ์ดก่อน</p>
          </button>
          <button onClick={() => setLocalPlayer("P2")} className="btn-arcade w-full py-6 rounded-3xl glass border border-emerald-500/50 hover:bg-emerald-600/30 text-emerald-300 font-bold text-xl transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)] text-left px-6">
            P2: เล่นทีหลัง
            <p className="text-sm text-emerald-400 font-medium mt-1">รอ P1 เปิดก่อน</p>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md animate-fade-in-up relative flex flex-col items-center">
      <ConfettiContainer confetti={confetti} />
      
      <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
        {floatingEmojis.map((f) => (
          <div key={f.id} style={{ position: "absolute", left: `${f.left}%`, bottom: "120px", fontSize: "32px", animation: "float-up 1.8s ease-out forwards" }}>{f.emoji}</div>
        ))}
      </div>

      {/* Header */}
      <div className="w-full flex items-center justify-between mb-4">
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

      {/* Scoreboard */}
      <div className="w-full flex items-center justify-between mb-6 glass-dark border border-indigo-500/30 rounded-2xl px-4 py-3 shadow-lg relative">
        <div className="absolute inset-x-0 bottom-0 h-1 bg-slate-700 rounded-b-2xl overflow-hidden">
          <div className={`h-full transition-all duration-500 ${turn === "P1" ? "bg-indigo-500 w-1/2" : "bg-emerald-500 w-1/2 ml-auto"}`}></div>
        </div>
        <div className="flex items-center gap-4 text-sm w-full justify-between px-2">
          <span className={`font-bold flex flex-col items-center transition-opacity ${turn === "P1" ? "text-indigo-400 opacity-100" : "text-indigo-400/50"}`}>
            <span className="text-xs">P1</span>
            <span className={`text-xl ${turn === "P1" ? "text-white neon-text-x" : ""}`}>{score.P1} คู่</span>
          </span>
          
          <div className="text-xs text-slate-400 font-bold uppercase tracking-widest bg-slate-800/50 px-3 py-1 rounded-full border border-slate-700/50">
            {status === "finished" ? "GAME OVER" : `Turn: ${turn}`}
          </div>

          <span className={`font-bold flex flex-col items-center transition-opacity ${turn === "P2" ? "text-emerald-400 opacity-100" : "text-emerald-400/50"}`}>
            <span className="text-xs">P2</span>
            <span className={`text-xl ${turn === "P2" ? "text-white drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]" : ""}`}>{score.P2} คู่</span>
          </span>
        </div>
      </div>

      {status === "setup" && mode === "online" && (
        <div className="glass-dark p-6 rounded-3xl shadow-[0_0_20px_rgba(0,0,0,0.3)] border border-indigo-500/20 animate-fade-in-up mt-8 w-full">
           <div className="text-center py-12">
             <button onClick={startGame} className="btn-arcade w-full py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-500 transition-all shadow-[0_0_15px_rgba(99,102,241,0.4)]">
                เริ่มเกม!
             </button>
          </div>
        </div>
      )}

      {(status === "playing" || status === "finished") && (
        <div className="w-full flex flex-col items-center">
          
          <div className="w-full flex justify-end mb-4">
            {status === "playing" && turn === localPlayer && Capacitor.isNativePlatform() && (
              <button 
                onClick={getAdHint}
                disabled={isAdLoading}
                className="btn-arcade bg-amber-500/20 text-amber-300 border border-amber-400/50 hover:bg-amber-500/40 py-2 px-4 rounded-xl font-bold text-xs transition-all shadow-[0_0_10px_rgba(251,191,36,0.3)] flex items-center gap-2 disabled:opacity-50"
              >
                🎁 {isAdLoading ? "กำลังโหลด..." : "ขอตัวช่วย (แอบดูการ์ด)"}
              </button>
            )}
          </div>

          {/* Card Grid */}
          <div className="grid grid-cols-4 gap-3 sm:gap-4 w-full aspect-square max-w-[360px] perspective-1000">
            <style>{`
              .perspective-1000 { perspective: 1000px; }
              .preserve-3d { transform-style: preserve-3d; }
              .backface-hidden { backface-visibility: hidden; }
              .rotate-y-180 { transform: rotateY(180deg); }
            `}</style>
            
            {cards.map((card, idx) => {
              const isFlipped = card.isMatched || flippedIndices.includes(idx);
              
              return (
                <div key={card.id} 
                  className="relative w-full h-full cursor-pointer preserve-3d transition-transform duration-500 ease-out"
                  style={{ transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
                  onClick={() => handleCardClick(idx)}
                >
                  {/* Front (Hidden) */}
                  <div className="absolute w-full h-full backface-hidden glass border border-indigo-500/30 rounded-xl flex items-center justify-center hover:bg-white/10 hover:border-indigo-400/50 transition-colors shadow-sm">
                     <span className="text-3xl opacity-20">?</span>
                  </div>
                  
                  {/* Back (Revealed) */}
                  <div className="absolute w-full h-full backface-hidden rounded-xl flex items-center justify-center rotate-y-180 glass bg-indigo-900/40 border border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.3)]">
                    <span className="text-4xl animate-pop">{card.emoji}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {status === "finished" && (
            <div className="text-center glass border border-indigo-500/30 p-4 rounded-2xl animate-pop shadow-[0_0_20px_rgba(0,0,0,0.3)] mt-8 w-full">
              <h2 className={`text-2xl font-black drop-shadow-[0_0_10px_currentColor] ${winner === localPlayer || (mode === "bot" && winner === "P1") ? "text-emerald-400" : winner === "DRAW" ? "text-amber-400" : "text-pink-500"}`}>
                {winner === "DRAW" ? "เสมอ! 🤝" : (winner === localPlayer || (mode === "bot" && winner === "P1")) ? "คุณชนะ! 🎉" : "คุณแพ้! 😢"}
              </h2>
            </div>
          )}

        </div>
      )}

      {/* Emoji Reactions */}
      <div className="flex items-center justify-center gap-2 mt-auto pt-8 pb-4">
        {REACTIONS.map((emoji) => (
          <button key={emoji} onClick={() => sendEmoji(emoji)} className="btn-arcade text-xl glass-dark border border-indigo-500/30 rounded-full w-10 h-10 flex items-center justify-center hover:bg-white/10 hover:border-indigo-400/50 transition-all shadow-sm">
            {emoji}
          </button>
        ))}
      </div>

    </div>
  );
}
