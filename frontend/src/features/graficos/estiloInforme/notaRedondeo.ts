// Nota al pie del redondeo (R3 del rediseño, 2026-10-15). Contrato congelado con el motor (graficos_calculos_gobernados.R):
//   base.nota_redondeo_modo  ∈ nunca | si_no_cierra | siempre   (ausente: se deduce del booleano viejo `nota_redondeo`)
//   base.nota_redondeo_texto  "" = automático; con texto, ése va tal cual
// Mientras el motor instalado sea el viejo, el booleano `nota_redondeo` se sigue escribiendo (true para «siempre» y
// «sólo si no cierra»): un motor viejo pone la nota siempre en vez de condicional, pero nunca la pierde.

import { ARG_NOTA, METODO_REPARTO, PRESET_BASE, conArg, sinArgs, type MapaPresets } from "./modeloEstiloInforme";

export const ARG_NOTA_MODO = "nota_redondeo_modo";
export const ARG_NOTA_TEXTO = "nota_redondeo_texto";
export type ModoNota = "nunca" | "si_no_cierra" | "siempre";

const esModo = (v: unknown): v is ModoNota => v === "nunca" || v === "si_no_cierra" || v === "siempre";

export function leerNota(presets: MapaPresets, notaActivaPorBooleano: boolean): { modo: ModoNota; texto: string } {
  const base = (presets[PRESET_BASE] ?? {}) as Record<string, unknown>;
  const modo = esModo(base[ARG_NOTA_MODO]) ? base[ARG_NOTA_MODO] : notaActivaPorBooleano ? "siempre" : "nunca";
  const texto = typeof base[ARG_NOTA_TEXTO] === "string" ? (base[ARG_NOTA_TEXTO] as string) : "";
  return { modo, texto };
}

export function conModoNota(presets: MapaPresets, modo: ModoNota): MapaPresets {
  const conModo = conArg(presets, PRESET_BASE, ARG_NOTA_MODO, modo, "nunca");
  return conArg(conModo, PRESET_BASE, ARG_NOTA, modo !== "nunca", false);
}

export function conTextoNota(presets: MapaPresets, texto: string): MapaPresets {
  return texto.trim() ? conArg(presets, PRESET_BASE, ARG_NOTA_TEXTO, texto, "") : sinArgs(presets, PRESET_BASE, [ARG_NOTA_TEXTO]);
}

/** El texto automático, como lo redacta el motor (`.calculos_nota_texto`), para mostrar «Va a decir: …». */
export function textoAutomatico(metodo: string, decimales: number): string {
  const dec = Number.isFinite(decimales) && decimales > 0 ? Math.floor(decimales) : 0;
  const unidad = dec === 0 ? "al entero más cercano" : `a ${dec} decimal${dec === 1 ? "" : "es"}`;
  return metodo === METODO_REPARTO
    ? `Los porcentajes están redondeados ${unidad} repartiendo el resto para que cada barra sume exactamente 100 %.`
    : `Los porcentajes están redondeados ${unidad}, por lo que pueden no sumar exactamente 100 %.`;
}
