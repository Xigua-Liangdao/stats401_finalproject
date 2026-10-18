// Chart sizes shared by more than one view. The 280px stage height and the
// 640px phone query in CSS use the same values.

export const PHONE_MEDIA = '(max-width: 640px)';

export const CHART_MIN_WIDTH = 40;
export const CHART_MIN_HEIGHT = 280;

export const AXIS_TICKS = 5;
export const COARSE_AXIS_TICKS = 4;
export const AXIS_EPSILON = 1e-6;
export const SPAN_EPSILON = 1e-9;
export const PAN_DRAG_PX = 4;
export const FULL_SPAN = 1;
export const AXIS_TURN_DEG = -90;
export const VERTICAL_LABEL = `rotate(${AXIS_TURN_DEG})`;

export const TOOLTIP_RESERVE = 160;
export const TOOLTIP_RESERVE_WIDE = 180;

const TOOLTIP_OFFSET_X = 12;
const TOOLTIP_OFFSET_Y = 12;
const TOOLTIP_MIN_TOP = 8;

export function placeTooltip(tooltip, event, host, reserve, offsets) {
  const offsetX = offsets?.x ?? TOOLTIP_OFFSET_X;
  const offsetY = offsets?.y ?? TOOLTIP_OFFSET_Y;
  const minTop = offsets?.minTop ?? TOOLTIP_MIN_TOP;
  const bounds = host.getBoundingClientRect();
  tooltip.style.left = `${Math.min(event.clientX - bounds.left + offsetX, bounds.width - reserve)}px`;
  tooltip.style.top = `${Math.max(minTop, event.clientY - bounds.top - offsetY)}px`;
}

export const SHARE_DOT_RADIUS = 5.6;
export const SHARE_DOMAIN_FLOOR = 0.2;

export const RADAR_GRID_RINGS = [0.25, 0.75, 1];
export const RADAR_INSET = 64;
export const RADAR_LABEL_PAD = 28;
export const RADAR_POINT_RADIUS = 3.2;
export const RADAR_LABEL_DY = '-0.35em';
export const RADAR_RANGE_DY = '1.2em';

export const BRUSH_HEIGHT = 36;
export const BRUSH_PAD = 10;
export const BRUSH_EDGE = 3;
export const BRUSH_MIN_SPAN = 1;
export const SPARK_INSET = 6;
