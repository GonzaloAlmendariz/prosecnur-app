import type { MonitoreoAcreditacionReports } from "../../../../../api/client";

/** Filas de un bloque del reporte telefónico. */
export function filasDeBloque(
  reports: MonitoreoAcreditacionReports | null | undefined,
  ids: readonly string[],
): Array<Record<string, unknown>> {
  const hoja = reports?.sheets?.find((item) => item.id === "monitoreo_telefonico");
  if (!hoja) return [];
  const buscados = new Set(ids.map((id) => id.toLowerCase()));
  return hoja.blocks.flatMap((bloque) => (
    buscados.has(String(bloque.id).toLowerCase()) ? bloque.rows as Array<Record<string, unknown>> : []
  ));
}
