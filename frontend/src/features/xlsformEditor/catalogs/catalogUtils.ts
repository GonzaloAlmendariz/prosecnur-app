// =============================================================================
// catalogs/catalogUtils.ts — helpers para mover/borrar/contar catálogos
// =============================================================================
// La hoja `choices` es un array plano con columna `list_name`. Las opciones
// de un mismo catálogo suelen estar contiguas pero no es obligatorio. Para
// reordenar:
//
//   1. Localizamos la fila origen y destino por su `rowIndex` global.
//   2. Sacamos la fila origen del array.
//   3. Calculamos el índice destino ajustado (si origen < destino, -1).
//   4. Insertamos la fila origen antes (o después) del destino.
//
// Esto preserva las filas de OTROS catálogos en su sitio — solo movemos la
// fila concreta. Si origen y destino están en catálogos distintos lo
// rechazamos (no es un caso esperado en la UI; el drag-drop está acotado
// al catálogo activo).
// =============================================================================

import type { XlsformEditorSheet } from "../types";

/**
 * Mueve una fila del array de `choices`. `before=true` inserta inmediatamente
 * antes de la fila destino; `before=false` inmediatamente después.
 *
 * `from` y `to` son índices globales en `sheet.rows` (los `rowIndex` de
 * `ChoiceItem`). Al terminar, los `rowIndex` de las opciones cambian
 * porque el array se reordenó — el caller debe rebuilder el index.
 */
export function applyChoiceMove(
  sheet: XlsformEditorSheet,
  fromRowIndex: number,
  toRowIndex: number,
  before: boolean,
): void {
  if (fromRowIndex === toRowIndex) return;
  const total = sheet.rows.length;
  if (fromRowIndex < 0 || fromRowIndex >= total) return;
  if (toRowIndex < 0 || toRowIndex >= total) return;

  const moved = sheet.rows.splice(fromRowIndex, 1)[0];
  if (!moved) return;

  let insertAt = toRowIndex;
  // Si quitar la fila desplazó al destino hacia atrás, ajustamos.
  if (fromRowIndex < toRowIndex) {
    insertAt = toRowIndex - 1;
  }
  if (!before) {
    insertAt = insertAt + 1;
  }

  if (insertAt < 0) insertAt = 0;
  if (insertAt > sheet.rows.length) insertAt = sheet.rows.length;

  sheet.rows.splice(insertAt, 0, moved);
}

/**
 * Cuenta cuántas filas del survey usan un catálogo dado (vía `select_one foo`
 * o `select_multiple foo`). Útil para mostrar "usado en N preguntas" en el
 * library y para deshabilitar el borrado de un catálogo en uso.
 */
export function countCatalogUsage(
  surveySheet: XlsformEditorSheet,
  listName: string,
): number {
  if (!listName) return 0;
  const typeColIdx = surveySheet.columns.indexOf("type");
  if (typeColIdx === -1) return 0;
  const target = listName.trim();
  let count = 0;
  for (const row of surveySheet.rows) {
    const raw = (row[typeColIdx] ?? "").trim();
    if (!raw) continue;
    const parts = raw.split(/\s+/);
    const base = parts[0];
    const list = parts.slice(1).join(" ").trim();
    if ((base === "select_one" || base === "select_multiple") && list === target) {
      count += 1;
    }
  }
  return count;
}

/**
 * Borra todas las filas de un catálogo de la hoja `choices`. Itera de
 * atrás hacia adelante para que los índices no se invaliden. NO valida
 * uso — el caller debe haber verificado con `countCatalogUsage` antes.
 */
export function deleteCatalog(
  choicesSheet: XlsformEditorSheet,
  listName: string,
): void {
  const listColIdx = choicesSheet.columns.indexOf("list_name");
  if (listColIdx === -1) return;
  const target = listName.trim();
  for (let i = choicesSheet.rows.length - 1; i >= 0; i -= 1) {
    const raw = (choicesSheet.rows[i]?.[listColIdx] ?? "").trim();
    if (raw === target) {
      choicesSheet.rows.splice(i, 1);
    }
  }
}
