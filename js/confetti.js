// ============================================================
// confetti.js — Goal achievement celebration
// ============================================================

const Confetti = {
  COLORS: ['#f4a7c3','#a8d4f5','#a8d5b5','#f7c4a0','#c8b4f0','#f0b429','#e87aaa'],

  fire(count = 60) {
    const container = document.getElementById('confettiContainer');
    if (!container) return;

    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        const piece = document.createElement('div');
        piece.className = 'confetti-piece';
        piece.style.cssText = `
          left: ${Math.random() * 100}vw;
          top: -10px;
          background: ${this.COLORS[Math.floor(Math.random() * this.COLORS.length)]};
          width: ${6 + Math.random() * 6}px;
          height: ${6 + Math.random() * 6}px;
          border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
          animation-duration: ${1.8 + Math.random() * 1.4}s;
          animation-delay: ${Math.random() * 0.3}s;
        `;
        container.appendChild(piece);
        setTimeout(() => piece.remove(), 3000);
      }, i * 20);
    }
  },
};
