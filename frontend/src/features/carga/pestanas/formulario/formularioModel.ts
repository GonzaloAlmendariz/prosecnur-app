// Carga › Formulario (ADR 0142, P4b R6; prototipo "carga-formulario"): de la
// estructura del formulario (`/api/carga/instrumento/estructura`) a las
// secciones con su condición en palabras, la tabla de preguntas con sus
// filtros, el inspector y las cifras de la cabecera. Lógica pura.

import type { Pregunta, Seccion } from "../../../../api/client";
import { formatoConteo } from "../../../../lib/formatoNumero";
import { humanizeRelevantWithLabels } from "../../../xlsformEditor/canvas-graph/logicaTexto";
import { rotuloSinMarcador } from "../../../codificacion/sugerenciasModulo";

/** Clave de "todas las secciones" en la lista: no choca con un `name` de XLSForm, que no admite espacios. */
export const TODAS_LAS_SECCIONES = "todas las secciones";
/** Clave de los elementos que no caen en ninguna sección declarada (sin grupo o con un grupo desconocido). */
export const SIN_SECCION = "sin sección";

export type FiltroDePreguntas = "todas" | "condicion" | "obligatorias" | "restriccion" | "calculadas" | "filtro-opciones";

export const FILTROS_DE_PREGUNTAS: readonly { clave: FiltroDePreguntas; rotulo: string }[] = [
  { clave: "todas", rotulo: "Todas" },
  { clave: "condicion", rotulo: "Con condición" },
  { clave: "obligatorias", rotulo: "Obligatorias" },
  { clave: "restriccion", rotulo: "Con restricción" },
  { clave: "calculadas", rotulo: "Calculadas" },
  { clave: "filtro-opciones", rotulo: "Con filtro de opciones" },
];

export function esCalculada(p: Pregunta): boolean {
  return p.tipo === "calculate" || p.type_raw === "calculate" || p.calculate;
}

export function esNota(p: Pregunta): boolean {
  return p.tipo === "note" || p.type_raw === "note";
}

export function cumpleFiltro(p: Pregunta, filtro: FiltroDePreguntas): boolean {
  switch (filtro) {
    case "condicion": return p.relevant;
    case "obligatorias": return p.required;
    case "restriccion": return p.constraint;
    case "calculadas": return esCalculada(p);
    case "filtro-opciones": return Boolean(p.choice_filter);
    default: return true;
  }
}

export function preguntasDeSeccion(preguntas: readonly Pregunta[], seccion: string, secciones: readonly Seccion[] = []): Pregunta[] {
  if (seccion === TODAS_LAS_SECCIONES) return [...preguntas];
  if (seccion === SIN_SECCION) {
    const conocidas = new Set(secciones.map((s) => s.name));
    return preguntas.filter((p) => !conocidas.has(p.seccion));
  }
  return preguntas.filter((p) => p.seccion === seccion);
}

/** Las secciones de la lista: las declaradas y, si hay elementos fuera de ellas, "Sin sección" al final. */
export function seccionesVisibles(secciones: readonly Seccion[], preguntas: readonly Pregunta[]): Seccion[] {
  const conocidas = new Set(secciones.map((s) => s.name));
  const huerfanas = preguntas.some((p) => !conocidas.has(p.seccion));
  return huerfanas
    ? [...secciones, { name: SIN_SECCION, label: "Sin sección", is_repeat: false, is_conditional: false, relevant: null, prefix: "" }]
    : [...secciones];
}

/** Una pregunta es lo que se responde: sin cálculos ni notas. La misma definición en la cabecera y en la lista. */
export function esRespondible(p: Pregunta): boolean {
  return !esCalculada(p) && !esNota(p);
}

/** Preguntas por sección (y en "Todas las secciones"), con la definición de la cabecera. */
export function conteoPorSeccion(visibles: readonly Seccion[], preguntas: readonly Pregunta[]): Map<string, number> {
  const conteo = new Map<string, number>();
  const declaradas = visibles.filter((s) => s.name !== SIN_SECCION);
  for (const s of visibles) conteo.set(s.name, preguntasDeSeccion(preguntas, s.name, declaradas).filter(esRespondible).length);
  conteo.set(TODAS_LAS_SECCIONES, preguntas.filter(esRespondible).length);
  return conteo;
}

/** El nombre de una sección sin marcadores crudos (`${sede_ppl}`); si no queda nada, su código. */
export function rotuloDeSeccion(s: Seccion): string {
  return rotuloSinMarcador(s.label || "") || s.name;
}

/** El título del inspector: "p9, Ocupación principal", o solo el código si la etiqueta no dice más. */
export function tituloDePregunta(p: Pregunta): string {
  const etiqueta = (p.label || "").trim();
  return etiqueta && etiqueta !== p.name ? `${p.name}, ${etiqueta}` : p.name;
}

export function buscar(preguntas: readonly Pregunta[], texto: string): Pregunta[] {
  const q = texto.trim().toLocaleLowerCase("es");
  if (!q) return [...preguntas];
  return preguntas.filter((p) =>
    p.name.toLocaleLowerCase("es").includes(q)
    || p.label.toLocaleLowerCase("es").includes(q)
    || (p.calculation_expr ?? "").toLocaleLowerCase("es").includes(q));
}

export function conteoPorFiltro(preguntas: readonly Pregunta[]): Record<FiltroDePreguntas, number> {
  const conteo = {} as Record<FiltroDePreguntas, number>;
  for (const f of FILTROS_DE_PREGUNTAS) conteo[f.clave] = preguntas.filter((p) => cumpleFiltro(p, f.clave)).length;
  return conteo;
}

/** La etiqueta de una opción por su código, para leer una condición. Se cruza por código, nunca por posición. */
export function etiquetaDeOpcion(preguntas: readonly Pregunta[]) {
  const porNombre = new Map(preguntas.map((p) => [p.name, p]));
  return (variable: string, codigo: string): string | null =>
    porNombre.get(variable)?.choices?.find((c) => c.name === codigo)?.label ?? null;
}

/**
 * Una condición de XLSForm en palabras: `${p8} = '1'` dice "p8 es Sí".
 * Usa la lectura del mapa de lógica del editor y le quita los signos.
 */
export function condicionEnPalabras(expr: string | null | undefined, preguntas: readonly Pregunta[]): string | null {
  const limpia = (expr ?? "").trim();
  if (!limpia) return null;
  return humanizeRelevantWithLabels(limpia, etiquetaDeOpcion(preguntas))
    .replace(/\s=\s/g, " es ")
    .replace(/\s≠\s/g, " no es ")
    .replace(/'([^']*)'/g, "$1")
    .replace(/"([^"]*)"/g, "$1");
}

/** Cuándo aparece una sección: "Siempre", "Si consent es Sí" o "Se repite según hogar_n". */
export function apareceSeccion(s: Seccion, preguntas: readonly Pregunta[]): string {
  const condicion = condicionEnPalabras(s.relevant, preguntas);
  if (condicion) return `Si ${condicion}`;
  if (s.is_repeat) {
    const vars = s.repeat_count_vars ?? [];
    if (vars.length > 0) return `Se repite según ${vars.join(", ")}`;
    if (s.repeat_count) return `Se repite según ${condicionEnPalabras(s.repeat_count, preguntas) ?? s.repeat_count}`;
    return "Se repite";
  }
  return "Siempre";
}

export function apareceDePregunta(p: Pregunta, preguntas: readonly Pregunta[]): string {
  const condicion = condicionEnPalabras(p.relevant_expr, preguntas);
  return condicion ? `Si ${condicion}` : "Siempre";
}

/** Las preguntas cuya condición nombra a esta: las que "abre". */
export function preguntasQueAbre(p: Pregunta, preguntas: readonly Pregunta[]): Pregunta[] {
  const ref = `\${${p.name}}`;
  return preguntas.filter((otra) => otra.name !== p.name && (otra.relevant_expr ?? "").includes(ref));
}

/** El tono de color del tipo de pregunta (tokens `--tipo-*`). */
export type TonoDeTipo = "so" | "sm" | "int" | "text" | "otro";

export function tonoDeTipo(p: Pregunta): TonoDeTipo {
  if (p.tipo === "select_one") return "so";
  if (p.tipo === "select_multiple") return "sm";
  if (p.tipo === "integer" || p.tipo === "decimal" || p.tipo === "range") return "int";
  if (p.tipo === "text") return "text";
  return "otro";
}

export type CifrasDeFormulario = { preguntas: number; secciones: number; conCondicion: number; calculadas: number };

/** Preguntas son las que se responden: sin cálculos ni notas, que se cuentan aparte. */
export function cifrasDeFormulario(estructura: { secciones: readonly Seccion[]; preguntas: readonly Pregunta[] }): CifrasDeFormulario {
  const respondibles = estructura.preguntas.filter(esRespondible);
  return {
    preguntas: respondibles.length,
    secciones: estructura.secciones.length,
    conCondicion: respondibles.filter((p) => p.relevant).length,
    calculadas: estructura.preguntas.filter(esCalculada).length,
  };
}

export const conteoDePreguntas = (n: number) => `${formatoConteo(n)} ${n === 1 ? "pregunta" : "preguntas"}`;

/**
 * La pregunta que muestra el inspector: la de la dirección si está en la
 * tabla visible; si no, la primera visible. Sin filas no hay inspector.
 */
export function preguntaElegida(visibles: readonly Pregunta[], foco: string | null | undefined): Pregunta | null {
  return visibles.find((p) => p.name === foco) ?? visibles[0] ?? null;
}
