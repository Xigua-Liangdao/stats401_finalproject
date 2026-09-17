import { d3 } from '../../utils/d3.js';
import { h } from '../../utils/dom.js';
import { formatFixed, formatImpact, formatPercent } from '../../utils/formatting.js';

const SPAN_STEP = 0.05;
const SPAN_PAD = 1.04;
const MIN_SPAN_FLOOR = 0.25;

function finiteValues(players, key) {
  return players
    .map((player) => player.stats?.[key])
    .filter((value) => value != null && Number.isFinite(value));
}

function extent(values, fallbackMin, fallbackMax) {
  if (!values.length) return [fallbackMin, fallbackMax];
  return [Math.min(...values), Math.max(...values)];
}

function snapSpan(span) {
  return Number((Math.round(span / SPAN_STEP) * SPAN_STEP).toFixed(2));
}

export function displayMax(axis, span = 1) {
  return axis.min + (axis.max - axis.min) * span;
}

export function axisRangeLabel(axis, span = 1) {
  return `${axis.format(axis.min)}–${axis.format(displayMax(axis, span))}`;
}

export function createRadarAxes(players = []) {
  const dpmValues = [...finiteValues(players, 'mean_dpm'), ...finiteValues(players, 'mean_expected_dpm')];
  const visionValues = finiteValues(players, 'mean_vision_per_minute');
  const impactValues = finiteValues(players, 'shrunk_impact');
  const dpmMax = Math.max(0, ...dpmValues);
  const visionMax = Math.max(0, ...visionValues);
  const [impactMin, impactMax] = extent(impactValues, 0, 0);

  return [
    {
      key: 'mean_gold_share',
      label: 'Gold Share',
      min: 0,
      max: 1,
      kind: 'theoretical',
      rangeLabel: '0–100%',
      format: (value) => formatPercent(value),
    },
    {
      key: 'mean_damage_share',
      label: 'Damage Share',
      min: 0,
      max: 1,
      kind: 'theoretical',
      rangeLabel: '0–100%',
      format: (value) => formatPercent(value),
    },
    {
      key: 'mean_dpm',
      label: 'DPM',
      min: 0,
      max: dpmMax || 1,
      kind: 'observed',
      rangeLabel: `0–${formatFixed(dpmMax || 0, 1)}`,
      format: (value) => formatFixed(value, 1),
    },
    {
      key: 'mean_vision_per_minute',
      label: 'Vision / min',
      min: 0,
      max: visionMax || 1,
      kind: 'observed',
      rangeLabel: `0–${formatFixed(visionMax || 0, 2)}`,
      format: (value) => formatFixed(value, 2),
    },
    {
      key: 'shrunk_impact',
      label: 'Impact',
      min: impactMin,
      max: impactMax === impactMin ? impactMin + 1 : impactMax,
      kind: 'observed',
      rangeLabel: `${formatImpact(impactMin)}–${formatImpact(impactMax)}`,
      format: (value) => formatImpact(value),
      zeroLabel: '0 = on expected DPM',
    },
  ];
}

export function createRadarScaleNote(axes, span = 1) {
  return h('div', { class: 'radar-scale-note' }, [
    h('div', { class: 'radar-scale-note__title coord' }, ['Metric scale · outer ring']),
    h(
      'dl',
      { class: 'radar-scale-note__list' },
      axes.map((axis) =>
        h('div', { class: 'radar-scale-note__row' }, [
          h('dt', {}, [axis.label]),
          h('dd', {}, [
            axisRangeLabel(axis, span),
            ' · ',
            axis.kind,
            axis.zeroLabel ? ` · ${axis.zeroLabel}` : '',
          ]),
        ]),
      ),
    ),
  ]);
}

function radiusFor(axis, value, span = 1) {
  if (value == null || !Number.isFinite(value)) return null;
  const max = displayMax(axis, span);
  if (max === axis.min) return 0;
  return Math.max(0, Math.min(1, (value - axis.min) / (max - axis.min)));
}

function pointAt(center, radius, index, total, value) {
  const angle = -Math.PI / 2 + (Math.PI * 2 * index) / total;
  return [center + Math.cos(angle) * radius * value, center + Math.sin(angle) * radius * value];
}

function polygon(values, center, radius) {
  return values
    .map((value, index) => pointAt(center, radius, index, values.length, value ?? 0))
    .map((point) => point.join(','))
    .join(' ');
}

export function mountPlayerRadar(stage, { stats = {}, axes, onSpanChange } = {}) {
  stage.classList.add('is-mounted');
  stage.replaceChildren();

  const tooltip = document.createElement('div');
  tooltip.className = 'chart-tooltip';
  tooltip.hidden = true;
  const hint = document.createElement('div');
  hint.className = 'radar-zoom-hint coord';
  const svg = d3.create('svg').attr('class', 'chart-svg').attr('role', 'img');
  stage.append(svg.node(), tooltip, hint);

  let showExpected = false;
  let span = 1;

  function hideTip() {
    tooltip.hidden = true;
  }

  function profileValue(axis) {
    return axis.key === 'mean_dpm' ? stats.mean_dpm : stats[axis.key];
  }

  function minSpan() {
    const values = axes.map((axis) => {
      const actual = radiusFor(axis, profileValue(axis), 1);
      const expected =
        showExpected && axis.key === 'mean_dpm' ? radiusFor(axis, stats.mean_expected_dpm, 1) : null;
      return Math.max(actual ?? 0, expected ?? 0);
    });
    const peak = Math.max(0, ...values);
    const floor = Math.min(1, Math.max(peak * SPAN_PAD, MIN_SPAN_FLOOR));
    return Math.min(1, Math.ceil(floor / SPAN_STEP) * SPAN_STEP);
  }

  function clampSpan(next) {
    return Math.min(1, Math.max(minSpan(), snapSpan(next)));
  }

  function notifySpan() {
    onSpanChange?.(span, minSpan());
  }

  function setSpan(next) {
    const clamped = clampSpan(next);
    if (clamped === span) {
      updateHint();
      notifySpan();
      return span;
    }
    span = clamped;
    draw();
    notifySpan();
    return span;
  }

  function updateHint() {
    const pct = Math.round(span * 100);
    const floor = Math.round(minSpan() * 100);
    hint.textContent =
      floor >= 100
        ? `Outer ring at full scale · this player already reaches the rim`
        : `Outer ring = ${pct}% of full scale · zoom in stops at ${floor}% so the profile stays inside`;
  }

  const observer = new ResizeObserver(() => draw());
  observer.observe(stage);

  svg.node().addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      const direction = event.deltaY > 0 ? SPAN_STEP : -SPAN_STEP;
      setSpan(span + direction);
    },
    { passive: false },
  );

  function showTip(event, axis) {
    const rows = [];
    if (axis.key === 'mean_dpm') {
      const actual = stats.mean_dpm;
      const expected = stats.mean_expected_dpm;
      rows.push('DPM');
      rows.push(`Actual: ${axis.format(actual)}`);
      if (expected != null && Number.isFinite(expected)) {
        const diff = actual == null ? null : actual - expected;
        const pct = actual && expected ? (diff / expected) * 100 : null;
        rows.push(`Expected: ${axis.format(expected)}`);
        if (diff != null) {
          let difference = `Difference: ${diff >= 0 ? '+' : ''}${formatFixed(diff, 1)}`;
          if (pct != null && Number.isFinite(pct)) difference += ` (${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%)`;
          rows.push(difference);
        }
      }
    } else {
      rows.push(axis.label);
      rows.push(axis.format(stats[axis.key]));
    }
    rows.push(`${axisRangeLabel(axis, span)} · ${axis.kind}`);
    tooltip.innerHTML = rows.map((line) => `<div>${line}</div>`).join('');
    tooltip.hidden = false;
    const bounds = stage.getBoundingClientRect();
    tooltip.style.left = `${Math.min(event.clientX - bounds.left + 10, bounds.width - 170)}px`;
    tooltip.style.top = `${Math.max(8, event.clientY - bounds.top - 10)}px`;
  }

  function profileRadii(dpmValue) {
    return axes.map((axis) => radiusFor(axis, axis.key === 'mean_dpm' ? dpmValue : stats[axis.key], span));
  }

  function draw() {
    const width = stage.clientWidth;
    const height = Math.max(stage.clientHeight, 260);
    if (width < 40) return;
    svg.attr('viewBox', `0 0 ${width} ${height}`).attr('width', width).attr('height', height);
    svg.selectAll('*').remove();
    updateHint();

    const hasAny = axes.some((axis) => stats[axis.key] != null && Number.isFinite(stats[axis.key]));
    if (!hasAny) {
      svg.append('text')
        .attr('class', 'chart-empty')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .text('No profile statistics available.');
      return;
    }

    const size = Math.min(width, height);
    const center = size / 2;
    const radius = size / 2 - 64;
    const offsetX = (width - size) / 2;
    const offsetY = (height - size) / 2;
    const root = svg.append('g').attr('transform', `translate(${offsetX},${offsetY})`);

    for (const ring of [0.25, 0.5, 0.75, 1]) {
      root.append('polygon')
        .attr('class', 'radar-grid')
        .attr('points', polygon(axes.map(() => ring), center, radius));
    }

    const impactAxis = axes.find((axis) => axis.key === 'shrunk_impact');
    const impactIndex = axes.findIndex((axis) => axis.key === 'shrunk_impact');
    const zeroRadius = impactAxis ? radiusFor(impactAxis, 0, span) : null;
    if (zeroRadius != null && zeroRadius > 0 && zeroRadius < 1) {
      root.append('polygon')
        .attr('class', 'radar-zero')
        .attr('points', polygon(axes.map(() => zeroRadius), center, radius));
      const [zx, zy] = pointAt(center, radius, impactIndex, axes.length, zeroRadius);
      root.append('text')
        .attr('class', 'radar-zero-label')
        .attr('x', zx)
        .attr('y', zy)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .text('0');
    }

    axes.forEach((axis, index) => {
      const [x, y] = pointAt(center, radius, index, axes.length, 1);
      root.append('line')
        .attr('class', 'radar-axis')
        .attr('x1', center)
        .attr('y1', center)
        .attr('x2', x)
        .attr('y2', y);
      const [lx, ly] = pointAt(center, radius + 28, index, axes.length, 1);
      const label = root.append('text')
        .attr('class', 'radar-label')
        .attr('x', lx)
        .attr('y', ly)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle');
      label.append('tspan').attr('x', lx).attr('dy', '-0.35em').text(axis.label);
      label.append('tspan')
        .attr('class', 'radar-range')
        .attr('x', lx)
        .attr('dy', '1.2em')
        .text(axisRangeLabel(axis, span));
    });

    const actual = profileRadii(stats.mean_dpm);
    const expectedValue = stats.mean_expected_dpm;
    const hasExpected = expectedValue != null && Number.isFinite(expectedValue);

    root.append('polygon')
      .attr('class', 'radar-actual')
      .attr('points', polygon(actual, center, radius));

    actual.forEach((value, index) => {
      if (value == null) return;
      const [x, y] = pointAt(center, radius, index, axes.length, value);
      root.append('circle').attr('class', 'radar-actual-point').attr('cx', x).attr('cy', y).attr('r', 3.2);
    });

    if (showExpected && hasExpected) {
      const expected = profileRadii(expectedValue);
      root.append('polygon')
        .attr('class', 'radar-expected')
        .attr('points', polygon(expected, center, radius));
      expected.forEach((value, index) => {
        if (value == null) return;
        const [x, y] = pointAt(center, radius, index, axes.length, value);
        root.append('circle').attr('class', 'radar-expected-point').attr('cx', x).attr('cy', y).attr('r', 3.8);
      });
    }

    root.append('circle')
      .attr('class', 'radar-hit')
      .attr('cx', center)
      .attr('cy', center)
      .attr('r', radius + 28)
      .on('mousemove', (event) => {
        const [mx, my] = d3.pointer(event, root.node());
        const angle = Math.atan2(my - center, mx - center);
        const fromTop = (angle + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2);
        const index = Math.round(fromTop / ((Math.PI * 2) / axes.length)) % axes.length;
        showTip(event, axes[index]);
      })
      .on('mouseleave', hideTip);
  }

  draw();
  notifySpan();

  return {
    setExpected(enabled) {
      showExpected = enabled;
      span = clampSpan(span);
      draw();
      notifySpan();
    },
    zoomIn() {
      setSpan(span - SPAN_STEP);
    },
    zoomOut() {
      setSpan(span + SPAN_STEP);
    },
    resetZoom() {
      setSpan(1);
    },
    destroy() {
      observer.disconnect();
    },
  };
}
