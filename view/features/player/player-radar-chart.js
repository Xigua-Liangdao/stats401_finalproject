import { d3 } from '../../utils/d3.js';
import { h } from '../../utils/dom.js';
import { formatFixed } from '../../utils/formatting.js';
import {
  SPAN_STEP, axisRangeLabel, baselineValue, minimumRadarSpan,
  profileSegments, profileValues, radiusFor,
} from './player-baseline.js';

export { createRadarAxes, displayMax, axisRangeLabel } from './player-baseline.js';

function snapSpan(span) {
  return Number((Math.round(span / SPAN_STEP) * SPAN_STEP).toFixed(2));
}

export function createRadarScaleNote(axes, span = 1) {
  return h('div', { class: 'radar-scale-note' }, [
    h('div', {}, [
      'Dashed baseline: historical same-role means from earlier training games for gold, damage, DPM and vision. ',
      'Impact baseline is 0 (model expectation). Missing values are omitted.',
    ]),
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

  let showBaseline = false;
  let span = 1;

  function hideTip() {
    tooltip.hidden = true;
  }

  function minSpan() {
    return minimumRadarSpan(stats, axes, showBaseline);
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
    const actual = stats[axis.key];
    const baseline = baselineValue(stats, axis.key);
    const rows = [axis.label, `Actual: ${axis.format(actual)}`];
    if (showBaseline) {
      rows.push(`Baseline: ${axis.format(baseline)}`);
      if (Number.isFinite(actual) && baseline != null) {
        const diff = actual - baseline;
        rows.push(`Difference: ${diff > 0 && axis.key !== 'shrunk_impact' ? '+' : ''}${axis.format(diff)}`);
      }
    }
    if (axis.key === 'mean_dpm' && Number.isFinite(stats.mean_expected_dpm)) {
      rows.push(`Model-expected DPM: ${formatFixed(stats.mean_expected_dpm, 1)}`);
    }
    rows.push(`${axisRangeLabel(axis, span)} · ${axis.kind}`);
    tooltip.innerHTML = rows.map((line) => `<div>${line}</div>`).join('');
    tooltip.hidden = false;
    const bounds = stage.getBoundingClientRect();
    tooltip.style.left = `${Math.min(event.clientX - bounds.left + 10, bounds.width - 170)}px`;
    tooltip.style.top = `${Math.max(8, event.clientY - bounds.top - 10)}px`;
  }

  function drawProfile(root, values, center, radius, className, dotRadius) {
    const radii = values.map((value, index) => radiusFor(axes[index], value, span));
    for (const segment of profileSegments(radii)) {
      const points = segment.points.map(({ index, value }) =>
        pointAt(center, radius, index, axes.length, value).join(','),
      ).join(' ');
      if (segment.points.length > 1) {
        const shape = root.append(segment.closed ? 'polygon' : 'polyline')
          .attr('class', className)
          .attr('points', points);
        if (!segment.closed) shape.style('fill', 'none');
      }
      for (const { index, value } of segment.points) {
        const [x, y] = pointAt(center, radius, index, axes.length, value);
        root.append('circle').attr('class', `${className}-point`)
          .attr('cx', x).attr('cy', y).attr('r', dotRadius);
      }
    }
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

    drawProfile(root, profileValues(stats, axes), center, radius, 'radar-actual', 3.2);
    if (showBaseline) {
      drawProfile(root, profileValues(stats, axes, true), center, radius, 'radar-expected', 3.8);
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
    setBaseline(enabled) {
      showBaseline = enabled;
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
