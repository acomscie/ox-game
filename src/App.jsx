import { useEffect, useState } from "react";
import { supabase } from "./supabase";

// ── helpers ──────────────────────────────────────────────
function checkWinner(b) {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
  ];
  for (const [a, b1, c] of lines) {
    if (b[a] && b[a] === b[b1] && b[a] === b[c]) return b[a];
  }
  if (b.every(Boolean)) return "draw";
  return null;
}

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// ── styles ───────────────────────────────────────────────
const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "linear-gradient(135deg, #667eea, #764ba2)",
    fontFamily: "sans-serif",
  },
  card: {
    background: "rgba(255,255,255,0.15)",
    backdropFilter: "blur(15px)",
    padding: "30px",
    borderRadius: "20px",
    color: "white",
    textAlign: "center",
    boxShadow: "0 8px 30px rgba(0,0,0,0.2)",
    minWidth: "320px",
  },
  input: {
    padding: "12px",
    width: "220px",
    borderRadius: "10px",
    border: "none",
    marginBottom: "10px",
    fontSize: "16px",
    display: "block",
    margin: "0 auto 10px",
  },
  button: {
    padding: "12px 20px",
    borderRadius: "10px",
    border: "none",
    cursor: "pointer",
    margin: "5px",
    fontSize: "16px",
    fontWeight: "bold",
    background: "rgba(255,255,255,0.25)",
    color: "white",
  },
  board: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 100px)",
    gap: "10px",
    justifyContent: "center",
    marginTop: "20px",
  },
  cell: {
    width: "100px",
    height: "100px",
    fontSize: "40px",
    borderRadius: "15px",
    border: "none",
    cursor: "pointer",
    background: "rgba(255,255,255,0.2)",
    color: "white",
    fontWeight: "bold",
  },
  statusText: {
    fontSize: "20px",
    marginBottom: "5px",
  },
  roomCode: {
    fontSize: "13px",
    opacity: 0.7,
    marginBottom: "10px",
  },
};

// ── component ─────────────────────────────────────────────
export default function App() {
  // ① hooks ทั้งหมดอยู่บนสุดของ component เสมอ
  const [roomId, setRoomId] = useState("");
  const [inputRoom, setInputRoom] = useState("");
  const [joined, setJoined] = useState(false);
  const [board, setBoard] = useState(Array(9).fill(null));
  const [turn, setTurn] = useState("X");
  const [winner, setWinner] = useState(null);

  // ② useEffect ต้องอยู่ก่อน early return
  useEffect(() => {
    if (!joined || !roomId) return; // guard แทน early return

    loadGame();

    const channel = supabase
      .channel(`game-room-${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "games" },
        () => loadGame()
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [joined, roomId]); // ③ dependency ครบถ้วน

  // ── functions ────────────────────────────────────────────
  const loadGame = async () => {
    const { data } = await supabase
      .from("games")
      .select("*")
      .eq("id", roomId) // ④ ใช้ roomId ที่มีอยู่ ไม่ใช่ GAME_ID
      .single();

    if (data) {
      setBoard(data.board);
      setTurn(data.turn);
      setWinner(data.winner);
    }
  };

  const joinRoom = () => {
    if (inputRoom.trim()) {
      setRoomId(inputRoom.trim().toUpperCase());
      setJoined(true);
    }
  };

  const createRoom = () => {
    const code = generateRoomCode();
    setRoomId(code);
    setInputRoom(code);
    setJoined(true);
  };

  const play = async (index) => {
    if (board[index] || winner) return;

    const newBoard = [...board];
    newBoard[index] = turn;
    const win = checkWinner(newBoard);

    await supabase.from("games").upsert({
      id: roomId,
      board: newBoard,
      turn: turn === "X" ? "O" : "X",
      winner: win,
    });
  };

  const resetGame = async () => {
    await supabase.from("games").upsert({
      id: roomId,
      board: Array(9).fill(null),
      turn: "X",
      winner: null,
    });
  };

  // ⑤ early return หลัง hooks และฟังก์ชันทั้งหมด
  if (!joined) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <h1>🎮 O/X Online</h1>

          <input
            value={inputRoom}
            onChange={(e) => setInputRoom(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && joinRoom()}
            placeholder="กรอกรหัสห้อง"
            style={styles.input}
          />

          <div>
            <button style={styles.button} onClick={joinRoom}>
              เข้าห้อง
            </button>
            <button style={styles.button} onClick={createRoom}>
              สร้างห้องใหม่
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── game screen ───────────────────────────────────────────
  const statusText =
    winner === "draw"
      ? "🤝 เสมอ!"
      : winner
      ? `🏆 ผู้ชนะ: ${winner}`
      : `เทิร์น: ${turn}`;

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1>🎮 O/X Online</h1>
        <p style={styles.roomCode}>ห้อง: {roomId}</p>
        <p style={styles.statusText}>{statusText}</p>

        <div style={styles.board}>
          {board.map((cell, i) => (
            <button
              key={i}
              style={{
                ...styles.cell,
                color: cell === "X" ? "#f9ca24" : "#ff6b9d",
              }}
              onClick={() => play(i)}
              disabled={!!cell || !!winner}
            >
              {cell}
            </button>
          ))}
        </div>

        {winner && (
          <button style={{ ...styles.button, marginTop: "20px" }} onClick={resetGame}>
            🔄 เริ่มใหม่
          </button>
        )}

        <button
          style={{ ...styles.button, marginTop: "10px", opacity: 0.7, fontSize: "13px" }}
          onClick={() => {
            setJoined(false);
            setRoomId("");
            setInputRoom("");
            setBoard(Array(9).fill(null));
            setTurn("X");
            setWinner(null);
          }}
        >
          ← ออกจากห้อง
        </button>
      </div>
    </div>
  );
}