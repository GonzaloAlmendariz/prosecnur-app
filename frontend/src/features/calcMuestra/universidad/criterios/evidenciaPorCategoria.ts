import type { CriterioRadiografiaCard } from "../marco/criteriosRadiografiaModel";
import type { AporteCategoria } from "./controles";

/**
 * ADR 0057 · Puente entre la radiografía y la categoría que se decide.
 *
 * La radiografía publica una fila por (facultad × segmento) con su distribución;
 * el conmutador vive en la categoría. Sin este puente cada uno mira su mitad, y
 * eso es exactamente lo que el ADR viene a cerrar: se elegía en una zona de la
 * pantalla con la evidencia en otra.
 *
 * No calcula nada. Une por clave y, si no encuentra fila, devuelve null para que
 * la superficie declare la ausencia en vez de dibujar una caja vacía.
 */
export function evidenciaPorCategoria(
  card: CriterioRadiografiaCard | null | undefined,
  facultyKey: string,
  tasaAsistencia?: number | null,
): (categoriaKey: string) => AporteCategoria | null {
  if (!card) return () => null;

  const porSegmento = new Map<string, AporteCategoria>();
  for (const entry of card.entries ?? []) {
    for (const row of entry.rows ?? []) {
      // El join es por facultad Y segmento: cruzarlo sólo por segmento
      // arrastraría la distribución de otra facultad a esta tarjeta, que es la
      // familia de bug que ya costó una reparación en este módulo.
      if (row.faculty_key !== facultyKey && row.faculty_label !== facultyKey) continue;
      const clave = row.segment_key;
      if (porSegmento.has(clave)) continue;
      porSegmento.set(clave, {
        elegibles: row.actual?.n_estudiantes_unicos ?? null,
        ch: row.actual?.n_ch ?? null,
        chContraste: row.contraste_total?.n_ch ?? null,
        distribucion: row.actual?.distribution ?? null,
        tasaAsistencia: tasaAsistencia ?? null,
      });
    }
  }

  return (categoriaKey: string) => porSegmento.get(categoriaKey) ?? null;
}
