import type { CalcMuestraNaturaleza } from "../../api/client";
import { fmtPct } from "./sharedCore";

type ResultadoPrecisionInput = {
  naturaleza: CalcMuestraNaturaleza;
  precisionAlcanzada: unknown;
  coberturaObjetivo: unknown;
};

export type ResultadoPrecisionPresentation = {
  value: string;
  note: string | null;
};

function finiteNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function presentResultadoPrecision({
  naturaleza,
  precisionAlcanzada,
  coberturaObjetivo,
}: ResultadoPrecisionInput): ResultadoPrecisionPresentation {
  if (naturaleza === "no_prob") {
    return {
      value: "—",
      note: "No aplica (componente no probabilístico)",
    };
  }

  const precision = finiteNumber(precisionAlcanzada);
  const value = naturaleza === "prob"
    ? precision
    : precision ?? finiteNumber(coberturaObjetivo);

  return {
    value: value == null ? "—" : fmtPct(value),
    note: null,
  };
}
