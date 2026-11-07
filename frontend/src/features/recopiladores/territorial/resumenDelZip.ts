import type { HojasRutaJobResult } from "../../../api/hojasRuta";

const fmt = (n: number) => n.toLocaleString("es-PE");

/**
 * La línea de un ZIP del paquete territorial: fichas, hojas de zona, reemplazos, entrevistas, la
 * versión del marco con que se armó y el peso. P9 de la paridad con la página clásica, que mostraba
 * las hojas de zona y la versión del marco; sin ese dato (un job viejo) no se dice.
 */
export function resumenDelZip(r: Pick<HojasRutaJobResult, "n_pdfs" | "n_zone_pdfs" | "n_replacement_blocks" | "total_entrevistas" | "frame_version">, peso: string): string {
  const partes = [`${fmt(r.n_pdfs)} PDF`];
  if (typeof r.n_zone_pdfs === "number" && r.n_zone_pdfs > 0) partes.push(`${fmt(r.n_zone_pdfs)} ${r.n_zone_pdfs === 1 ? "hoja de zona" : "hojas de zona"}`);
  if (typeof r.n_replacement_blocks === "number" && r.n_replacement_blocks > 0) partes.push(`${fmt(r.n_replacement_blocks)} reemplazos`);
  partes.push(`${fmt(r.total_entrevistas)} entrevistas`);
  if (typeof r.frame_version === "string" && r.frame_version.trim() && r.frame_version !== "NA") partes.push(`marco ${r.frame_version.trim()}`);
  partes.push(peso);
  return partes.join(", ");
}
