/**
 * El payload para volver a guardar una fuente con un cambio: lo que ya tiene
 * más el `patch`. Salió del page-file para que Insumos (la pregunta con el
 * código de la persona) guarde por el mismo camino que la página.
 */
import type { MonitoreoSource, MonitoreoSourcePayload } from "../../../../../api/client";
import { sourceSheetField } from "./camposDeFuente";

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
    ...patch,
  };
}
