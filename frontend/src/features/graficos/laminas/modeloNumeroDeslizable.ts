// Números de la tarjeta que se arrastran (ítem 11 de la oleada del inspector, 2026-11-08): los acotados de Aspecto (y la
// referencia del panorama) con mínimo y máximo finitos y a lo sumo 200 pasos van como slider con el valor escrito al lado
// (NumeroDeslizable). Con más pasos, o sin un extremo, sigue el número con «−»/«+» (NumeroAcotado). Puro.

import type { ArgMetadata } from "../../../api/graficos";
import { grupoDeCampo } from "./gruposTarjeta";

export type RangoDeslizable = { min: number; max: number; paso: number; grande: number };

export const MAX_PASOS_DESLIZABLE = 200;

/**
 * Porcentajes que el registro declara sin rango (`umbral_rojo_pct`: «0 desactiva») pero que sólo tienen sentido de 0 a
 * 100. El slider recorre ese tramo; el motor no cambia.
 */
const RANGO_DE_PORCENTAJE: Readonly<Record<string, Pick<ArgMetadata, "min" | "max" | "step">>> = {
  umbral_rojo_pct: { min: 0, max: 100, step: 1 },
};

/** Fuera de Aspecto, los que también se arrastran: la línea de referencia del panorama es un ajuste visual. */
const TAMBIEN_FUERA_DE_ASPECTO: ReadonlySet<string> = new Set(["referencia"]);

const finito = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** El tramo del slider, o `null` si el número no se arrastra (sin un extremo, al revés o con demasiados pasos). */
export function rangoDeslizable(arg: Pick<ArgMetadata, "name" | "min" | "max" | "step">): RangoDeslizable | null {
  const r = finito(arg.min) && finito(arg.max) ? arg : { ...arg, ...RANGO_DE_PORCENTAJE[arg.name] };
  if (!finito(r.min) || !finito(r.max) || r.max <= r.min) return null;
  const paso = finito(r.step) && r.step > 0 ? r.step : 1;
  const pasos = (r.max - r.min) / paso;
  if (pasos > MAX_PASOS_DESLIZABLE) return null;
  // El paso grande (Shift + flecha, RePág/AvPág): una décima del recorrido, en pasos enteros.
  return { min: r.min, max: r.max, paso, grande: paso * Math.max(1, Math.round(pasos / 10)) };
}

/** ¿Este campo de la lista blanca se arrastra? Los números de Aspecto y los de `TAMBIEN_FUERA_DE_ASPECTO`, con su rango. */
export function campoDeslizable(arg: Pick<ArgMetadata, "name" | "min" | "max" | "step">): RangoDeslizable | null {
  if (grupoDeCampo(arg.name) !== "aspecto" && !TAMBIEN_FUERA_DE_ASPECTO.has(arg.name)) return null;
  return rangoDeslizable(arg);
}

/** El valor que muestra el slider: el guardado dentro del tramo o, sin guardar, el de por defecto (o el mínimo). */
export function valorDeslizable(guardado: unknown, porDefecto: unknown, r: RangoDeslizable): { valor: number; vacio: boolean } {
  const acotar = (v: number) => Math.min(r.max, Math.max(r.min, v));
  if (finito(guardado)) return { valor: acotar(guardado), vacio: false };
  return { valor: finito(porDefecto) ? acotar(porDefecto) : r.min, vacio: true };
}
