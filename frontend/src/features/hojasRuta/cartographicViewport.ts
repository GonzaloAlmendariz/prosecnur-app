export type CartesianSize = {
  width: number;
  height: number;
};

export type CartesianPoint = {
  x: number;
  y: number;
};

export type CartesianBox = CartesianPoint & CartesianSize;

export type CartesianExtent = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export type ContainTransform = {
  scale: number;
  offsetX: number;
  offsetY: number;
  drawWidth: number;
  drawHeight: number;
  logicalWidth: number;
  logicalHeight: number;
};

function isPositiveFinite(value: number) {
  return Number.isFinite(value) && value > 0;
}

export function paddedGeometryViewBox(
  content: CartesianBox,
  frame: CartesianBox,
  paddingRatio = 0.08,
): CartesianBox | null {
  if (
    ![content.x, content.y, frame.x, frame.y].every(Number.isFinite)
    || !isPositiveFinite(content.width)
    || !isPositiveFinite(content.height)
    || !isPositiveFinite(frame.width)
    || !isPositiveFinite(frame.height)
    || !Number.isFinite(paddingRatio)
    || paddingRatio < 0
  ) return null;

  const frameRight = frame.x + frame.width;
  const frameBottom = frame.y + frame.height;
  const contentRight = content.x + content.width;
  const contentBottom = content.y + content.height;
  if (
    content.x < frame.x
    || content.y < frame.y
    || contentRight > frameRight
    || contentBottom > frameBottom
  ) return null;

  const paddingX = content.width * paddingRatio;
  const paddingY = content.height * paddingRatio;
  const x = Math.max(frame.x, content.x - paddingX);
  const y = Math.max(frame.y, content.y - paddingY);
  const right = Math.min(frameRight, contentRight + paddingX);
  const bottom = Math.min(frameBottom, contentBottom + paddingY);
  return { x, y, width: right - x, height: bottom - y };
}

export function paddedGeometryViewBoxFromExtents(
  contents: CartesianExtent[],
  frame: CartesianBox,
  paddingRatio = 0.08,
): CartesianBox | null {
  if (!contents.length) return null;
  const bounds = contents.reduce((box, content) => ({
    minX: Math.min(box.minX, content.minX),
    minY: Math.min(box.minY, content.minY),
    maxX: Math.max(box.maxX, content.maxX),
    maxY: Math.max(box.maxY, content.maxY),
  }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
  return paddedGeometryViewBox({
    x: bounds.minX,
    y: bounds.minY,
    width: bounds.maxX - bounds.minX,
    height: bounds.maxY - bounds.minY,
  }, frame, paddingRatio);
}

export function uniformContainTransform(
  container: CartesianSize,
  logical: CartesianSize,
): ContainTransform | null {
  if (
    !isPositiveFinite(container.width)
    || !isPositiveFinite(container.height)
    || !isPositiveFinite(logical.width)
    || !isPositiveFinite(logical.height)
  ) return null;

  const scale = Math.min(container.width / logical.width, container.height / logical.height);
  const drawWidth = logical.width * scale;
  const drawHeight = logical.height * scale;
  return {
    scale,
    offsetX: (container.width - drawWidth) / 2,
    offsetY: (container.height - drawHeight) / 2,
    drawWidth,
    drawHeight,
    logicalWidth: logical.width,
    logicalHeight: logical.height,
  };
}

export function containerPointToLogical(
  point: CartesianPoint,
  transform: ContainTransform,
): CartesianPoint | null {
  if (
    !Number.isFinite(point.x)
    || !Number.isFinite(point.y)
    || !isPositiveFinite(transform.scale)
    || !isPositiveFinite(transform.logicalWidth)
    || !isPositiveFinite(transform.logicalHeight)
  ) return null;

  const x = (point.x - transform.offsetX) / transform.scale;
  const y = (point.y - transform.offsetY) / transform.scale;
  if (x < 0 || y < 0 || x > transform.logicalWidth || y > transform.logicalHeight) return null;
  return { x, y };
}
