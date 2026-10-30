/**
 * El payload para volver a guardar una fuente con un cambio: lo que ya tiene
 * más el `patch`. Salió del page-file para que Insumos (la pregunta con el
 * código de la persona) guarde por el mismo camino que la página.
 */
import type { MonitoreoSource, MonitoreoSourcePayload } from "../../../../../api/client";
import { sourceSheetField } from "./camposDeFuente";

/** R serializa una lista vacía como `[]`: aquí vuelve a ser un objeto (o nada). */
function objetoDeTextos(valor: unknown): Record<string, string> | undefined {
  if (!valor || Array.isArray(valor) || typeof valor !== "object") return undefined;
  return Object.fromEntries(Object.entries(valor as Record<string, unknown>).map(([clave, texto]) => [clave, String(texto ?? "")]));
}

export function sourcePayloadFromExisting(source: MonitoreoSource, patch: Partial<MonitoreoSourcePayload>): MonitoreoSourcePayload {
  const fallbackSheetBinding = sourceSheetField(source, "spreadsheet_id")
    ? {
      spreadsheet_id: sourceSheetField(source, "spreadsheet_id"),
      sheet_name: sourceSheetField(source, "sheet_name"),
      header_row: Number(source.sheet_binding?.header_row ?? 1),
      range: sourceSheetField(source, "range"),
    }
    : undefined;
  return {
    id: source.id,
    kind: source.kind,
    label: source.label,
    enabled: source.enabled,
    role: source.role,
    integration_mode: source.integration_mode,
    sheet_binding: source.sheet_binding ?? fallbackSheetBinding,
    asset_uid: source.asset_uid,
    survey_id: source.survey_id,
    survey_title: source.survey_title,
    base_url: source.base_url,
    connection_profile_id: source.connection_profile_id,
    declared_person_code_var: source.declared_person_code_var,
    declared_person_code_label: source.declared_person_code_label,
    dimensions: source.dimensions,
    // El reparto del padrón y la herencia del público viajan siempre: el router
    // reemplaza la fuente entera, y guardar otro campo los borraba en silencio.
    actor_var: source.actor_var,
    actor_map: objetoDeTextos(source.actor_map),
    actor_por_padron: source.actor_por_padron,
    dimension_vars: objetoDeTextos(source.dimension_vars),
    ...patch,
  };
}
