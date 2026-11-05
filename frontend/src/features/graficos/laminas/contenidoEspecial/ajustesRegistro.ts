// Los ajustes de una lámina con bloque propio en Inspector › Lámina (LAMINAS_CON_AJUSTES): cuál rige y cuáles aplican.
// Sin React, para probarlo solo. Lo usan «Hallazgos clave» (hallazgos/) y «Resumen de diferencias» (resumenDiferencias/).

import type { ArgMetadata } from "../../../../api/graficos";
import { argAplica } from "../../argDependencias";

/** El valor que rige: el escrito en la lámina o, si no hay, el del registro. */
export function valorEfectivo(payload: Record<string, unknown>, arg: Pick<ArgMetadata, "name" | "default">): unknown {
  const v = payload[arg.name];
  return v === undefined || v === null || v === "" ? arg.default : v;
}

/** Los ajustes que aplican al modo y la selección en vigor, en el orden del registro. */
export function ajustesQueAplican(args: readonly ArgMetadata[], payload: Record<string, unknown>): ArgMetadata[] {
  const efectivos: Record<string, unknown> = { ...payload };
  for (const a of args) efectivos[a.name] = valorEfectivo(payload, a);
  return args.filter((a) => argAplica(a, efectivos));
}

/**
 * Los ajustes con cada dependiente justo después del ajuste que lo enciende (los topes de «auto» bajo la selección), y
 * el resto en el orden del registro. Un dependiente de un ajuste que no está en la lista se queda donde estaba.
 */
export function conDependientesJuntos(args: readonly ArgMetadata[]): ArgMetadata[] {
  const nombres = new Set(args.map((a) => a.name));
  const padreDe = (a: ArgMetadata): string | null => {
    const arg = a.depende?.arg;
    return typeof arg === "string" && arg !== a.name && nombres.has(arg) ? arg : null;
  };
  const out: ArgMetadata[] = [];
  const poner = (a: ArgMetadata) => {
    out.push(a);
    for (const h of args) if (padreDe(h) === a.name) poner(h);
  };
  for (const a of args) if (!padreDe(a)) poner(a);
  return out;
}
