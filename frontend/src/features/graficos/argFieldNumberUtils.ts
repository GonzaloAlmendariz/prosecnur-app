import { ArgMetadata } from "../../api/client";

export type NumberValidationKind = "default" | "warning" | "error";

export function isEmptyNumericLike(value: string): boolean {
  return value.trim().length === 0;
}

export function coerceNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = parseNumberInput(value);
    return parsed;
  }

  return null;
}

export function parseNumberInput(value: string): number | null {
  const normalized = normalizeNumericInput(value);
  if (normalized === "") return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isPartialNumberInput(value: string): boolean {
  const normalized = normalizeNumericInput(value).trim();
  if (normalized.length === 0) return true;
  if (normalized === "+" || normalized === "-" || normalized === "." || normalized === ",") {
    return true;
  }
  if (/^[-+]?(?:\d+\.?)$/.test(normalized)) return false;
  if (/^[-+]?(?:\d*[,\.]?)$/.test(normalized) && /[,.]$/.test(normalized)) {
    return true;
  }
  if (/^[+-]?(\d+([,.]\d*)?|[,.]\d*)$/.test(normalized) && !/[A-Za-z]/.test(normalized)) {
    if (/\d+[,.]$/.test(normalized)) return true;
    if (/^[-+][,.]$/.test(normalized)) return true;
  }
  return false;
}

export function formatNumberInput(value: unknown, scale = 1): string {
  if (value === null || value === undefined || value === "") return "";

  if (typeof value === "number" && Number.isFinite(value)) {
    return normalizeNumberDisplay(value * scale);
  }

  if (typeof value === "string") {
    const parsed = parseNumberInput(value);
    if (parsed === null) return value;
    return normalizeNumberDisplay(parsed * scale);
  }

  return String(value);
}

export function decimalsForStep(step: number): number {
  if (!Number.isFinite(step) || step <= 0) return 0;
  const s = step.toString();
  const dot = s.indexOf(".");
  if (dot < 0) return 0;
  return Math.min(6, s.length - dot - 1);
}

export function inferNumberStep(meta: ArgMetadata, value: unknown): number {
  if (typeof meta.step === "number" && Number.isFinite(meta.step) && meta.step > 0) {
    return meta.step;
  }

  const fromText = typeof value === "string" ? value.trim() : "";
  const decimalMatch = fromText.match(/[.,](\d+)/);
  if (decimalMatch) {
    const decimals = Math.min(6, decimalMatch[1].length);
    return Math.pow(10, -decimals);
  }

  const n = coerceNumber(value);
  const min = typeof meta.min === "number" ? meta.min : undefined;
  const max = typeof meta.max === "number" ? meta.max : undefined;
  const span = typeof min === "number" && typeof max === "number" ? max - min : NaN;
  const unit = String(meta.unidad ?? "").toLowerCase();
  const name = String(meta.name ?? "").toLowerCase();

  if (isProportionThreshold(meta)) return 0.0001;
  if (unit.includes("propor") || name.startsWith("canvas_w_")) return 0.01;
  if (unit.includes("pulgada") || name.endsWith("_in") || name.includes("_in_")) return 0.02;
  if (Number.isFinite(span) && span > 0 && span <= 2) return 0.01;
  if (n !== null && Number.isFinite(n) && Math.abs(n) > 0 && Math.abs(n) < 1) return 0.01;
  if (n !== null && Number.isFinite(n) && !Number.isInteger(n)) return 0.1;

  return 1;
}

function normalizeNumericInput(value: string): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim().replace(/\s+/g, "");
  if (trimmed.length === 0) return "";

  const commaPos = trimmed.lastIndexOf(",");
  const dotPos = trimmed.lastIndexOf(".");
  const hasComma = commaPos >= 0;
  const hasDot = dotPos >= 0;

  if (hasComma && hasDot) {
    const usesCommaDecimal = commaPos > dotPos;
    if (usesCommaDecimal) {
      return trimmed.replace(/\./g, "").replace(/,/g, ".");
    }
    return trimmed.replace(/,/g, "").replace(/\./g, ".");
  }

  if (hasComma) return trimmed.replace(/,/g, ".");
  return trimmed;
}

function normalizeNumberDisplay(value: number): string {
  const fixed = Number(value.toFixed(6));
  return String(fixed);
}

function isProportionThreshold(meta: ArgMetadata): boolean {
  const name = String(meta.name ?? "").toLowerCase();
  return (name.startsWith("umbral_") || name.includes("_umbral_") || name.includes("_threshold")) && !name.endsWith("_pct");
}

export function clampNumber(value: number, min: number | undefined, max: number | undefined): number {
  if (!Number.isFinite(value)) return value;

  let out = value;
  if (typeof min === "number") out = Math.max(out, min);
  if (typeof max === "number") out = Math.min(out, max);
  return out;
}

export function evaluateNumberDraft(raw: string, {
  min,
  max,
  meta,
  displayScale,
  displayHint,
  step = 1,
}: {
  min?: number;
  max?: number;
  meta: ArgMetadata;
  displayScale: number;
  displayHint?: string;
  step?: number;
}): {
  state: NumberValidationKind;
  message: string;
  parsedInternal: number | null;
} {
  const clean = raw.trim();
  const baseHint = displayHint?.trim() ?? "";

  if (clean === "" || isPartialNumberInput(clean)) {
    return { state: "default", message: baseHint, parsedInternal: null };
  }

  const parsed = parseNumberInput(clean);
  if (parsed === null) {
    return { state: "error", message: "El valor debe ser un número válido.", parsedInternal: null };
  }

  const parsedInternal = parsed / displayScale;
  const isOutOfRangeLow = typeof min === "number" && parsedInternal < min;
  const isOutOfRangeHigh = typeof max === "number" && parsedInternal > max;

  if (isOutOfRangeLow || isOutOfRangeHigh) {
    const minLabel = typeof min === "number" ? formatNumberInput(min, displayScale) : "-";
    const maxLabel = typeof max === "number" ? formatNumberInput(max, displayScale) : "-";

    if (isOutOfRangeLow) {
      return {
        state: "error",
        message: `Mínimo permitido: ${minLabel}${displayScale !== 1 ? `% (${min})` : ""}`,
        parsedInternal: null,
      };
    }

    return {
      state: "error",
      message: `Máximo permitido: ${maxLabel}${displayScale !== 1 ? `% (${max})` : ""}`,
      parsedInternal: null,
    };
  }

  const fixed = normalizeNumberDisplay(roundToStep(parsedInternal, step));
  return {
    state: "default",
    message: baseHint,
    parsedInternal: Number(fixed),
  };
}

function roundToStep(value: number, step: number): number {
  if (!Number.isFinite(step) || step <= 0) return value;
  const fixed = Math.round(value / step) * step;
  return Number(fixed);
}
