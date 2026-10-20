// Acciones nuevas de la ficha (C20) sobre el borrador del workbook: duplicar, mover a otra sección y convertir una
// sección en repetición. La lógica vive en state/accionesConstructor.ts (pura, con Vitest); aquí sólo se cablea con
// `updateWorkbook` y la selección, para que la página no crezca.

import { applyRowMove } from "../../outline/outlineUtils";
import { buildType, parseType } from "../../parsing/parseType";
import { getCell, insertRecord, setCell } from "../../parsing/sheetUtils";
import { alternarRepeticion, duplicarFila, planMoverASeccion } from "../../state/accionesConstructor";
import type { BuilderSelection, BuilderStructure, XlsformEditorWorkbook } from "../../types";
import { nombreListaNueva } from "./modeloFicha";

/**
 * «Crear lista nueva» desde la ficha (2026-10-20): antes sólo escribía el nombre en el `type` sin crear la lista en
 * `choices`; como una lista existe por sus filas, el nombre no figuraba en ningún lado y el botón «no hacía nada».
 * Ahora crea la lista con una primera opción, se la asigna a la pregunta y devuelve su nombre.
 */
export function crearListaEnPregunta(draft: XlsformEditorWorkbook, fila: number): string | null {
  const tipo = parseType(getCell(draft.survey, fila, "type"));
  if (tipo.base !== "select_one" && tipo.base !== "select_multiple") return null;
  const listCol = draft.choices.columns.indexOf("list_name");
  const enChoices = new Set(listCol < 0 ? [] : draft.choices.rows.map((r) => (r[listCol] ?? "").trim()));
  // La pregunta ya cita una lista que todavía no tiene filas (`lista_pregunta_358`): se crea con ESE nombre, no con
  // uno inventado que dejaría la cita huérfana (E11b).
  const citada = (tipo.listName ?? "").trim();
  let nombre: string;
  if (citada && !enChoices.has(citada) && !citada.startsWith("${")) {
    nombre = citada;
  } else {
    const ocupados = new Set(enChoices);
    draft.survey.rows.forEach((_, i) => { const l = parseType(getCell(draft.survey, i, "type")).listName; if (l) ocupados.add(l); });
    nombre = nombreListaNueva(getCell(draft.survey, fila, "name"), ocupados);
  }
  insertRecord(draft.choices, draft.choices.rows.length, { list_name: nombre, name: "1", label: "Opción 1" });
  setCell(draft.survey, fila, "type", buildType(tipo.base, nombre));
  return nombre;
}

export function accionesNuevasFicha({ structure, workbook, selection, updateWorkbook, seleccionar, irALista }: {
  structure: BuilderStructure | null;
  workbook: XlsformEditorWorkbook | null;
  selection: BuilderSelection | null;
  updateWorkbook: (mutar: (draft: XlsformEditorWorkbook) => void) => void;
  seleccionar: (s: BuilderSelection) => void;
  /** Lleva a «Listas de opciones» con la lista abierta. */
  irALista: (lista: string) => void;
}) {
  const fila = selection?.kind === "survey" ? selection.rowIndex : null;
  return {
    crearLista: () => {
      if (fila == null) return;
      let nombre: string | null = null;
      updateWorkbook((draft) => { nombre = crearListaEnPregunta(draft, fila); });
      if (nombre) irALista(nombre);
    },
    duplicar: () => {
      if (!structure || fila == null) return;
      let nueva: number | null = null;
      updateWorkbook((draft) => { nueva = duplicarFila(draft, structure, fila).rowIndex; });
      if (nueva != null) seleccionar({ kind: "survey", rowIndex: nueva });
    },
    moverASeccion: (seccionFila: number | null) => {
      if (!structure || !workbook || fila == null) return;
      const plan = planMoverASeccion(structure, fila, seccionFila, workbook.survey.rows.length);
      if (!plan) return;
      updateWorkbook((draft) => applyRowMove(draft.survey, plan));
      seleccionar({ kind: "survey", rowIndex: plan.newStart });
    },
    alternarRepeticion: () => {
      if (!structure || fila == null) return;
      updateWorkbook((draft) => { alternarRepeticion(draft, structure, fila); });
    },
  };
}
