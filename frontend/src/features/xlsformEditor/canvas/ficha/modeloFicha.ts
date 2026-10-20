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

const CODIGO_VALIDO = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export type EstadoCodigo = { limpio: string; cambio: boolean; puedeAplicar: boolean; problema: string | null };

/** El borrador del código frente al aplicado: si cambió, si se puede aplicar y, si no es válido, por qué. */
export function estadoCodigo(borrador: string, aplicado: string): EstadoCodigo {
  const limpio = borrador.trim();
  const cambio = limpio !== aplicado.trim();
  const problema = !limpio || CODIGO_VALIDO.test(limpio)
    ? null
    : /^\d/.test(limpio) ? "No puede empezar con número."
      : /\s/.test(limpio) ? "Sin espacios: usa guion bajo."
        : "Solo letras sin tilde, números y guion bajo.";
  return { limpio, cambio, puedeAplicar: cambio && !!limpio && !problema, problema };
}

/** Lo que pasa al aplicar el código nuevo, en una línea. */
export function notaReferencias(n: number): string {
  if (n <= 0) return "Nadie usa este código.";
  return n === 1 ? "Se actualiza 1 referencia." : `Se actualizan ${n} referencias.`;
}

/** Nombre libre para una lista nueva, derivado del código de la pregunta y sin chocar con las que existen. */
export function nombreListaNueva(codigo: string, ocupados: Iterable<string>): string {
  const usados = new Set(ocupados);
  const base = codigo.trim().replace(/[^a-zA-Z0-9_]+/g, "_").replace(/^_+|_+$/g, "") || "lista";
  const raiz = /^[a-zA-Z_]/.test(base) ? base : `l_${base}`;
  let nombre = `lst_${raiz}`;
  for (let i = 2; usados.has(nombre); i += 1) nombre = `lst_${raiz}_${i}`;
  return nombre;
}

/**
 * Borrador de un campo de texto de la ficha. El nodo publica su texto recortado (y con el código si queda vacío), así
 * que pintar el valor del nodo se comía el espacio recién tecleado al final: la barra espaciadora «no escribía».
 * Mientras el campo tiene el foco manda lo tecleado; fuera de foco, el valor del nodo.
 */
export type BorradorCampo = { texto: string; enFoco: boolean };
export type EventoCampo = { tipo: "tecleo"; texto: string } | { tipo: "valor"; valor: string } | { tipo: "foco" } | { tipo: "desenfoque" };

export function borradorCampo(estado: BorradorCampo, evento: EventoCampo): BorradorCampo {
  switch (evento.tipo) {
    case "tecleo": return { ...estado, texto: evento.texto };
    case "valor": return estado.enFoco || estado.texto === evento.valor ? estado : { ...estado, texto: evento.valor };
    case "foco": return { ...estado, enFoco: true };
    case "desenfoque": return { ...estado, enFoco: false };
  }
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

/** Avisos que la ficha muestra arriba. En una selección, «sin lista» y «lista sin opciones» ya los dice la tarjeta de
 * Respuesta con sus acciones: repetirlos en rojo encima es ruido (E11b). */
export function avisosDeFicha<T extends { id: string }>(avisos: readonly T[], base: string): readonly T[] {
  return esSeleccion(base) ? avisos.filter((a) => !/^catalog-(empty|missing)-/.test(a.id)) : avisos;
}
