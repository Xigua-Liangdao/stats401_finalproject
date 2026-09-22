import { d3 } from '../../utils/d3.js';
import { onLoadProgress, setLoadProgress } from '../../utils/load-progress.js';

const CELLS = 5;
const VB_W = 860;
const VB_H = 280;
const SHELL = { x: 8, y: 36, w: 790, h: 208 };
const NUB = { x: 808, y: 96, w: 36, h: 88 };
const PAD_X = 22;
const PAD_Y = 20;
const GAP = 16;
const INNER_W = SHELL.w - PAD_X * 2;
const CELL_W = (INNER_W - GAP * (CELLS - 1)) / CELLS;
const CELL_H = SHELL.h - PAD_Y * 2;
const CELL_X = SHELL.x + PAD_X;
const CELL_Y = SHELL.y + PAD_Y;
const EASE_MS = 220;
const PULSE_MS = 420;
const EXIT_MS = 320;

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function reducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function mountMeter(svg) {
  const root = d3.select(svg)
    .attr('viewBox', `0 0 ${VB_W} ${VB_H}`)
    .attr('aria-hidden', 'true');

  const x = (index) => CELL_X + index * (CELL_W + GAP);
  const indexes = d3.range(CELLS);

  if (root.select('.startup__shell').empty()) {
    root.append('rect')
      .attr('class', 'startup__shell')
      .attr('x', SHELL.x)
      .attr('y', SHELL.y)
      .attr('width', SHELL.w)
      .attr('height', SHELL.h)
      .attr('rx', 3);
    root.append('rect')
      .attr('class', 'startup__nub')
      .attr('x', NUB.x)
      .attr('y', NUB.y)
      .attr('width', NUB.w)
      .attr('height', NUB.h)
      .attr('rx', 2);
    root.append('g')
      .selectAll('rect')
      .data(indexes)
      .join('rect')
      .attr('class', 'startup__slot')
      .attr('x', (index) => x(index))
      .attr('y', CELL_Y)
      .attr('width', CELL_W)
      .attr('height', CELL_H)
      .attr('rx', 1);
  }

  const glow = root.append('defs')
    .append('filter')
    .attr('id', 'startup-glow')
    .attr('x', '-20%')
    .attr('y', '-20%')
    .attr('width', '140%')
    .attr('height', '140%');
  glow.append('feGaussianBlur')
    .attr('in', 'SourceGraphic')
    .attr('stdDeviation', '3.5')
    .attr('result', 'blur');
  const merge = glow.append('feMerge');
  merge.append('feMergeNode').attr('in', 'blur');
  merge.append('feMergeNode').attr('in', 'SourceGraphic');

  const nub = root.select('.startup__nub');

  const fills = root.append('g')
    .attr('filter', 'url(#startup-glow)')
    .selectAll('rect')
    .data(indexes)
    .join('rect')
    .attr('class', 'startup__fill')
    .attr('x', (index) => x(index))
    .attr('width', CELL_W);

  const surface = root.append('rect')
    .attr('class', 'startup__surface')
    .attr('height', 2)
    .attr('width', CELL_W);

  function paint(percent) {
    const level = (percent / 100) * CELLS;
    let edge = null;
    fills.each(function paintFill(index) {
      const amount = Math.max(0, Math.min(1, level - index));
      const height = CELL_H * amount;
      const node = d3.select(this);
      node
        .attr('y', CELL_Y + CELL_H - height)
        .attr('height', Math.max(0, height));
      if (amount >= 0.98) node.classed('is-on', true);
      if (amount > 0.02 && amount < 0.98) {
        edge = { index, height };
      }
    });
    if (!edge && level > 0 && level < CELLS) {
      const index = Math.min(CELLS - 1, Math.floor(level));
      edge = { index, height: CELL_H * (level - index) };
    }
    surface
      .attr('opacity', edge ? 0.95 : 0)
      .attr('x', edge ? x(edge.index) : 0)
      .attr('y', edge ? CELL_Y + CELL_H - edge.height - 1 : 0);
    nub.classed('is-live', percent > 2);
  }

  return { node: root, paint };
}

export function createStartupScreen(root) {
  if (!root) return { async finish() {} };

  const appRoot = document.querySelector('.app-root');
  const percent = root.querySelector('.startup__pct');
  const meter = mountMeter(root.querySelector('.startup__meter'));
  const reduced = reducedMotion();
  let shown = 0;
  let announced = -1;
  let tween = Promise.resolve();
  let settled = false;

  function paint(value) {
    shown = value;
    meter.paint(value);
    const rounded = Math.round(value);
    if (percent) percent.textContent = `${rounded}%`;
    if (rounded !== announced) {
      announced = rounded;
      root.setAttribute('aria-valuenow', String(rounded));
    }
  }

  function apply(target) {
    meter.node.interrupt('load');
    const from = shown;
    if (reduced || Math.abs(target - from) < 0.05) {
      paint(target);
      tween = Promise.resolve();
      return;
    }
    tween = new Promise((resolve) => {
      let done = false;
      const end = () => {
        if (done) return;
        done = true;
        resolve();
      };
      meter.node.transition('load')
        .duration(EASE_MS)
        .ease(d3.easeCubicOut)
        .tween('progress', () => {
          const interpolate = d3.interpolateNumber(from, target);
          return (t) => paint(interpolate(t));
        })
        .on('end', end)
        .on('interrupt', end);
    });
  }

  const stop = onLoadProgress(apply);
  if (shown < 8) setLoadProgress(8);

  return {
    async finish() {
      if (settled) return;
      settled = true;
      setLoadProgress(100);
      await tween;
      if (!root.isConnected) return;
      root.classList.add('is-complete');
      await wait(reduced ? 40 : PULSE_MS);
      if (!root.isConnected) return;

      root.classList.add('is-exiting');
      root.setAttribute('aria-busy', 'false');
      document.body.classList.remove('is-starting');
      appRoot?.removeAttribute('inert');
      await wait(reduced ? 200 : EXIT_MS);
      stop();
      root.remove();
    },
  };
}
