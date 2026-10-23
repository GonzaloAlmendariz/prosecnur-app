// Multiapiladas en el Word (W6 del rediseño, 2026-10-15; decisión D6). Contrato con el motor (f134ba5ad,
// api/R/reporte_word_multi_modos.R): por lámina `word_multiapiladas` ∈ un_grafico | por_tema | por_barra (vacío = como
// el informe); para el informe `w_presets.chart_options.multiapiladas_word` ∈ automatico | un_grafico | por_tema |
// por_barra | un_grafico_mismo_publico (ausente = por actor y escala; ver N8b abajo). Puro.

// N8b + criterio B (2026-10-22, decisión del usuario): SIN valor en el informe rige «por pregunta» (una figura por
// premisa; la misma premisa con varios actores, una fila por actor; un solo actor repetido en varias premisas con la misma
// escala, una batería con los enunciados en el eje Y). La clave interna sigue siendo `mismo_actor_escala` para no romper lo
// guardado. «automatico» pasa a
// ser el corte de antes y se guarda EXPLÍCITO; el valor por defecto se guarda borrando la clave. Un proyecto guardado con
// «automatico» no cambia; uno sin clave pasa al criterio nuevo (cambio deliberado: va a las notas de versión).
// `un_grafico_mismo_actor` (N8) es alias del default: se lee como tal y ya no se ofrece.

export type ModoMultiInforme = "mismo_actor_escala" | "automatico" | "un_grafico" | "por_tema" | "por_barra" | "un_grafico_mismo_publico";
export type ModoMultiLamina = "" | "un_grafico" | "por_tema" | "por_barra";

/** Lo que el informe usa cuando no dice nada. */
export const MODO_INFORME_PREDETERMINADO: ModoMultiInforme = "mismo_actor_escala";

// `soloInforme`: el motor rechaza (400) esos valores en el slot de una lámina (.word_multi_modo_normalizar).
export const MODOS_MULTI_INFORME: readonly { clave: ModoMultiInforme; rotulo: string; detalle: string; soloInforme?: true }[] = [
  { clave: "mismo_actor_escala", rotulo: "Por pregunta (recomendado)", soloInforme: true,
    detalle: "Una figura por pregunta; un mismo actor con varias preguntas va en una sola, con las preguntas en el eje; la misma pregunta con varios actores va en una figura con una fila por actor." },
  { clave: "automatico", rotulo: "Como antes (una figura por tema)", soloInforme: true,
    detalle: "Como antes: una figura por tema cuando hay temas; si no, una por pregunta." },
  { clave: "un_grafico", rotulo: "Un gráfico", detalle: "Toda la lámina en una figura, con sus temas rotulados." },
  { clave: "por_tema", rotulo: "Por tema", detalle: "Una figura por cada tema." },
  { clave: "por_barra", rotulo: "Por barra", detalle: "Una figura por cada pregunta." },
  { clave: "un_grafico_mismo_publico", rotulo: "Un gráfico si es el mismo público", soloInforme: true,
    detalle: "Si todas las preguntas de una lámina son del mismo público, salen en una sola figura; si no, una figura por pregunta." },
];

/** Lo que una lámina puede elegir en su tarjeta: sin lo exclusivo del informe. */
export const MODOS_MULTI_LAMINA = MODOS_MULTI_INFORME.filter((m) => !m.soloInforme);

export const esModoInforme = (v: unknown): v is ModoMultiInforme => MODOS_MULTI_INFORME.some((m) => m.clave === v);

type Mapa = Record<string, Record<string, unknown>>;
const opciones = (w: Mapa): Record<string, unknown> => (w.chart_options && typeof w.chart_options === "object" ? w.chart_options : {});

/** Falta la clave, el alias del N8 o un valor desconocido: el criterio por defecto. «automatico» explícito se respeta. */
export function leerModoInforme(w: Mapa): ModoMultiInforme {
  const v = opciones(w).multiapiladas_word;
  return esModoInforme(v) ? v : MODO_INFORME_PREDETERMINADO;
}

/** El criterio por defecto no se guarda (se borra la clave); «automatico» se guarda explícito: es el corte de antes. */
export function conModoInforme(w: Mapa, modo: ModoMultiInforme): Mapa {
  const o = { ...opciones(w) };
  if (modo === MODO_INFORME_PREDETERMINADO) delete o.multiapiladas_word; else o.multiapiladas_word = modo;
  return { ...w, chart_options: o };
}

export function leerModoLamina(args: Record<string, unknown>): ModoMultiLamina {
  const v = args.word_multiapiladas;
  return v === "un_grafico" || v === "por_tema" || v === "por_barra" ? v : "";
}

export const rotuloModo = (m: ModoMultiInforme) => MODOS_MULTI_INFORME.find((x) => x.clave === m)?.rotulo ?? "Por pregunta (recomendado)";
