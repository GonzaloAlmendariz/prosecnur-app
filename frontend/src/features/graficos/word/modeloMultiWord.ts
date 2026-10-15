// Multiapiladas en el Word (W6 del rediseño, 2026-10-15; decisión D6). Contrato con el motor (f134ba5ad,
// api/R/reporte_word_multi_modos.R): por lámina `word_multiapiladas` ∈ un_grafico | por_tema | por_barra (vacío = como
// el informe); para el informe `w_presets.chart_options.multiapiladas_word` ∈ automatico | un_grafico | por_tema |
// por_barra (ausente = automático, que es lo de siempre: por tema cuando hay temas, por barra cuando no). Puro.

export type ModoMultiInforme = "automatico" | "un_grafico" | "por_tema" | "por_barra";
export type ModoMultiLamina = "" | "un_grafico" | "por_tema" | "por_barra";

export const MODOS_MULTI_INFORME: readonly { clave: ModoMultiInforme; rotulo: string; detalle: string }[] = [
  { clave: "automatico", rotulo: "Automático", detalle: "Una figura por tema cuando hay temas; si no, una por pregunta." },
  { clave: "un_grafico", rotulo: "Un gráfico", detalle: "Toda la lámina en una figura, con sus temas rotulados." },
  { clave: "por_tema", rotulo: "Por tema", detalle: "Una figura por cada tema." },
  { clave: "por_barra", rotulo: "Por barra", detalle: "Una figura por cada pregunta." },
];

type Mapa = Record<string, Record<string, unknown>>;
const opciones = (w: Mapa): Record<string, unknown> => (w.chart_options && typeof w.chart_options === "object" ? w.chart_options : {});

export function leerModoInforme(w: Mapa): ModoMultiInforme {
  const v = opciones(w).multiapiladas_word;
  return v === "un_grafico" || v === "por_tema" || v === "por_barra" ? v : "automatico";
}

/** Automático no se guarda: es lo de siempre. */
export function conModoInforme(w: Mapa, modo: ModoMultiInforme): Mapa {
  const o = { ...opciones(w) };
  if (modo === "automatico") delete o.multiapiladas_word; else o.multiapiladas_word = modo;
  return { ...w, chart_options: o };
}

export function leerModoLamina(args: Record<string, unknown>): ModoMultiLamina {
  const v = args.word_multiapiladas;
  return v === "un_grafico" || v === "por_tema" || v === "por_barra" ? v : "";
}

export const rotuloModo = (m: ModoMultiInforme) => MODOS_MULTI_INFORME.find((x) => x.clave === m)?.rotulo ?? "Automático";
