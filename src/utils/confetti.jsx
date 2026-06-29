/* eslint-disable react-refresh/only-export-components */
export const CONFETTI_COLORS = ["#6366f1", "#f43f5e", "#f59e0b", "#10b981", "#06b6d4"];

export const fireConfetti = (setConfetti) => {
  const pieces = Array.from({ length: 50 }, (_, i) => ({
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

export const ConfettiContainer = ({ confetti }) => (
  <div className="pointer-events-none fixed inset-0 z-[100] overflow-hidden">
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
    <style>{`
      @keyframes confetti-fall {
        0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
        100% { transform: translateY(110vh) rotate(540deg); opacity: 0.4; }
      }
    `}</style>
  </div>
);
