// Modelo puro de la ficha del Constructor (rediseño 2026-10-17, checklist-constructor-rediseno C5–C24).
// Sin React: qué apariencias ofrece cada tipo en la plataforma, qué dice una regla ausente y a qué pestaña lleva, si
// cambiar el tipo deja una lista sin uso y cuántas referencias actualiza renombrar el código.
// Las lecturas de reglas NO viven aquí: salen siempre del motor (reglas/leerRegla.ts).

import type { EditorFormulariosPestanaId } from "../../shell/pestanaEditor";
import { SURVEY_COLUMNS_WITH_VAR_REFS, findVarReferences } from "../../parsing/sheetUtils";
import type { BuilderNode, BuilderStructure, XlsformEditorSheet } from "../../types";

export const esSeleccion = (base: string) => base === "select_one" || base === "select_multiple";
export const esBloque = (node: Pick<BuilderNode, "kind">) => node.kind === "section" || node.kind === "repeat";

// ---------------------------------------------------------------------------------------------------------------
// Reglas: qué hace cada una en una línea y dónde se crea
// ---------------------------------------------------------------------------------------------------------------

export type ClaveReglaFicha = "cond" | "regla" | "calc" | "filtro";

export type DestinoRegla = { queHace: string; pestana: EditorFormulariosPestanaId; nombrePestana: string };

export const DESTINO_REGLA: Readonly<Record<ClaveReglaFicha, DestinoRegla>> = {
  cond: { queHace: "Decide cuándo aparece esta pregunta según otra respuesta.", pestana: "logica", nombrePestana: "Mapa de lógica" },
  regla: { queHace: "Limita qué respuestas acepta y muestra un mensaje si no cumple.", pestana: "restricciones", nombrePestana: "Restricciones" },
  calc: { queHace: "Obtiene un valor a partir de otras respuestas.", pestana: "calculos", nombrePestana: "Cálculos" },
  filtro: { queHace: "Muestra sólo las opciones que corresponden a otra respuesta.", pestana: "filtros", nombrePestana: "Filtros de opciones" },
};

/** El `foco` con que la pestaña abre el elemento: la Lógica cita una sección como «seccion:<fila>». */
export function focoParaPestana(pestana: EditorFormulariosPestanaId, node: Pick<BuilderNode, "kind" | "name" | "rowIndex">): string | null {
  if (pestana === "logica" && esBloque(node)) return `seccion:${node.rowIndex}`;
  return node.name || null;
}

// ---------------------------------------------------------------------------------------------------------------
// Apariencia en la plataforma (C13): la impresa vive en Impreso
// ---------------------------------------------------------------------------------------------------------------

export type DibujoApariencia = "lista" | "desplegable" | "fila" | "buscador" | "linea" | "lineas" | "fecha" | "mes" | "anio" | "pantalla" | "junta";

export type OpcionApariencia = {
  /** Token que se escribe en `appearance` ("" = el comportamiento estándar). */
  valor: string;
  nombre: string;
  detalle: string;
  dibujo: DibujoApariencia;
  /** Tokens que se leen como esta opción (variantes que ya trae un formulario importado). */
  reconoce: readonly string[];
};

const SELECCION: readonly OpcionApariencia[] = [
  { valor: "", nombre: "Lista", detalle: "Todas las opciones a la vista", dibujo: "lista", reconoce: [] },
  { valor: "minimal", nombre: "Desplegable", detalle: "Ahorra espacio en listas largas", dibujo: "desplegable", reconoce: ["minimal"] },
  { valor: "columns-pack", nombre: "En una fila", detalle: "Para escalas cortas", dibujo: "fila", reconoce: ["columns-pack", "horizontal", "horizontal-compact"] },
  { valor: "autocomplete", nombre: "Con buscador", detalle: "Para listas de muchas opciones", dibujo: "buscador", reconoce: ["autocomplete", "search"] },
];

const APARIENCIAS: Readonly<Record<string, readonly OpcionApariencia[]>> = {
  select_one: SELECCION,
  select_multiple: SELECCION,
  text: [
    { valor: "", nombre: "Una línea", detalle: "Respuestas breves", dibujo: "linea", reconoce: [] },
    { valor: "multiline", nombre: "Varias líneas", detalle: "Para respuestas largas", dibujo: "lineas", reconoce: ["multiline"] },
  ],
  date: [
    { valor: "", nombre: "Fecha completa", detalle: "Día, mes y año", dibujo: "fecha", reconoce: [] },
    { valor: "month-year", nombre: "Mes y año", detalle: "Sin el día", dibujo: "mes", reconoce: ["month-year"] },
    { valor: "year", nombre: "Solo el año", detalle: "Un año de la lista", dibujo: "anio", reconoce: ["year"] },
  ],
  begin_group: [
    { valor: "", nombre: "Una pregunta por pantalla", detalle: "Avanza de a una", dibujo: "pantalla", reconoce: [] },
    { valor: "field-list", nombre: "Toda la sección junta", detalle: "Todas sus preguntas en una pantalla", dibujo: "junta", reconoce: ["field-list"] },
  ],
};

/** Opciones de apariencia del tipo; null si el tipo se muestra de una sola forma. */
export function aparienciasDe(base: string): readonly OpcionApariencia[] | null {
  // Una repetición se muestra igual que una sección.
  const clave = base === "begin_repeat" ? "begin_group" : base;
  return APARIENCIAS[clave] ?? null;
}

const tokens = (appearance: string) => (appearance ?? "").split(/\s+/).map((t) => t.trim()).filter(Boolean);

/** El valor de la opción que hoy está activa. */
export function aparienciaActiva(base: string, appearance: string): string {
  const opciones = aparienciasDe(base) ?? [];
  const presentes = tokens(appearance);
  return opciones.find((o) => o.reconoce.some((t) => presentes.includes(t)))?.valor ?? "";
}

/** Tokens que la ficha no maneja: se conservan al elegir otra opción y se muestran tal cual. */
export function aparienciaAjena(base: string, appearance: string): string[] {
  const propios = new Set((aparienciasDe(base) ?? []).flatMap((o) => o.reconoce));
  return tokens(appearance).filter((t) => !propios.has(t));
}

/** `appearance` con la opción elegida y los demás tokens intactos. */
export function conApariencia(base: string, appearance: string, valor: string): string {
  return [...aparienciaAjena(base, appearance), ...(valor ? [valor] : [])].join(" ");
}

// ---------------------------------------------------------------------------------------------------------------
// Cambiar el tipo (C19) y renombrar el código (C23)
// ---------------------------------------------------------------------------------------------------------------

/**
 * Si pasar a `nuevoBase` deja de usar la lista de la pregunta: la lista y si queda sin ninguna pregunta que la use.
 * null cuando no se pierde nada (no tenía lista o sigue siendo una selección).
 */
export function listaQueSePierde(
  node: Pick<BuilderNode, "typeInfo">,
  nuevoBase: string,
  usosDeLaLista: number,
): { lista: string; quedaSinUso: boolean } | null {
  const lista = node.typeInfo.listName;
  if (!lista || !esSeleccion(node.typeInfo.base) || esSeleccion(nuevoBase)) return null;
  return { lista, quedaSinUso: usosDeLaLista <= 1 };
}

/** Celdas del survey que citan `${name}`: las que se reescriben al renombrar. */
export function contarReferencias(survey: XlsformEditorSheet | null | undefined, name: string): number {
  if (!survey || !name) return 0;
  return findVarReferences(survey, name, SURVEY_COLUMNS_WITH_VAR_REFS).length;
}

// ---------------------------------------------------------------------------------------------------------------
// Posición y contenido
// ---------------------------------------------------------------------------------------------------------------

/** Número visible de la pregunta en el formulario (notas, cálculos y secciones no llevan). */
export function numeroDePregunta(structure: BuilderStructure | null, rowIndex: number): number | null {
  let n = 0;
  for (const e of structure?.outline ?? []) {
    if (e.kind === "question") n += 1;
    if (e.rowIndex === rowIndex) return e.kind === "question" ? n : null;
  }
  return null;
}

/** Preguntas y notas directas o anidadas de un bloque. */
export function contenidoDeBloque(structure: BuilderStructure | null, filaBloque: number): { preguntas: number; notas: number } {
  const span = structure?.spans.get(filaBloque);
  let preguntas = 0;
  let notas = 0;
  if (!structure || !span) return { preguntas, notas };
  for (const n of structure.outline) {
    if (n.rowIndex <= span.start || n.rowIndex > span.end) continue;
    if (n.kind === "question") preguntas += 1;
    else if (n.kind === "note") notas += 1;
  }
  return { preguntas, notas };
}

export const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
