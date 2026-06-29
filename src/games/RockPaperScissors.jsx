import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabase";
import { IconArrowLeft, IconCopy, IconCheck, IconRotateCcw, IconVolume2, IconVolumeX } from "../components/Icons";
import { playMoveSound, playWinSound, playDrawSound } from "../utils/audio";
import { fireConfetti, ConfettiContainer } from "../utils/confetti";

const CHOICES = ["rock", "paper", "scissors"];
const EMOJIS = { rock: "✊", paper: "✋", scissors: "✌️" };
const WIN_MAP = { rock: "scissors", paper: "rock", scissors: "paper" };

const REACTIONS = ["😀", "😂", "🔥", "😱", "👏", "😢"];

export default function RockPaperScissors({ roomId, mode, exitRoom, soundOn, toggleSound }) {
  // player is "P1" or "P2" based on who created the room vs joined.
  // We'll determine this: if mode is online, maybe we just allow either player to pick. 
  // Actually, to make it simple without strict auth: 
  // Local state: am I P1 or P2? 
  // We can ask the user when they join, or assign P1 if they created the room.
  // For simplicity, let's just let the user pick their side if it's online, or assign automatically.
  // Let's use a simpler state: both players submit. 
  const [localPlayer, setLocalPlayer] = useState(mode === "bot" ? "P1" : null); // null means user must choose seat
  const [p1Choice, setP1Choice] = useState(null);
  const [p2Choice, setP2Choice] = useState(null);
  const [winner, setWinner] = useState(null); // "P1", "P2", "draw"
  const [score, setScore] = useState({ P1: 0, P2: 0, draw: 0 });
  
  const [confetti, setConfetti] = useState([]);
  const [floatingEmojis, setFloatingEmojis] = useState([]);
  const [copied, setCopied] = useState(false);
  const [revealing, setRevealing] = useState(false);

  const channelRef = useRef(null);

  // Auto-resolve when both picked
  useEffect(() => {
    if (p1Choice && p2Choice && !winner && !revealing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRevealing(true);
      // Wait for dramatic effect
      setTimeout(() => {
        let result = "draw";
        if (WIN_MAP[p1Choice] === p2Choice) result = "P1";
        else if (WIN_MAP[p2Choice] === p1Choice) result = "P2";
        
        setWinner(result);
        setRevealing(false);

        if (result === "draw") {
          playDrawSound(soundOn);
          setScore(s => ({...s, draw: s.draw + 1}));
        } else {
          playWinSound(soundOn);
          fireConfetti(setConfetti);
          setScore(s => ({...s, [result]: s[result] + 1}));
        }
      }, 1000);
    }
  }, [p1Choice, p2Choice, winner, revealing, soundOn]);

  useEffect(() => {
    if (mode !== "online") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocalPlayer("P1");
      return;
    }
    loadGame();

    const channel = supabase
      .channel(`room-${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "games", filter: `id=eq.${roomId}` },
        (payload) => {
          if (payload.new && Object.keys(payload.new).length > 0) {
            const data = payload.new;
            const state = data.board || {};
            if (state.game_type === 'rps') {
              if (state.p1Choice !== undefined) setP1Choice(state.p1Choice);
              if (state.p2Choice !== undefined) setP2Choice(state.p2Choice);
              if (state.winner !== undefined) setWinner(state.winner);
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

  async function loadGame() {
    const { data } = await supabase.from("games").select("*").eq("id", roomId).single();
    if (data && data.board?.game_type === 'rps') {
      const state = data.board || {};
      setP1Choice(state.p1Choice || null);
      setP2Choice(state.p2Choice || null);
      setWinner(state.winner || null);
    }
  }

  const syncState = async (newState) => {
    if (mode === "online") {
      await supabase.from("games").upsert({
        id: roomId,
        board: { game_type: 'rps', ...newState }
      });
    }
  };

  const play = async (choice) => {
    if (!localPlayer) return; // Must select seat
    if (winner || revealing) return;
    if (localPlayer === "P1" && p1Choice) return;
    if (localPlayer === "P2" && p2Choice) return;

    playMoveSound(localPlayer, soundOn);

    const isP1 = localPlayer === "P1";
    const nextP1Choice = isP1 ? choice : p1Choice;
    let nextP2Choice = !isP1 ? choice : p2Choice;

    if (mode === "bot" && isP1) {
      // Bot plays immediately
      nextP2Choice = CHOICES[Math.floor(Math.random() * CHOICES.length)];
    }

    if (isP1) setP1Choice(nextP1Choice);
    else setP2Choice(nextP2Choice);
    
    if (mode === "bot" && isP1) setP2Choice(nextP2Choice);

    syncState({ p1Choice: nextP1Choice, p2Choice: nextP2Choice, winner: null });
  };

  const resetGame = async () => {
    setP1Choice(null);
    setP2Choice(null);
    setWinner(null);
    setRevealing(false);

    syncState({ p1Choice: null, p2Choice: null, winner: null });
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

  // UI helpers
  function renderCard(player, choice) {
    const isMe = localPlayer === player;
    const hasChosen = !!choice;
    const showResult = winner || revealing;
    
    let content = "🤔";
    if (hasChosen && showResult) {
      content = EMOJIS[choice];
    } else if (hasChosen) {
      content = "✅";
    }

    const baseStyle = "aspect-square rounded-3xl flex items-center justify-center text-7xl shadow-lg transition-all duration-500 relative overflow-hidden";
    
    let bgStyle = "bg-white border-4 border-slate-100 text-slate-800";
    if (hasChosen && !showResult) bgStyle = "bg-slate-100 border-4 border-slate-300";
    if (showResult) {
      if (winner === player) bgStyle = player === "P1" ? "bg-indigo-500 text-white border-4 border-indigo-600 scale-105 shadow-indigo-200" : "bg-rose-500 text-white border-4 border-rose-600 scale-105 shadow-rose-200";
      else if (winner === "draw") bgStyle = "bg-yellow-400 text-white border-4 border-yellow-500";
      else bgStyle = "bg-slate-200 text-slate-400 border-4 border-slate-300 scale-95 opacity-50";
    }

    return (
      <div className="flex flex-col items-center gap-2">
        <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">
          {player} {isMe && "(คุณ)"}
        </span>
        <div className={`${baseStyle} ${bgStyle} w-full`}>
          <span className={revealing ? "animate-bounce" : (showResult ? "animate-pop" : "")}>
            {content}
          </span>
        </div>
      </div>
    );
  };

  if (!localPlayer && mode === "online") {
    return (
      <div className="w-full max-w-sm animate-fade-in-up flex flex-col items-center justify-center">
        <h2 className="text-xl font-bold text-slate-700 mb-6">เลือกที่นั่งของคุณ</h2>
        <div className="flex gap-4 w-full">
          <button onClick={() => setLocalPlayer("P1")} className="flex-1 py-8 rounded-3xl bg-indigo-50 border-2 border-indigo-100 hover:bg-indigo-100 text-indigo-700 font-bold text-2xl transition-transform active:scale-95">P1</button>
          <button onClick={() => setLocalPlayer("P2")} className="flex-1 py-8 rounded-3xl bg-rose-50 border-2 border-rose-100 hover:bg-rose-100 text-rose-700 font-bold text-2xl transition-transform active:scale-95">P2</button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm animate-fade-in-up relative">
      <ConfettiContainer confetti={confetti} />
      
      <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
        {floatingEmojis.map((f) => (
          <div key={f.id} style={{ position: "absolute", left: `${f.left}%`, bottom: "120px", fontSize: "32px", animation: "float-up 1.8s ease-out forwards" }}>{f.emoji}</div>
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

      <div className="flex items-center justify-between mb-8 bg-white/80 backdrop-blur-sm border border-slate-100 rounded-2xl px-4 py-3 shadow-sm">
        <div className="flex items-center gap-4 text-sm w-full justify-between px-2">
          <span className="font-bold text-indigo-600 flex flex-col items-center">
            <span className="text-xs text-slate-400">P1</span>
            <span className="text-xl text-slate-800">{score.P1}</span>
          </span>
          <span className="font-bold text-slate-400 flex flex-col items-center">
             <span className="text-xs">เสมอ</span>
             <span className="text-xl text-slate-700">{score.draw}</span>
          </span>
          <span className="font-bold text-rose-600 flex flex-col items-center">
            <span className="text-xs text-slate-400">P2</span>
            <span className="text-xl text-slate-800">{score.P2}</span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-10">
        {renderCard("P1", p1Choice)}
        {renderCard("P2", p2Choice)}
      </div>

      {(!winner && !revealing) && (
        <div className="bg-white p-6 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100">
          <p className="text-center font-bold text-slate-500 mb-4 uppercase tracking-widest text-sm">
            {(localPlayer === "P1" ? !p1Choice : !p2Choice) ? "เลือกอาวุธของคุณ" : "รออีกฝ่าย..."}
          </p>
          <div className="flex justify-center gap-4">
            {CHOICES.map(c => {
              const myChoice = localPlayer === "P1" ? p1Choice : p2Choice;
              const isSelected = myChoice === c;
              const disabled = !!myChoice;
              return (
                <button
                  key={c}
                  onClick={() => play(c)}
                  disabled={disabled}
                  className={`
                    w-16 h-16 rounded-2xl text-3xl flex items-center justify-center transition-all duration-200
                    ${isSelected ? "bg-indigo-500 text-white scale-110 shadow-lg shadow-indigo-200 ring-4 ring-indigo-200" : "bg-slate-50 hover:bg-slate-100 border-2 border-slate-200 hover:scale-105 active:scale-95"}
                    ${disabled && !isSelected ? "opacity-50 grayscale" : ""}
                  `}
                >
                  {EMOJIS[c]}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {(winner || revealing) && (
        <div className="text-center mb-6">
          <h2 className="text-3xl font-black text-slate-800">
            {revealing ? "กำลังตัดสิน..." : winner === "draw" ? "เสมอ!" : winner === localPlayer ? "คุณชนะ! 🎉" : "คุณแพ้! 😢"}
          </h2>
        </div>
      )}

      <div className="flex items-center justify-center gap-2 mb-6 mt-6">
        {REACTIONS.map((emoji) => (
          <button key={emoji} onClick={() => sendEmoji(emoji)} className="text-2xl bg-white border border-slate-100 rounded-xl w-10 h-10 flex items-center justify-center hover:bg-slate-50 hover:scale-110 active:scale-95 transition-all shadow-sm">
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
