// Grillas de «Probar formulario» (checklist editor-conjoint, E3, 2026-11-06).
// Un grupo con `appearance=table-list` es una batería: varias preguntas con la misma lista que la plataforma pinta
// como una tabla (filas = preguntas, columnas = opciones). Aquí se decide qué sección es grilla, con qué opciones, y
// qué nota la introduce: la nota inmediatamente anterior al grupo, que la plataforma muestra justo encima de la tabla.

import { appearanceTokens } from "../../canvas/previewInputs";
import type { BuilderNode, BuilderStructure, ChoiceItem } from "../../types";

export type GrillaPrueba = {
  /** Nota que presenta la batería (fuera del grupo, justo antes). */
  intro: BuilderNode | null;
  filas: BuilderNode[];
  opciones: ChoiceItem[];
  multiple: boolean;
};

const esSeleccion = (n: BuilderNode) => n.kind === "question" && (n.typeInfo.base === "select_one" || n.typeInfo.base === "select_multiple");

/**
 * Grillas por id de sección. Una sección es grilla si su grupo declara `table-list` y todas sus preguntas son de
 * selección con la misma lista; si no, se queda con tarjetas (como cae Enketo cuando las listas difieren).
 */
export function grillasDelFormulario(
  structure: BuilderStructure,
  opcionesDe: (lista: string) => ChoiceItem[],
): Map<string, GrillaPrueba> {
  const out = new Map<string, GrillaPrueba>();
  structure.sections.forEach((meta) => {
    if (meta.rowIndex == null) return;
    const inicio = structure.byRow.get(meta.rowIndex);
    if (!inicio || !appearanceTokens(inicio).includes("table-list")) return;
    const filas = structure.outline.filter((n) => n.sectionId === meta.id && n.kind === "question");
    if (!filas.length || !filas.every(esSeleccion)) return;
    const lista = filas[0]!.typeInfo.listName;
    if (!lista || filas.some((f) => f.typeInfo.listName !== lista || f.typeInfo.base !== filas[0]!.typeInfo.base)) return;
    const previa = structure.byRow.get(meta.rowIndex - 1);
    const intro = previa && previa.kind === "note" && previa.sectionId === meta.parentId && previa.label.trim() ? previa : null;
    out.set(meta.id, { intro, filas, opciones: opcionesDe(lista), multiple: filas[0]!.typeInfo.base === "select_multiple" });
  });
  return out;
}

/** Filas de las notas que se pintan dentro de su grilla y no en la página de origen. */
export function notasQueIntroducenGrilla(grillas: Map<string, GrillaPrueba>): Set<number> {
  return new Set(Array.from(grillas.values()).flatMap((g) => (g.intro ? [g.intro.rowIndex] : [])));
}

/**
 * Título de una página cuyo grupo no tiene rótulo: el de la sección que la contiene y, si la nota que presenta la
 * batería empieza con un código («**A1.** …»), ese código entre paréntesis para distinguir baterías hermanas.
 */
export function tituloSinRotulo(rotuloPadre: string | null, intro: BuilderNode | null): string {
  if (!rotuloPadre) return "Sección sin título";
  const codigo = intro?.label.trim().match(/^[*_]*([A-Za-z]{1,3}\d+[a-z]?)[.):]/)?.[1];
  return codigo ? `${rotuloPadre} (${codigo})` : rotuloPadre;
}
