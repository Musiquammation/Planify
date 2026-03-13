const timerDisplay = document.getElementById('timerDisplay')!;
const pauseBtn     = document.getElementById('pauseBtn')!;

let timerInterval: ReturnType<typeof setInterval> | null = null;
let timeRemaining  = 0;  // seconds
let isTimerPaused  = false;

let onTimerEnd: (() => void) | null = null;

// ─── Public API ────────────────────────────────────────────────────────────

export function startTimer(durationSeconds: number, onEnd: () => void): void {
  stopTimer();
  timeRemaining  = durationSeconds;
  isTimerPaused  = false;
  onTimerEnd     = onEnd;

  pauseBtn.textContent = 'Pause';
  pauseBtn.classList.remove('paused');

  timerInterval = setInterval(() => {
    if (!isTimerPaused) {
      timeRemaining--;
      if (timeRemaining <= 0) {
        timeRemaining = 0;
        stopTimer();
        _updateDisplay();
        onTimerEnd?.();
        return;
      }
    }
    _updateDisplay();
  }, 1000);

  _updateDisplay();
}

export function stopTimer(): void {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

export function pauseTimer(): void {
  isTimerPaused = !isTimerPaused;
  if (isTimerPaused) {
    pauseBtn.textContent = 'Reprendre';
    pauseBtn.classList.add('paused');
  } else {
    pauseBtn.textContent = 'Pause';
    pauseBtn.classList.remove('paused');
  }
}

export function addTime(minutes = 5): void {
  timeRemaining += minutes * 60;
  _updateDisplay();
}

function _updateDisplay(): void {
  const m = Math.floor(timeRemaining / 60);
  const s = timeRemaining % 60;
  timerDisplay.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ─── Event listeners ───────────────────────────────────────────────────────

pauseBtn.addEventListener('click', pauseTimer);
document.getElementById('addTimeBtn')!.addEventListener('click', () => addTime(5));
