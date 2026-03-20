let confettiModulePromise: Promise<typeof import('canvas-confetti')> | null = null;

const lastFiredAt: Record<'correct' | 'result', number> = {
  correct: 0,
  result: 0,
};

const COOLDOWN_MS: Record<'correct' | 'result', number> = {
  correct: 250,
  result: 1200,
};

const WARM_COLORS = ['#f59e0b', '#f97316', '#fca5a5', '#fde68a'];

const isBrowser = () => typeof window !== 'undefined';

const shouldReduceMotion = () => {
  if (!isBrowser() || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

const canFire = (key: 'correct' | 'result') => {
  if (!isBrowser() || shouldReduceMotion()) return false;

  const now = Date.now();
  if (now - lastFiredAt[key] < COOLDOWN_MS[key]) return false;

  lastFiredAt[key] = now;
  return true;
};

const getConfetti = async () => {
  confettiModulePromise ??= import('canvas-confetti');
  const loadedModule = await confettiModulePromise;
  return loadedModule.default;
};

export async function fireCorrectEffect() {
  if (!canFire('correct')) return;

  const confetti = await getConfetti();
  const offset = (Math.random() - 0.5) * 0.08;

  void confetti({
    particleCount: 14,
    spread: 36,
    startVelocity: 16,
    ticks: 70,
    gravity: 1.25,
    scalar: 0.75,
    origin: { x: 0.5 + offset, y: 0.78 },
    colors: WARM_COLORS,
    disableForReducedMotion: true,
  });
}

export async function fireResultEffect({ isPerfect }: { isPerfect: boolean }) {
  if (!canFire('result')) return;

  const confetti = await getConfetti();

  void confetti({
    particleCount: 42,
    spread: 62,
    startVelocity: 22,
    ticks: 120,
    gravity: 1.05,
    scalar: 0.9,
    origin: { x: 0.5, y: 0.34 },
    colors: WARM_COLORS,
    disableForReducedMotion: true,
  });

  if (isPerfect) {
    window.setTimeout(() => {
      if (shouldReduceMotion()) return;

      void confetti({
        particleCount: 24,
        spread: 44,
        startVelocity: 18,
        ticks: 90,
        gravity: 1.12,
        scalar: 0.82,
        origin: { x: 0.68, y: 0.4 },
        colors: WARM_COLORS,
        disableForReducedMotion: true,
      });
    }, 180);
  }
}
