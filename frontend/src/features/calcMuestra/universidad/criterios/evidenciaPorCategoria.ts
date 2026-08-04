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
  /**
   * G41 · Cuántos cursos-horario de cada categoría **llegan** a este criterio,
   * publicado por el motor en la cascada. Opcional: los criterios que no
   * particionan —y los `.pulso` guardados antes de esta capacidad— no lo traen,
   * y la tarjeta se queda como estaba en vez de inventar un reparto.
   */
  lleganPorCategoria?: Map<string, number> | null,
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
        mediaContraste: row.contraste_total?.distribution?.media ?? null,
        // F111 · La distribución COMPLETA del total, no sólo su media: el
        // conmutador de la tarjeta grafica elegibles contra todos sobre la
        // misma escala, y para eso hace falta la forma entera.
        distribucionContraste: row.contraste_total?.distribution ?? null,
        chConDato: row.actual?.n_ch_con_dato ?? null,
        matriculas: row.actual?.n_matriculas ?? null,
        distribucion: row.actual?.distribution ?? null,
        tasaAsistencia: tasaAsistencia ?? null,
        llegan: lleganPorCategoria?.get(clave) ?? null,
      });
    }
  }

  return (categoriaKey: string) => porSegmento.get(categoriaKey) ?? null;
}
