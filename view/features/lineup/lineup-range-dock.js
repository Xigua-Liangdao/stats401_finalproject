import { ROLE_ORDER } from '../../utils/constants.js';
import { d3 } from '../../utils/d3.js';
import { h } from '../../utils/dom.js';
import { formatCompactDate, formatResult } from '../../utils/formatting.js';
import { roleValue } from './lineup-playback.js';

function sideKey(side) {
  const value = String(side ?? '').toLowerCase();
  if (value === 'blue' || value === 'red') return value;
  return '';
}

export function createGameMark(game) {
  const result = formatResult(game?.result);
  const side = sideKey(game?.side);
  const sideLabel = side === 'blue' ? 'Blue' : side === 'red' ? 'Red' : '';
  const outcome = result === 'W' ? 'Win' : result === 'L' ? 'Loss' : '';
  return h('span', {
    class: `game-mark${side ? ` game-mark--${side}` : ''}`,
    'aria-label': [sideLabel ? `${sideLabel} side` : null, outcome].filter(Boolean).join(', ') || undefined,
  }, [
    h('span', {
      class: `game-mark__result${result === 'W' ? ' is-win' : result === 'L' ? ' is-loss' : ''}`,
    }, [result]),
    sideLabel ? h('span', { class: 'game-mark__side' }, [sideLabel]) : null,
  ]);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function windowFromSelection(rawStart, rawEnd, count) {
  const last = Math.max(0, count - 1);
  const start = clamp(Math.round(Math.min(rawStart, rawEnd)), 0, last);
  const end = clamp(Math.round(Math.max(rawStart, rawEnd)), 0, last);
  return [start, end];
}

export function createLineupRangeDock({ playback }) {
  const ordered = playback?.games ?? [];
  const lastIndex = Math.max(0, ordered.length - 1);
  const frameLabel = h('p', { class: 'timeline-range lineup-frame-label' });
  const windowLabel = h('p', { class: 'timeline-range' });
  const staticButton = h('button', {
    class: 'radar-zoom-btn', type: 'button', 'aria-pressed': 'true',
  }, ['Static']);
  const dynamicButton = h('button', {
    class: 'radar-zoom-btn', type: 'button', 'aria-pressed': 'false',
  }, ['Dynamic']);
  const playButton = h('button', { class: 'radar-zoom-btn', type: 'button' }, ['Play']);
  const pauseButton = h('button', { class: 'radar-zoom-btn', type: 'button' }, ['Pause']);
  const restartButton = h('button', { class: 'radar-zoom-btn', type: 'button' }, ['Restart']);
  const prevButton = h('button', {
    class: 'radar-zoom-btn', type: 'button', 'aria-label': 'Previous game',
  }, ['←']);
  const nextButton = h('button', {
    class: 'radar-zoom-btn', type: 'button', 'aria-label': 'Next game',
  }, ['→']);
  const transport = h('div', {
    class: 'lineup-transport', role: 'group', 'aria-label': 'Playback', hidden: true,
  }, [playButton, pauseButton, restartButton, prevButton, nextButton]);
  const brushSvg = d3.create('svg')
    .attr('class', 'timeline-brush-svg')
    .attr('role', 'slider')
    .attr('aria-label', 'Game range')
    .attr('aria-orientation', 'horizontal');
  const node = h('div', { class: 'lineup-shared-dock panel' }, [
    h('div', { class: 'lineup-shared-dock__bar' }, [
      h('div', { class: 'lineup-transport', role: 'group', 'aria-label': 'Chart mode' }, [
        staticButton,
        dynamicButton,
      ]),
      transport,
      h('div', { class: 'lineup-shared-dock__labels' }, [frameLabel, windowLabel]),
    ]),
    brushSvg.node(),
    h('p', { class: 'lineup-axis-note' }, ['Line: mean gold share of the five roles']),
  ]);

  let frameState = null;
  let userBrushing = false;
  let movingBrush = false;
  let brushWidth = 0;
  let xIndex = null;
  const brush = d3.brushX().on('start brush end', onBrush);
  const brushG = brushSvg.append('g').attr('class', 'timeline-brush');

  function rangeText() {
    if (!ordered.length) return 'No games';
    const from = frameState?.from ?? 0;
    const to = frameState?.to ?? lastIndex;
    const count = to - from + 1;
    return `${formatCompactDate(ordered[from].date)} – ${formatCompactDate(ordered[to].date)} · ${count} ${count === 1 ? 'game' : 'games'}`;
  }

  function syncControls(state) {
    frameState = state;
    const dynamic = state?.mode === 'dynamic';
    staticButton.setAttribute('aria-pressed', dynamic ? 'false' : 'true');
    dynamicButton.setAttribute('aria-pressed', dynamic ? 'true' : 'false');
    transport.hidden = !dynamic;
    playButton.disabled = !dynamic || state.playing || ordered.length < 2;
    pauseButton.disabled = !dynamic || !state.playing;
    restartButton.disabled = !dynamic || ordered.length < 2;
    prevButton.disabled = !dynamic || (state.landed ?? state.index) <= state.from;
    nextButton.disabled = !dynamic || (state.landed ?? state.index) >= state.to;
    frameLabel.replaceChildren();
    if (!dynamic) {
      frameLabel.textContent = 'All games in the selected range';
    } else {
      const shown = state.landed ?? state.index;
      const game = state.games[shown];
      const opponent = game?.opponent?.name ?? game?.opponent?.short;
      const place = `${shown - state.from + 1}/${state.to - state.from + 1}`;
      frameLabel.append(
        `${state.playing ? 'Playing' : 'Paused'} · ${place}`,
        game ? createGameMark(game) : '',
        [
          game ? formatCompactDate(game.date) : null,
          opponent ? `vs ${opponent}` : null,
        ].filter(Boolean).join(' · '),
      );
    }
    windowLabel.textContent = rangeText();
    brushSvg.attr('aria-valuetext', rangeText());
    syncPlayhead();
  }

  function onBrush(event) {
    if (movingBrush || !event.sourceEvent || !playback) return;
    if (event.type === 'start') {
      userBrushing = true;
      return;
    }
    if (!userBrushing || !event.selection || !xIndex) {
      userBrushing = false;
      syncBrush();
      return;
    }
    const [start, end] = windowFromSelection(
      xIndex.invert(event.selection[0]),
      xIndex.invert(event.selection[1]),
      ordered.length,
    );
    playback.setRange(start, end);
    if (event.type === 'end') {
      userBrushing = false;
      syncBrush();
    }
  }

  function playheadAt(state) {
    if (!state || state.mode !== 'dynamic') return null;
    if (state.phase === 'hold' || state.index < state.previous) return state.index;
    return state.previous + (state.index - state.previous) * state.progress;
  }

  function syncPlayhead() {
    const marker = brushSvg.select('.timeline-playhead');
    if (marker.empty() || !xIndex || !frameState) return;
    const at = playheadAt(frameState);
    marker.attr('display', at == null ? 'none' : null);
    if (at == null) return;
    const x = xIndex(at);
    const fromX = xIndex(frameState.from);
    marker.select('rect')
      .attr('x', Math.min(fromX, x))
      .attr('width', Math.max(2, Math.abs(x - fromX)));
    marker.select('line').attr('x1', x).attr('x2', x);
    marker.select('circle').attr('cx', x);
  }

  function syncBrush() {
    if (userBrushing || !xIndex || ordered.length < 2) return;
    const from = frameState?.from ?? 0;
    const to = frameState?.to ?? lastIndex;
    const x0 = xIndex(from);
    const x1 = xIndex(to);
    if (!Number.isFinite(x0) || !Number.isFinite(x1)) return;
    movingBrush = true;
    brushG.call(brush.move, x1 - x0 < 8 ? [x0, x0 + 8] : [x0, x1]);
    movingBrush = false;
  }

  function layoutBrush(width) {
    const height = 36;
    const pad = 10;
    brushSvg.attr('viewBox', `0 0 ${width} ${height}`).attr('width', width).attr('height', height);
    xIndex = d3.scaleLinear().domain([0, Math.max(1, lastIndex)]).range([pad, Math.max(pad + 1, width - pad)]);
    let backdrop = brushSvg.select('.timeline-brush-back');
    if (backdrop.empty()) backdrop = brushSvg.insert('g', '.timeline-brush').attr('class', 'timeline-brush-back');
    backdrop.selectAll('*').remove();
    backdrop.append('line')
      .attr('class', 'timeline-track')
      .attr('x1', xIndex(0))
      .attr('x2', xIndex(lastIndex))
      .attr('y1', height / 2)
      .attr('y2', height / 2);
    const spark = ordered.map((game, index) => {
      const values = ROLE_ORDER.map((role) => roleValue(game, role, 'gold_share')).filter((value) => value != null);
      return values.length ? { index, value: d3.mean(values) } : null;
    }).filter(Boolean);
    if (spark.length > 1) {
      const extent = d3.extent(spark, (point) => point.value);
      const ySpark = d3.scaleLinear()
        .domain(extent[0] === extent[1] ? [extent[0] - 0.05, extent[1] + 0.05] : extent)
        .range([height - 6, 6]);
      backdrop.append('path')
        .attr('class', 'timeline-spark')
        .attr('fill', 'none')
        .attr('d', d3.line().x((point) => xIndex(point.index)).y((point) => ySpark(point.value))(spark));
    }
    brush.extent([[pad, 3], [Math.max(pad + 1, width - pad), height - 3]]);
    brushG.call(brush);
    let marker = brushSvg.select('.timeline-playhead');
    if (marker.empty()) {
      marker = brushSvg.append('g').attr('class', 'timeline-playhead');
      marker.append('rect').attr('y', 4).attr('height', height - 8).attr('rx', 2);
      marker.append('line').attr('y1', 2).attr('y2', height - 2);
      marker.append('circle').attr('cy', height / 2).attr('r', 3.5);
    } else {
      marker.select('rect').attr('height', height - 8);
      marker.select('line').attr('y2', height - 2);
      marker.select('circle').attr('cy', height / 2);
    }
    marker.raise();
    brushWidth = width;
    syncBrush();
    syncPlayhead();
  }

  const observer = new ResizeObserver(() => {
    if (!node.isConnected) {
      observer.disconnect();
      return;
    }
    const width = Math.round(node.clientWidth);
    if (width > 40 && width !== brushWidth) layoutBrush(width);
  });
  observer.observe(node);

  staticButton.addEventListener('click', () => playback?.setMode('static'));
  dynamicButton.addEventListener('click', () => playback?.setMode('dynamic'));
  playButton.addEventListener('click', () => playback?.play());
  pauseButton.addEventListener('click', () => playback?.pause());
  restartButton.addEventListener('click', () => playback?.restart());
  prevButton.addEventListener('click', () => playback?.step(-1));
  nextButton.addEventListener('click', () => playback?.step(1));

  playback?.subscribe((state) => {
    const rangeChanged = !frameState || frameState.from !== state.from || frameState.to !== state.to;
    syncControls(state);
    if (rangeChanged && !userBrushing) syncBrush();
  });

  return node;
}
