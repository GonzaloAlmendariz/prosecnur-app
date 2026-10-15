// Números de la tarjeta con pocos valores posibles que se eligen con botones (pasada final, 2026-10-15): los decimales
// (0 a 3, hasta el máximo del registro) y el nivel de significancia (0.10, 0.05, 0.01). Un valor guardado fuera de la
// lista se agrega para que se vea y se pueda cambiar.

import type { ArgMetadata } from "../../../api/graficos";

export type OpcionNumero = { valor: number; rotulo: string };

const DECIMALES = new Set(["decimales", "decimales_promedio", "valores_decimales", "chip_decimales"]);
const ALFAS: readonly number[] = [0.1, 0.05, 0.01];

export function opcionesNumeroEnBotones(arg: Pick<ArgMetadata, "name" | "min" | "max">, guardado: unknown): OpcionNumero[] | null {
  let base: number[] | null = null;
  if (DECIMALES.has(arg.name)) {
    const desde = typeof arg.min === "number" ? Math.max(0, Math.ceil(arg.min)) : 0;
    const hasta = Math.min(3, typeof arg.max === "number" ? Math.floor(arg.max) : 3);
    if (hasta < desde) return null;
    base = Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i);
  } else if (arg.name === "alpha") {
    base = [...ALFAS];
  }
  if (!base) return null;
  if (typeof guardado === "number" && Number.isFinite(guardado) && !base.includes(guardado)) base = [...base, guardado].sort((a, b) => (arg.name === "alpha" ? b - a : a - b));
  return base.map((v) => ({ valor: v, rotulo: arg.name === "alpha" ? v.toFixed(2) : String(v) }));
}
