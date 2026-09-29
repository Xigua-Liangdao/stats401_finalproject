import { d3 } from '../../utils/d3.js';
import { h } from '../../utils/dom.js';
import { t } from '../../utils/i18n.js';
import { createTooltipWatch } from '../../utils/track.js';
import {
  BASELINE_RADIUS,
  axisRangeLabel,
  baselineValue,
  createRadarAxes,
  profileSegments,
  profileValues,
  radiusFor,
} from '../player/player-baseline.js';

function pointAt(center, radius, index, total, value) {
  const angle = -Math.PI / 2 + (Math.PI * 2 * index) / total;
  return [center + Math.cos(angle) * radius * value, center + Math.sin(angle) * radius * value];
}

function polygon(values, center, radius) {
  return values
    .map((value, index) => pointAt(center, radius, index, values.length, value ?? 0).join(','))
    .join(' ');
}

export function createCompareRadar({ left, right, players }) {
  const axes = createRadarAxes(players?.length ? players : [left, right]);
  const stage = h('div', { class: 'viz-stage compare-radar-stage' });
  const tip = h('div', { class: 'chart-tooltip', hidden: '' });
  stage.append(tip);

  queueMicrotask(() => {
    if (stage.isConnected) mount(stage, tip, { left, right, axes });
  });

  return h('article', { class: 'panel compare-radar' }, [
    h('div', { class: 'viz-placeholder__chrome' }, [
      h('div', {}, [
        h('p', { class: 'viz-placeholder__title' }, [t('compare.profile')]),
        h('p', { class: 'viz-placeholder__note' }, [t('compare.profileNote')]),
      ]),
    ]),
    h('div', { class: 'compare-radar__legend' }, [
      h('span', { class: 'compare-key compare-key--baseline' }, [t('compare.baseline')]),
      h('span', { class: 'compare-key compare-key--left' }, [left.name]),
      h('span', { class: 'compare-key compare-key--right' }, [right.name]),
    ]),
    stage,
  ]);
}

function mount(stage, tip, { left, right, axes }) {
  stage.classList.add('is-mounted');
  const svg = d3.create('svg')
    .attr('class', 'chart-svg')
    .attr('role', 'img')
    .attr('aria-label', t('compare.aria', { left: left.name, right: right.name }));
  stage.insertBefore(svg.node(), tip);

  const observer = new ResizeObserver(() => draw());
  observer.observe(stage);

  const tooltipWatch = createTooltipWatch('comparison-radar');

  function hideTip() {
    tip.hidden = true;
    tooltipWatch.hide();
  }

  function showTip(event, axis) {
    tooltipWatch.show(`${left.id}|${right.id}|${axis.key}`);
    const lines = [
      axis.label,
      t('compare.leftValue', { name: left.name, value: axis.format(left.stats?.[axis.key]) }),
      t('compare.leftValue', { name: right.name, value: axis.format(right.stats?.[axis.key]) }),
      t('compare.baselineValue', { value: axis.format(baselineValue(left.stats, axis.key)) }),
    ];
    tip.replaceChildren(...lines.map((line) => h('div', {}, [line])));
    tip.hidden = false;
    const bounds = stage.getBoundingClientRect();
    tip.style.left = `${Math.min(event.clientX - bounds.left + 10, Math.max(8, bounds.width - 180))}px`;
    tip.style.top = `${Math.max(8, event.clientY - bounds.top - 10)}px`;
  }

  function drawProfile(root, stats, center, radius, className) {
    const radii = profileValues(stats, axes).map((value, index) => (
      radiusFor(axes[index], value, baselineValue(stats, axes[index].key), 1)
    ));
    for (const segment of profileSegments(radii)) {
      const points = segment.points
        .map(({ index, value }) => pointAt(center, radius, index, axes.length, value).join(','))
        .join(' ');
      if (segment.points.length > 1) {
        const shape = root.append(segment.closed ? 'polygon' : 'polyline')
          .attr('class', className)
          .attr('points', points);
        if (!segment.closed) shape.style('fill', 'none');
      }
      for (const { index, value } of segment.points) {
        const [x, y] = pointAt(center, radius, index, axes.length, value);
        root.append('circle')
          .attr('class', `${className}-point`)
          .attr('cx', x)
          .attr('cy', y)
          .attr('r', 3.2);
      }
    }
  }

  function draw() {
    if (!stage.isConnected) {
      observer.disconnect();
      return;
    }
    const width = stage.clientWidth;
    const height = Math.max(stage.clientHeight, 360);
    if (width < 40) return;
    svg.attr('viewBox', `0 0 ${width} ${height}`).attr('width', width).attr('height', height);
    svg.selectAll('*').remove();

    const size = Math.min(width, height);
    const center = size / 2;
    const radius = size / 2 - 64;
    const root = svg.append('g').attr(
      'transform',
      `translate(${(width - size) / 2},${(height - size) / 2})`,
    );

    for (const ring of [0.25, 0.75, 1]) {
      root.append('polygon')
        .attr('class', 'radar-grid')
        .attr('points', polygon(axes.map(() => ring), center, radius));
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
        .text(axisRangeLabel(axis, 1));
    });

    root.append('polygon')
      .attr('class', 'radar-baseline')
      .attr('points', polygon(axes.map(() => BASELINE_RADIUS), center, radius));
    drawProfile(root, left.stats, center, radius, 'radar-actual');
    drawProfile(root, right.stats, center, radius, 'radar-compare');

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
}
