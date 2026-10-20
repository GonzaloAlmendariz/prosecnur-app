// Ediciones de la pestaña «Listas de opciones» sobre la hoja choices (E2, 2026-10-20). Puras e inmutables: reciben el
// workbook y devuelven uno nuevo, así la pestaña las aplica por `onWorkbookChange` sin depender del editor.
//  - agregarOpcion: la fila nueva nace sin texto (el placeholder lo pide) y con un código libre, al final de su lista.
//  - crearLista: un nombre que no pisa otro y una primera opción vacía donde poner el foco.
//  - moverOpcion: lleva una opción a la posición de otra de la misma lista (arrastre y teclado).
//  - nombreUnificadoCorto: al unificar, se propone el nombre de la lista más usada del grupo.

import type { XlsformEditorSheet, XlsformEditorWorkbook } from "../../../api/multiIntegrado";
import { nombreLibre, type GrupoListasRepetidas } from "../listas/listasModel";

const col = (sheet: XlsformEditorSheet, nombre: string) => sheet.columns.findIndex((c) => c.trim().toLowerCase() === nombre);
const celda = (row: readonly string[] | undefined, i: number) => (i < 0 || !row ? "" : String(row[i] ?? "").trim());

/** Asegura las columnas `list_name` y `name` en una copia de choices y devuelve sus índices. */
function conColumnas(choices: XlsformEditorSheet) {
  const sheet: XlsformEditorSheet = { ...choices, columns: [...choices.columns], rows: choices.rows };
  for (const c of ["list_name", "name"]) if (col(sheet, c) < 0) sheet.columns.push(c);
  return { sheet, lista: col(sheet, "list_name"), nombre: col(sheet, "name") };
}

function filaNueva(sheet: XlsformEditorSheet, valores: Record<number, string>): string[] {
  return sheet.columns.map((_, i) => valores[i] ?? "");
}

/** Código libre para una opción nueva: el siguiente número si la lista usa números, o `opcion_N` si no. */
export function codigoLibre(codigos: readonly string[]): string {
  const usados = new Set(codigos);
  const numericos = codigos.filter((c) => /^-?\d+$/.test(c)).map(Number);
  if (numericos.length === codigos.length) {
    let n = Math.max(0, ...numericos.filter((x) => x < 90)) + 1;
    while (usados.has(String(n))) n += 1;
    return String(n);
  }
  let n = codigos.length + 1;
  while (usados.has(`opcion_${n}`)) n += 1;
  return `opcion_${n}`;
}

export type ResultadoFila = { workbook: XlsformEditorWorkbook; rowIndex: number };

/** Agrega una opción sin texto al final de la lista. */
export function agregarOpcion(workbook: XlsformEditorWorkbook, listName: string): ResultadoFila {
  const { sheet, lista, nombre } = conColumnas(workbook.choices);
  const propias = sheet.rows.map((r, i) => [r, i] as const).filter(([r]) => celda(r, lista) === listName);
  const despues = propias.length ? propias[propias.length - 1]![1] + 1 : sheet.rows.length;
  const codigo = codigoLibre(propias.map(([r]) => celda(r, nombre)));
  const rows = [...sheet.rows];
  rows.splice(despues, 0, filaNueva(sheet, { [lista]: listName, [nombre]: codigo }));
  return { workbook: { ...workbook, choices: { ...sheet, rows } }, rowIndex: despues };
}

/** Crea una lista con una primera opción vacía. `ocupados` suma los nombres citados en survey sin filas en choices. */
export function crearLista(
  workbook: XlsformEditorWorkbook,
  ocupados: Iterable<string> = [],
  base = "nueva_lista",
): ResultadoFila & { listName: string } {
  const { sheet, lista, nombre } = conColumnas(workbook.choices);
  const nombres = new Set<string>(ocupados);
  for (const r of sheet.rows) nombres.add(celda(r, lista));
  const listName = nombreLibre(base, nombres);
  const rows = [...sheet.rows, filaNueva(sheet, { [lista]: listName, [nombre]: "1" })];
  return { workbook: { ...workbook, choices: { ...sheet, rows } }, rowIndex: rows.length - 1, listName };
}

/** Lleva la fila `desde` al lugar que ocupa `hacia` (como arrayMove): hacia abajo queda después de ella. */
export function moverOpcion(workbook: XlsformEditorWorkbook, desde: number, hacia: number): XlsformEditorWorkbook {
  const rows = [...workbook.choices.rows];
  if (desde === hacia || desde < 0 || hacia < 0 || desde >= rows.length || hacia >= rows.length) return workbook;
  const [fila] = rows.splice(desde, 1);
  rows.splice(hacia, 0, fila!);
  return { ...workbook, choices: { ...workbook.choices, rows } };
}

/** Nombre propuesto al unificar: el de la lista del grupo que más preguntas usan (empate: la primera). */
export function nombreUnificadoCorto(grupo: GrupoListasRepetidas, usos: Readonly<Record<string, number>>): string {
  let mejor = grupo.listas[0] ?? grupo.sugerencia;
  for (const l of grupo.listas) if ((usos[l] ?? 0) > (usos[mejor] ?? 0)) mejor = l;
  return mejor;
}

/** Contador del riel con el mismo criterio que la cabecera: listas con opciones, y aparte las citadas sin ellas. */
export function totalListas(catalogs: readonly { items: readonly unknown[] }[]): string {
  const sinOpciones = catalogs.filter((c) => c.items.length === 0).length;
  const con = catalogs.length - sinOpciones;
  const base = `${con} ${con === 1 ? "lista" : "listas"}`;
  return sinOpciones ? `${base} · ${sinOpciones} sin opciones` : base;
}
