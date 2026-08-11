import type { ArgMetadata } from "../../api/client";

export type LayoutMeasureBasis =
  | "ratio-partition"
  | "fixed-inch"
  | "nested-inch"
  | "per-category-inch"
  | "measure-only";

export type LayoutMeasureContract = {
  axis: "x" | "y";
  unitLabel: string;
  basis: LayoutMeasureBasis;
  partition: string | null;
  canShare: boolean;
};

type LayoutTrack = {
  name: string;
};

const BAR_HORIZONTAL_RATIO_FIELDS = new Set([
  "canvas_w_grupo",
  "canvas_w_buf_grupo_etq",
  "canvas_w_etiquetas",
  "canvas_w_buf_etq_bars",
  "canvas_w_bars",
  "canvas_w_buf_bars_extra",
  "canvas_w_extra",
]);

const FIXED_INCH_FIELDS = new Set([
  "canvas_h_header_in",
  "canvas_h_legend_in",
  "canvas_h_caption_in",
]);

export function resolveLayoutMeasureContract(
  name: string,
  meta: ArgMetadata | undefined
): LayoutMeasureContract {
  const axis = resolveMeasureAxis(name);
  const publishedUnit = String(meta?.unidad ?? "").trim();

  if (BAR_HORIZONTAL_RATIO_FIELDS.has(name) && isRatioUnit(publishedUnit)) {
    return {
      axis: "x",
      unitLabel: "proporción",
      basis: "ratio-partition",
      partition: "bars-horizontal",
      canShare: true,
    };
  }

  if (name === "alto_por_categoria") {
    return {
      axis: "y",
      unitLabel: "pulgadas por categoría",
      basis: "per-category-inch",
      partition: null,
      canShare: false,
    };
  }

  if (name === "canvas_h_toprow_in") {
    return {
      axis: "y",
      unitLabel: publishedUnit || "pulgadas",
      basis: "nested-inch",
      partition: null,
      canShare: false,
    };
  }

  if (FIXED_INCH_FIELDS.has(name) && isInchUnit(publishedUnit)) {
    return {
      axis: "y",
      unitLabel: publishedUnit,
      basis: "fixed-inch",
      partition: null,
      canShare: false,
    };
  }

  return {
    axis,
    // Sin unidad declarada no se inventa una: se calla. «Unidad no publicada»
    // era vocabulario del registro asomando en la cara del analista.
    unitLabel: publishedUnit,
    basis: "measure-only",
    partition: null,
    canShare: false,
  };
}

export function canShareLayoutMeasurePair(
  first: LayoutMeasureContract,
  second: LayoutMeasureContract
): boolean {
  return Boolean(
    first.canShare &&
      second.canShare &&
      first.partition &&
      first.partition === second.partition &&
      first.axis === second.axis &&
      first.unitLabel === second.unitLabel &&
      first.basis === second.basis
  );
}

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

export type ResolvedLayoutPair = {
  total: number;
  primaryMin: number;
  primaryMax: number;
};

export function resolveLayoutPair(
  values: readonly [number, number],
  leftMeta: ArgMetadata | undefined,
  rightMeta: ArgMetadata | undefined
): ResolvedLayoutPair | null {
  if (!leftMeta || !rightMeta) return null;

  const [leftValue, rightValue] = values;
  const { min: leftMin, max: leftMax } = leftMeta;
  const { min: rightMin, max: rightMax } = rightMeta;
  if (
    !Number.isFinite(leftValue) ||
    !Number.isFinite(rightValue) ||
    typeof leftMin !== "number" ||
    !Number.isFinite(leftMin) ||
    typeof leftMax !== "number" ||
    !Number.isFinite(leftMax) ||
    typeof rightMin !== "number" ||
    !Number.isFinite(rightMin) ||
    typeof rightMax !== "number" ||
    !Number.isFinite(rightMax) ||
    leftMin > leftMax ||
    rightMin > rightMax ||
    leftValue < leftMin ||
    leftValue > leftMax ||
    rightValue < rightMin ||
    rightValue > rightMax
  ) {
    return null;
  }

  const total = leftValue + rightValue;
  if (!Number.isFinite(total) || total <= 0) return null;

  const primaryMin = Math.max(leftMin, total - rightMax);
  const primaryMax = Math.min(leftMax, total - rightMin);
  if (
    !Number.isFinite(primaryMin) ||
    !Number.isFinite(primaryMax) ||
    primaryMin > primaryMax ||
    leftValue < primaryMin ||
    leftValue > primaryMax
  ) {
    return null;
  }

  return { total, primaryMin, primaryMax };
}

export function adjustLayoutPairByArrowKey(
  key: string,
  values: readonly [number, number],
  leftMeta: ArgMetadata | undefined,
  rightMeta: ArgMetadata | undefined
): [number, number] | null {
  const resolution = resolveLayoutPair(values, leftMeta, rightMeta);
  if (
    (key !== "ArrowLeft" && key !== "ArrowRight") ||
    !resolution ||
    !leftMeta ||
    !rightMeta
  ) {
    return null;
  }

  const step = leftMeta.step;
  const [leftValue] = values;
  if (
    typeof step !== "number" ||
    !Number.isFinite(step) ||
    step <= 0
  ) {
    return null;
  }

  const direction = key === "ArrowRight" ? 1 : -1;
  return clampPairByMeta(
    leftValue + direction * step,
    resolution.total,
    leftMeta,
    rightMeta
  );
}

export function resolveLayoutEscapePolicy(
  _scope: "transaction" | "input",
  active: boolean
): {
  preventDefault: true;
  stopPropagation: true;
  cancel: true;
  invokeCallback: false;
  blur: false;
  preserveFocus: true;
} | null {
  if (!active) return null;
  return {
    preventDefault: true,
    stopPropagation: true,
    cancel: true,
    invokeCallback: false,
    blur: false,
    preserveFocus: true,
  };
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

function resolveMeasureAxis(name: string): "x" | "y" {
  if (name === "tabla_ph_margin_top" || name === "tabla_ph_margin_bot") return "y";
  if (name.includes("_w_") || name.endsWith("_ancho") || name === "tabla_ph_gap") return "x";
  return "y";
}

function normalizeUnit(unit: string): string {
  return unit
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function isRatioUnit(unit: string): boolean {
  return ["proporcion", "fraccion", "ratio"].includes(normalizeUnit(unit));
}

function isInchUnit(unit: string): boolean {
  return ["pulgada", "pulgadas", "in", "inch", "inches"].includes(normalizeUnit(unit));
}
