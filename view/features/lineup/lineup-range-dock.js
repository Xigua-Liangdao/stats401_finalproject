import { ROLE_ORDER } from '../../utils/constants.js';
import { d3 } from '../../utils/d3.js';
import { h } from '../../utils/dom.js';
import { formatCompactDate, formatResult } from '../../utils/formatting.js';
import { t } from '../../utils/i18n.js';
import { trackUi } from '../../utils/track.js';
import { roleValue } from './lineup-playback.js';

function sideKey(side) {
  const value = String(side ?? '').toLowerCase();
  if (value === 'blue' || value === 'red') return value;
  return '';
}

export function createGameMark(game) {
  const won = game?.result === 1;
  const lost = game?.result === 0;
  const result = formatResult(game?.result);
  const side = sideKey(game?.side);
  const sideLabel = side === 'blue' ? t('side.blue') : side === 'red' ? t('side.red') : '';
  const outcome = won ? t('result.win') : lost ? t('result.loss') : '';
  return h('span', {
    class: `game-mark${side ? ` game-mark--${side}` : ''}`,
    'aria-label': [sideLabel ? t('side.named', { side: sideLabel }) : null, outcome].filter(Boolean).join(', ') || undefined,
  }, [
    h('span', {
      class: `game-mark__result${won ? ' is-win' : lost ? ' is-loss' : ''}`,
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
  }, [t('lineup.static')]);
  const dynamicButton = h('button', {
    class: 'radar-zoom-btn', type: 'button', 'aria-pressed': 'false',
  }, [t('lineup.dynamic')]);
  const playButton = h('button', { class: 'radar-zoom-btn', type: 'button' }, [t('lineup.play')]);
  const pauseButton = h('button', { class: 'radar-zoom-btn', type: 'button' }, [t('lineup.pause')]);
  const restartButton = h('button', { class: 'radar-zoom-btn', type: 'button' }, [t('lineup.restart')]);
  const prevButton = h('button', {
    class: 'radar-zoom-btn', type: 'button', 'aria-label': t('lineup.previous'),
  }, ['←']);
  const nextButton = h('button', {
    class: 'radar-zoom-btn', type: 'button', 'aria-label': t('lineup.next'),
  }, ['→']);
  const transport = h('div', {
    class: 'lineup-transport', role: 'group', 'aria-label': t('common.playback'), hidden: true,
  }, [playButton, pauseButton, restartButton, prevButton, nextButton]);
  const brushSvg = d3.create('svg')
    .attr('class', 'timeline-brush-svg')
    .attr('role', 'slider')
    .attr('aria-label', t('lineup.gameRange'))
    .attr('aria-orientation', 'horizontal');
  const node = h('div', { class: 'lineup-shared-dock panel' }, [
    h('div', { class: 'lineup-shared-dock__bar' }, [
      h('div', { class: 'lineup-transport', role: 'group', 'aria-label': t('lineup.chartMode') }, [
        staticButton,
        dynamicButton,
      ]),
      transport,
      h('div', { class: 'lineup-shared-dock__labels' }, [frameLabel, windowLabel]),
    ]),
    brushSvg.node(),
    h('p', { class: 'lineup-axis-note' }, [t('lineup.meanLine')]),
  ]);

  let frameState = null;
  let userBrushing = false;
  let movingBrush = false;
  let brushGesture = null;
  let brushWidth = 0;
  let xIndex = null;
  const brush = d3.brushX().on('start brush end', onBrush);
  const brushG = brushSvg.append('g').attr('class', 'timeline-brush');

  function rangeText() {
    if (!ordered.length) return t('common.noGames');
    const from = frameState?.from ?? 0;
    const to = frameState?.to ?? lastIndex;
    const count = to - from + 1;
    return t('lineup.rangeSummary', {
      start: formatCompactDate(ordered[from].date),
      end: formatCompactDate(ordered[to].date),
      count,
      unit: count === 1 ? t('common.game') : t('common.gamesWord'),
    });
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
      frameLabel.textContent = t('lineup.allInRange');
    } else {
      const shown = state.landed ?? state.index;
      const game = state.games[shown];
      const opponent = game?.opponent?.name ?? game?.opponent?.short;
      const place = `${shown - state.from + 1}/${state.to - state.from + 1}`;
      frameLabel.append(
        `${state.playing ? t('lineup.playing') : t('lineup.paused')} · ${place}`,
        game ? createGameMark(game) : '',
        [
          game ? formatCompactDate(game.date) : null,
          opponent ? t('lineup.vs', { name: opponent }) : null,
        ].filter(Boolean).join(' · '),
      );
    }
    windowLabel.textContent = rangeText();
    brushSvg.attr('aria-valuetext', rangeText());
    syncPlayhead();
  }

  function trackAxis(gesture) {
    const nextFrom = frameState?.from ?? 0;
    const nextTo = frameState?.to ?? lastIndex;
    if (!gesture || (gesture.from === nextFrom && gesture.to === nextTo)) return;
    const targetType = gesture.mode === 'drag'
      ? 'axis_move'
      : gesture.mode === 'handle' ? 'axis_resize' : null;
    if (!targetType) return;
    const metadata = {
      from: { start: gesture.from, end: gesture.to },
      to: { start: nextFrom, end: nextTo },
    };
    if (targetType === 'axis_resize') {
      const startMoved = gesture.from !== nextFrom;
      const endMoved = gesture.to !== nextTo;
      metadata.edge = startMoved && endMoved ? 'both' : startMoved ? 'start' : 'end';
    }
    trackUi({
      event_name: 'filter_change',
      target_type: targetType,
      target_id: 'lineup-range',
      metadata,
    });
  }

  function onBrush(event) {
    if (movingBrush || !event.sourceEvent || !playback) return;
    if (event.type === 'start') {
      userBrushing = true;
      brushGesture = {
        mode: event.mode,
        from: frameState?.from ?? 0,
        to: frameState?.to ?? lastIndex,
      };
      return;
    }
    if (!userBrushing || !event.selection || !xIndex) {
      userBrushing = false;
      brushGesture = null;
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
      const gesture = brushGesture;
      brushGesture = null;
      userBrushing = false;
      syncBrush();
      trackAxis(gesture);
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

  function trackPlayback(targetId) {
    trackUi({
      event_name: 'click',
      target_type: 'playback_control',
      target_id: `lineup-range|${targetId}`,
    });
  }

  staticButton.addEventListener('click', () => {
    if ((frameState?.mode ?? 'static') !== 'static') trackPlayback('static');
    playback?.setMode('static');
  });
  dynamicButton.addEventListener('click', () => {
    if (frameState?.mode !== 'dynamic') trackPlayback('dynamic');
    playback?.setMode('dynamic');
  });
  playButton.addEventListener('click', () => {
    trackPlayback('play');
    playback?.play();
  });
  pauseButton.addEventListener('click', () => {
    trackPlayback('pause');
    playback?.pause();
  });
  restartButton.addEventListener('click', () => {
    trackPlayback('restart');
    playback?.restart();
  });
  prevButton.addEventListener('click', () => {
    trackPlayback('previous');
    playback?.step(-1);
  });
  nextButton.addEventListener('click', () => {
    trackPlayback('next');
    playback?.step(1);
  });

  playback?.subscribe((state) => {
    const rangeChanged = !frameState || frameState.from !== state.from || frameState.to !== state.to;
    syncControls(state);
    if (rangeChanged && !userBrushing) syncBrush();
  });

  return node;
}
