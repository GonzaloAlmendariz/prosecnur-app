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

/** Filas de un bloque de otra hoja del reporte (la de alertas, por ejemplo). */
export function filasDeHoja(
  reports: MonitoreoAcreditacionReports | null | undefined,
  hojaId: string,
  ids: readonly string[],
): Array<Record<string, unknown>> {
  const hoja = reports?.sheets?.find((item) => item.id === hojaId);
  if (!hoja) return [];
  const buscados = new Set(ids.map((id) => id.toLowerCase()));
  return hoja.blocks.flatMap((bloque) => (
    buscados.has(String(bloque.id).toLowerCase()) ? bloque.rows as Array<Record<string, unknown>> : []
  ));
}

/** La nota de un bloque del reporte telefónico: el motor la usa para declarar lo que no suma (p. ej. «no se suman a Efectivas»). */
export function notaDeBloque(
  reports: MonitoreoAcreditacionReports | null | undefined,
  id: string,
): string {
  const hoja = reports?.sheets?.find((item) => item.id === "monitoreo_telefonico");
  const bloque = hoja?.blocks.find((item) => String(item.id).toLowerCase() === id.toLowerCase()) as { note?: unknown } | undefined;
  return typeof bloque?.note === "string" ? bloque.note.trim() : "";
}
