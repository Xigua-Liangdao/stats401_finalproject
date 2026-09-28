import { d3 } from '../../utils/d3.js';
import { h } from '../../utils/dom.js';
import { t } from '../../utils/i18n.js';
import {
  BASELINE_RADIUS, axisRangeLabel, baselineValue,
  predictedValue, profileSegments, profileValues, radiusFor,
} from './player-baseline.js';

export { createRadarAxes, axisRangeLabel } from './player-baseline.js';

export function createRadarScaleNote(axes, span = 1) {
  return h('div', { class: 'radar-scale-note' }, [
    h('div', {}, [t('radar.note')]),
    h('div', { class: 'radar-scale-note__title coord' }, [t('radar.window')]),
    h(
      'dl',
      { class: 'radar-scale-note__list' },
      axes.map((axis) =>
        h('div', { class: 'radar-scale-note__row' }, [
          h('dt', {}, [axis.label]),
          h('dd', {}, [axisRangeLabel(axis, span), t('radar.fromBaseline')]),
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

export function mountPlayerRadar(stage, { stats = {}, axes } = {}) {
  stage.classList.add('is-mounted');
  stage.replaceChildren();

  const tooltip = document.createElement('div');
  tooltip.className = 'chart-tooltip';
  tooltip.hidden = true;
  const svg = d3.create('svg').attr('class', 'chart-svg').attr('role', 'img');
  stage.append(svg.node(), tooltip);

  let showBaseline = false;
  let showPredicted = false;
  const span = 1;
  const hasActual = profileValues(stats, axes).some(Number.isFinite);
  const hasBaseline = profileValues(stats, axes, true).some(Number.isFinite);

  function hideTip() {
    tooltip.hidden = true;
  }

  const observer = new ResizeObserver(() => draw());
  observer.observe(stage);

  function showTip(event, axis) {
    const actual = stats[axis.key];
    const baseline = baselineValue(stats, axis.key);
    const rows = [axis.label, t('radar.actual', { value: axis.format(actual) })];
    if (baseline != null) {
      rows.push(t('radar.baseline', { value: axis.format(baseline) }));
      if (Number.isFinite(actual)) {
        const diff = actual - baseline;
        rows.push(t('radar.difference', {
          value: `${diff > 0 && axis.key !== 'shrunk_impact' ? '+' : ''}${axis.format(diff)}`,
        }));
      }
    }
    const predicted = predictedValue(stats, axis.key);
    if (showPredicted && predicted != null) rows.push(t('radar.predicted', { value: axis.format(predicted) }));
    rows.push(t('radar.windowFrom', { range: axisRangeLabel(axis, span) }));
    tooltip.innerHTML = rows.map((line) => `<div>${line}</div>`).join('');
    tooltip.hidden = false;
    const bounds = stage.getBoundingClientRect();
    tooltip.style.left = `${Math.min(event.clientX - bounds.left + 10, bounds.width - 170)}px`;
    tooltip.style.top = `${Math.max(8, event.clientY - bounds.top - 10)}px`;
  }

  function drawProfile(root, values, center, radius, className, dotRadius) {
    const radii = values.map((value, index) => (
      radiusFor(axes[index], value, baselineValue(stats, axes[index].key), span)
    ));
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

    if (!hasActual && !(showBaseline && hasBaseline)) {
      svg.append('text')
        .attr('class', 'chart-empty')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .text(t('chart.noProfile'));
      return;
    }

    const size = Math.min(width, height);
    const center = size / 2;
    const radius = size / 2 - 64;
    const offsetX = (width - size) / 2;
    const offsetY = (height - size) / 2;
    const root = svg.append('g').attr('transform', `translate(${offsetX},${offsetY})`);

    for (const ring of [0.25, 0.75, 1]) {
      root.append('polygon')
        .attr('class', 'radar-grid')
        .attr('points', polygon(axes.map(() => ring), center, radius));
    }
    if (!showBaseline) {
      root.append('polygon')
        .attr('class', 'radar-grid')
        .attr('points', polygon(axes.map(() => BASELINE_RADIUS), center, radius));
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

    if (showBaseline) {
      root.append('polygon')
        .attr('class', 'radar-baseline')
        .attr('points', polygon(axes.map(() => BASELINE_RADIUS), center, radius));
    }
    drawProfile(root, profileValues(stats, axes), center, radius, 'radar-actual', 3.2);
    if (showPredicted) axes.forEach((axis, index) => {
      const value = radiusFor(
        axis,
        predictedValue(stats, axis.key),
        baselineValue(stats, axis.key),
        span,
      );
      if (value == null) return;
      const [x, y] = pointAt(center, radius, index, axes.length, value);
      root.append('circle')
        .attr('class', 'radar-predicted-point')
        .attr('cx', x)
        .attr('cy', y)
        .attr('r', 4.2);
    });

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

  return {
    setBaseline(enabled) {
      showBaseline = enabled;
      draw();
    },
    setPredicted(enabled) {
      showPredicted = enabled;
      draw();
    },
    destroy() {
      observer.disconnect();
    },
  };
}
