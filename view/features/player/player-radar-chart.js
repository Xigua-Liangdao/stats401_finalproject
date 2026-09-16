import { d3 } from '../../utils/d3.js';
import { formatFixed, formatImpact, formatPercent } from '../../utils/formatting.js';

const AXES = [
  { key: 'mean_gold_share', label: 'Gold Share', format: (value) => formatPercent(value) },
  { key: 'mean_damage_share', label: 'Damage Share', format: (value) => formatPercent(value) },
  { key: 'mean_dpm', label: 'DPM', format: (value) => formatFixed(value, 1) },
  { key: 'mean_vision_per_minute', label: 'Vision / Minute', format: (value) => formatFixed(value, 2) },
  { key: 'shrunk_impact', label: 'Impact', format: (value) => formatImpact(value) },
];

function domainsFor(stats) {
  const dpmMax = Math.max(900, stats.mean_dpm ?? 0, stats.mean_expected_dpm ?? 0) * 1.15;
  return {
    mean_gold_share: [0, 0.4],
    mean_damage_share: [0, 0.45],
    mean_dpm: [0, dpmMax || 900],
    mean_vision_per_minute: [0, 4],
    shrunk_impact: [-0.3, 0.3],
  };
}

function radiusFor(key, value, domains) {
  if (value == null || !Number.isFinite(value)) return null;
  const [min, max] = domains[key];
  if (max === min) return 0;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
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

export function mountPlayerRadar(stage, { stats = {} }) {
  stage.classList.add('is-mounted');
  stage.replaceChildren();

  const tooltip = document.createElement('div');
  tooltip.className = 'chart-tooltip';
  tooltip.hidden = true;
  const svg = d3.create('svg').attr('class', 'chart-svg').attr('role', 'img');
  stage.append(svg.node(), tooltip);

  let showExpected = false;
  const observer = new ResizeObserver(() => draw());
  observer.observe(stage);

  function hideTip() {
    tooltip.hidden = true;
  }

  function showTip(event, axis) {
    const rows = [];
    if (axis.key === 'mean_dpm') {
      const actual = stats.mean_dpm;
      const expected = stats.mean_expected_dpm;
      rows.push(`DPM`);
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
    tooltip.innerHTML = rows.map((line) => `<div>${line}</div>`).join('');
    tooltip.hidden = false;
    const bounds = stage.getBoundingClientRect();
    tooltip.style.left = `${Math.min(event.clientX - bounds.left + 10, bounds.width - 170)}px`;
    tooltip.style.top = `${Math.max(8, event.clientY - bounds.top - 10)}px`;
  }

  function profileRadii(dpmValue, domains) {
    return AXES.map((axis) =>
      radiusFor(axis.key, axis.key === 'mean_dpm' ? dpmValue : stats[axis.key], domains),
    );
  }

  function draw() {
    const width = stage.clientWidth;
    const height = Math.max(stage.clientHeight, 260);
    if (width < 40) return;
    svg.attr('viewBox', `0 0 ${width} ${height}`).attr('width', width).attr('height', height);
    svg.selectAll('*').remove();

    const hasAny = AXES.some((axis) => stats[axis.key] != null && Number.isFinite(stats[axis.key]));
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
    const radius = size / 2 - 36;
    const offsetX = (width - size) / 2;
    const offsetY = (height - size) / 2;
    const root = svg.append('g').attr('transform', `translate(${offsetX},${offsetY})`);
    const domains = domainsFor(stats);
    const rings = [0.25, 0.5, 0.75, 1];

    for (const ring of rings) {
      root.append('polygon')
        .attr('class', 'radar-grid')
        .attr('points', polygon(AXES.map(() => ring), center, radius));
    }

    AXES.forEach((axis, index) => {
      const [x, y] = pointAt(center, radius, index, AXES.length, 1);
      root.append('line')
        .attr('class', 'radar-axis')
        .attr('x1', center)
        .attr('y1', center)
        .attr('x2', x)
        .attr('y2', y);
      const [lx, ly] = pointAt(center, radius + 18, index, AXES.length, 1);
      root.append('text')
        .attr('class', 'radar-label')
        .attr('x', lx)
        .attr('y', ly)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .text(axis.label);
    });

    const actual = profileRadii(stats.mean_dpm, domains);
    const expectedValue = stats.mean_expected_dpm;
    const hasExpected = expectedValue != null && Number.isFinite(expectedValue);

    root.append('polygon')
      .attr('class', 'radar-actual')
      .attr('points', polygon(actual, center, radius));

    actual.forEach((value, index) => {
      if (value == null) return;
      const [x, y] = pointAt(center, radius, index, AXES.length, value);
      root.append('circle')
        .attr('class', 'radar-actual-point')
        .attr('cx', x)
        .attr('cy', y)
        .attr('r', 3.2);
    });

    if (showExpected && hasExpected) {
      const expected = profileRadii(expectedValue, domains);
      root.append('polygon')
        .attr('class', 'radar-expected')
        .attr('points', polygon(expected, center, radius));
      expected.forEach((value, index) => {
        if (value == null) return;
        const [x, y] = pointAt(center, radius, index, AXES.length, value);
        root.append('circle')
          .attr('class', 'radar-expected-point')
          .attr('cx', x)
          .attr('cy', y)
          .attr('r', 3.8);
      });
    }

    root.append('circle')
      .attr('class', 'radar-hit')
      .attr('cx', center)
      .attr('cy', center)
      .attr('r', radius + 22)
      .on('mousemove', (event) => {
        const [mx, my] = d3.pointer(event, root.node());
        const angle = Math.atan2(my - center, mx - center);
        const fromTop = (angle + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2);
        const index = Math.round(fromTop / ((Math.PI * 2) / AXES.length)) % AXES.length;
        showTip(event, AXES[index]);
      })
      .on('mouseleave', hideTip);
  }

  draw();
  return {
    setExpected(enabled) {
      showExpected = enabled;
      draw();
    },
    destroy() {
      observer.disconnect();
    },
  };
}
