import { parseGameDate } from '../../utils/formatting.js';

const MOVE_MS = 780;
const HOLD_MS = 520;

function ease(progress) {
  const t = Math.min(1, Math.max(0, progress));
  return t * t * (3 - 2 * t);
}

export function datedLineupGames(games = []) {
  return [...games]
    .map((game) => ({ game, time: parseGameDate(game.date)?.getTime() ?? 0 }))
    .sort((a, b) => a.time - b.time || String(a.game.id).localeCompare(String(b.game.id)))
    .map((item) => item.game);
}

export function roleValue(game, role, field) {
  const value = game?.roles?.[role]?.[field];
  return Number.isFinite(value) ? value : null;
}

export function mixValue(fromValue, toValue, progress) {
  const hasFrom = Number.isFinite(fromValue);
  const hasTo = Number.isFinite(toValue);
  if (!hasFrom && !hasTo) return null;
  if (!hasFrom) return progress >= 1 ? toValue : null;
  if (!hasTo) return progress <= 0 ? fromValue : null;
  return fromValue + (toValue - fromValue) * progress;
}

export function createLineupPlayback(games = []) {
  const ordered = datedLineupGames(games);
  const last = Math.max(0, ordered.length - 1);
  let from = 0;
  let to = last;
  let index = 0;
  let previous = 0;
  let phase = 'hold';
  let elapsed = 0;
  let mode = 'static';
  let playing = false;
  let raf = 0;
  let lastTime = 0;
  let stopped = false;
  const listeners = new Set();

  function travel() {
    return phase === 'hold' ? 1 : ease(elapsed / MOVE_MS);
  }

  function landedIndex() {
    if (phase !== 'move') return index;
    return travel() < 0.5 ? previous : index;
  }

  function snapshot() {
    return {
      games: ordered,
      from,
      to,
      index,
      previous,
      landed: landedIndex(),
      phase,
      mode,
      playing,
      progress: travel(),
    };
  }

  function emit() {
    const state = snapshot();
    for (const listener of listeners) listener(state);
  }

  function canPlay() {
    return mode === 'dynamic' && playing && ordered.length > 1 && to > from;
  }

  function ensureRunning() {
    if (stopped) return;
    if (canPlay() && !raf) {
      lastTime = 0;
      raf = requestAnimationFrame(frame);
      return;
    }
    if (!canPlay() && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }

  function advance() {
    previous = index;
    index = index >= to ? from : index + 1;
    phase = 'move';
    elapsed = 0;
  }

  function stopLoop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function frame(now) {
    if (stopped || !canPlay()) {
      raf = 0;
      return;
    }
    const dt = lastTime ? Math.min(48, now - lastTime) : 16;
    lastTime = now;
    elapsed += dt;
    if (phase === 'move') {
      if (elapsed >= MOVE_MS) {
        phase = 'hold';
        elapsed = 0;
      }
    } else if (elapsed >= HOLD_MS) {
      advance();
    }
    emit();
    if (!canPlay()) {
      raf = 0;
      return;
    }
    raf = requestAnimationFrame(frame);
  }

  return {
    games: ordered,
    subscribe(listener) {
      listeners.add(listener);
      listener(snapshot());
      ensureRunning();
      return () => listeners.delete(listener);
    },
    setRange(nextFrom, nextTo) {
      from = Math.max(0, Math.min(nextFrom, last));
      to = Math.max(from, Math.min(nextTo, last));
      index = from;
      previous = from;
      phase = 'hold';
      elapsed = 0;
      emit();
      ensureRunning();
    },
    setMode(next) {
      mode = next === 'dynamic' ? 'dynamic' : 'static';
      index = from;
      previous = from;
      phase = 'hold';
      elapsed = 0;
      playing = mode === 'dynamic';
      if (!playing) stopLoop();
      emit();
      ensureRunning();
    },
    play() {
      if (mode !== 'dynamic') return;
      playing = true;
      emit();
      ensureRunning();
    },
    pause() {
      const landed = landedIndex();
      index = landed;
      previous = landed;
      phase = 'hold';
      elapsed = 0;
      playing = false;
      stopLoop();
      emit();
    },
    step(delta) {
      if (mode !== 'dynamic') return;
      const next = Math.max(from, Math.min(to, landedIndex() + delta));
      index = next;
      previous = next;
      phase = 'hold';
      elapsed = 0;
      playing = false;
      stopLoop();
      emit();
    },
    restart() {
      if (mode !== 'dynamic') return;
      index = from;
      previous = from;
      phase = 'hold';
      elapsed = 0;
      playing = true;
      emit();
      ensureRunning();
    },
    destroy() {
      stopped = true;
      stopLoop();
      listeners.clear();
    },
  };
}
