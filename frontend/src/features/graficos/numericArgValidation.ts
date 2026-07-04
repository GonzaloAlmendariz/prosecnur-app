import { ArgMetadata } from "../../api/client";
import { coerceNumber, formatNumberInput } from "./argFieldNumberUtils";

export type NumericArgValidationResult =
  | { ok: true; value: number }
  | { ok: false; message: string };

export function hasMeaningfulValue(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as Record<string, unknown>).length > 0;
  return true;
}

export function validateNumericArgValue(value: unknown, meta: ArgMetadata): NumericArgValidationResult {
  const parsed = coerceNumber(value);

  if (parsed === null) {
    return { ok: false, message: "debe ser un número válido" };
  }

  const min = typeof meta.min === "number" ? meta.min : undefined;
  const max = typeof meta.max === "number" ? meta.max : undefined;

  if (typeof min === "number" && parsed < min) {
    return { ok: false, message: `debe ser mayor o igual a ${formatNumberInput(min)}` };
  }
  if (typeof max === "number" && parsed > max) {
    return { ok: false, message: `debe ser menor o igual a ${formatNumberInput(max)}` };
  }

  return { ok: true, value: parsed };
}

export function formatNumericRange(meta: ArgMetadata): string {
  const min = typeof meta.min === "number" ? formatNumberInput(meta.min) : "";
  const max = typeof meta.max === "number" ? formatNumberInput(meta.max) : "";
  if (min && max) return `Rango permitido: ${min} a ${max}.`;
  if (min) return `Mínimo permitido: ${min}.`;
  if (max) return `Máximo permitido: ${max}.`;
  return "";
}
