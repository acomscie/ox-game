import { useEffect, useState } from "react";
import { supabase } from "./supabase";

const GAME_ID = "room-1";

function App() {
  const [board, setBoard] = useState(Array(9).fill(null));
  const [turn, setTurn] = useState("X");
  const [winner, setWinner] = useState(null);

  // โหลดข้อมูลจาก DB
  useEffect(() => {
    loadGame();

    const channel = supabase
      .channel("game-room")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "games" },
        () => loadGame()
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const loadGame = async () => {
    const { data } = await supabase
      .from("games")
      .select("*")
      .eq("id", GAME_ID)
      .single();

    if (data) {
      setBoard(data.board);
      setTurn(data.turn);
      setWinner(data.winner);
    }
  };

  const play = async (index) => {
    if (board[index] || winner) return;

    const newBoard = [...board];
    newBoard[index] = turn;

    const win = checkWinner(newBoard);

    await supabase.from("games").upsert({
      id: GAME_ID,
      board: newBoard,
      turn: turn === "X" ? "O" : "X",
      winner: win,
    });
  };

  return (
    <div style={styles.page}>
      <h1>🎮 O/X Online Realtime</h1>

      <h2>{winner ? `Winner: ${winner}` : `Turn: ${turn}`}</h2>

      <div style={styles.board}>
        {board.map((c, i) => (
          <button key={i} style={styles.cell} onClick={() => play(i)}>
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}

// ตรวจผู้ชนะ
function checkWinner(b) {
  const lines = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
  ];

  for (let [a,b1,c] of lines) {
    if (b[a] && b[a] === b[b1] && b[a] === b[c]) {
      return b[a];
    }
  }
  return null;
}

const styles = {
  page: { textAlign: "center", fontFamily: "sans-serif" },
  board: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 80px)",
    justifyContent: "center",
    gap: "10px",
    marginTop: "20px",
  },
  cell: {
    width: "80px",
    height: "80px",
    fontSize: "24px",
  },
};

export default App;