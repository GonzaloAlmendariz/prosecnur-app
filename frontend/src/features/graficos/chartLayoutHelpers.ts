import type { ArgMetadata } from "../../api/client";

type LayoutTrack = {
  name: string;
};

export function clampByMeta(value: number, meta: ArgMetadata | undefined): number {
  if (!Number.isFinite(value)) return 0;
  const min = typeof meta?.min === "number" ? meta.min : 0;
  const max = typeof meta?.max === "number" ? meta.max : Number.POSITIVE_INFINITY;
  return Number(Math.max(min, Math.min(max, value)).toFixed(3));
}

export function clampPairByMeta(
  leftValue: number,
  total: number,
  leftMeta: ArgMetadata | undefined,
  rightMeta: ArgMetadata | undefined
): [number, number] {
  const leftBounds = boundsForMeta(leftMeta);
  const rightBounds = boundsForMeta(rightMeta);
  const safeTotal = Number.isFinite(total) && total > 0 ? total : 1;
  const leftMin = Math.max(leftBounds.min, safeTotal - rightBounds.max);
  const leftMax = Math.min(leftBounds.max, safeTotal - rightBounds.min);
  const left = Number(Math.max(leftMin, Math.min(leftMax, leftValue)).toFixed(3));
  const right = Number(Math.max(rightBounds.min, Math.min(rightBounds.max, safeTotal - left)).toFixed(3));
  return [left, right];
}

export function buildGridTracks(fields: LayoutTrack[], valueOf: (name: string) => number): string {
  const values = fields.map((field) => Math.max(0, valueOf(field.name)));
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return fields.map(() => "minmax(0, 1fr)").join(" ");
  return values
    .map((value) => `minmax(0, ${value <= 0 ? 0 : (value / total) * 100}%)`)
    .join(" ");
}

export function flexTrackStyle(value: number, isGap = false): { flex: string; minWidth: number; minHeight: number } {
  const numericValue = Math.max(0, value);
  const flexValue = isGap ? numericValue : (numericValue > 0 ? numericValue : 0.001);
  return {
    flex: `${Math.max(0, flexValue)} 1 0`,
    minWidth: 0,
    minHeight: 0,
  };
}

function boundsForMeta(meta: ArgMetadata | undefined): { min: number; max: number } {
  return {
    min: typeof meta?.min === "number" ? meta.min : 0,
    max: typeof meta?.max === "number" ? meta.max : Number.POSITIVE_INFINITY,
  };
}
