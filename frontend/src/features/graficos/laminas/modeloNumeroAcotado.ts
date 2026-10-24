// Números acotados de la tarjeta: lo que se guarda en el plan nunca queda fuera de [min, max] de la metadata ni es no
// finito. Vacío = sin valor (borra la clave y vuelve al default). Puro: lo usa NumeroAcotado.tsx.

import type { ArgMetadata } from "../../../api/graficos";

export type LimitesNumero = { min: number | undefined; max: number | undefined; paso: number | undefined; entero: boolean };

const finito = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export function limitesDeNumero(arg: Pick<ArgMetadata, "min" | "max" | "step">): LimitesNumero {
  const paso = finito(arg.step) && arg.step > 0 ? arg.step : undefined;
  return {
    min: finito(arg.min) ? arg.min : undefined,
    max: finito(arg.max) ? arg.max : undefined,
    paso,
    entero: paso !== undefined && Number.isInteger(paso),
  };
}

/** Valor listo para guardar: dentro del rango y del paso. `ajustado` dice si hubo que moverlo. */
export function ajustarNumeroAcotado(crudo: unknown, l: LimitesNumero): { valor: number | null; ajustado: boolean } {
  const n = typeof crudo === "string" && crudo.trim() !== "" ? Number(crudo.replace(",", ".")) : crudo;
  if (!finito(n)) return { valor: null, ajustado: false };
  let v = n;
  if (l.entero) v = Math.round(v);
  else if (l.paso !== undefined) v = Number((Math.round(v / l.paso) * l.paso).toFixed(6));
  if (l.min !== undefined) v = Math.max(v, l.min);
  if (l.max !== undefined) v = Math.min(v, l.max);
  return { valor: v, ajustado: v !== n };
}

/** Lo que el campo acepta mientras se teclea: enteros sin letras ni signos; sobre el máximo, el máximo al instante. */
export function borradorNumeroAcotado(texto: string, l: LimitesNumero): string {
  const limpio = l.entero ? texto.replace(/\D/g, "") : texto.replace(/[^\d.,]/g, "");
  if (limpio === "") return "";
  const n = Number(limpio.replace(",", "."));
  if (l.max !== undefined && finito(n) && n > l.max) return String(l.max);
  return limpio;
}
