import {
  type CalcMuestraAulasFileInspection,
  type CalcMuestraAulasSheetInspectionSheet,
  type CalcMuestraWorkspaceSourceBinding,
} from "../../../../api/client";
import { rowsFrom } from "../../sharedCore";

// Fix raíz ADR 0035: el picker de columnas de la pestaña Variables se alimenta de
// `sheet_diagnostics[].columns_sample`, un sample GUARDADO en el workspace que
// puede haber quedado incompleto/stale (en proyectos reales aparece con 18/19
// columnas: falta sistemáticamente la ÚLTIMA columna de la hoja, p.ej. "Tipo de
// docente"). Re-inspeccionamos los archivos al entrar a Definición y refrescamos
// los diagnostics con el set COMPLETO y actual que devuelve el backend. La lógica
// de merge y de "qué falta inspeccionar" vive acá, pura y testeable.

/**
 * file_ids únicos de las source bindings que aún no fueron re-inspeccionados en
 * esta sesión. Solo devuelve bindings con `file_id`; deduplica (varias bindings
 * pueden apuntar al mismo archivo) y respeta el set de ya-inspeccionados para
 * evitar el bucle efecto ↔ persistencia del workspace.
 */
export function sourceBindingsPendingInspection(
  bindings: CalcMuestraWorkspaceSourceBinding[] | undefined,
  alreadyInspected: ReadonlySet<string>,
): string[] {
  const pending: string[] = [];
  const seen = new Set<string>();
  for (const binding of bindings ?? []) {
    const fileId = binding.file_id?.trim();
    if (!fileId) continue;
    if (alreadyInspected.has(fileId)) continue;
    if (seen.has(fileId)) continue;
    seen.add(fileId);
    pending.push(fileId);
  }
  return pending;
}

/**
 * Reemplaza `sheet_diagnostics` del binding con el set fresco de la inspección
 * (todos los encabezados actuales de cada hoja). Preserva la hoja y el rol
 * elegidos por el usuario (`sheet_name`, `role`, `detected_role`): solo se
 * actualizan los diagnostics y la lista de hojas disponibles. Best-effort: si la
 * inspección no trae hojas, devuelve el binding intacto.
 */
export function mergeRefreshedSheetDiagnostics(
  binding: CalcMuestraWorkspaceSourceBinding,
  inspection: CalcMuestraAulasFileInspection,
): CalcMuestraWorkspaceSourceBinding {
  const freshSheets = rowsFrom<CalcMuestraAulasSheetInspectionSheet>(inspection.sheets);
  if (freshSheets.length === 0) return binding;
  const availableSheets = freshSheets.map((sheet) => sheet.name).filter(Boolean);
  return {
    ...binding,
    sheet_diagnostics: freshSheets,
    available_sheets: availableSheets.length > 0 ? availableSheets : binding.available_sheets,
  };
}

/**
 * Aplica los diagnostics frescos (mapa file_id → inspección) sobre las bindings.
 * Las que no tengan inspección quedan intactas.
 */
export function applyRefreshedDiagnostics(
  bindings: CalcMuestraWorkspaceSourceBinding[] | undefined,
  inspectionsByFileId: ReadonlyMap<string, CalcMuestraAulasFileInspection>,
): CalcMuestraWorkspaceSourceBinding[] {
  return (bindings ?? []).map((binding) => {
    const fileId = binding.file_id?.trim();
    const inspection = fileId ? inspectionsByFileId.get(fileId) : undefined;
    return inspection ? mergeRefreshedSheetDiagnostics(binding, inspection) : binding;
  });
}
