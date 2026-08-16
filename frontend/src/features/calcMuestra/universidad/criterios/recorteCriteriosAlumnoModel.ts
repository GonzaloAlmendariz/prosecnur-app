/**
 * Qué recorta cada criterio de alumno, listo para pintar.
 *
 * El motor publica cuántas filas deja pasar cada criterio; la pantalla mostraba
 * sólo el agregado —cuántos estudiantes quedan— y no el desglose. Sin él, un
 * criterio activo que no recorta nada es indistinguible de uno que sí muerde, y
 * tampoco se ve cuál pesa: medido en el proyecto real de 2025-2, sobre 136.284
 * filas los cinco criterios recortan cantidades muy distintas —`level` deja
 * fuera 35.364 y `faculty` sólo 9.747— y esa diferencia no llegaba a ninguna
 * pantalla.
 *
 * El modelo vive aparte del render porque aquí está la decisión —cuál no
 * recorta, y sobre qué total se dice— y eso es lo que puede equivocarse.
 */
import type { CalcMuestraCriteriosAlumnoReporte } from "../../../../api/calcMuestra";

export type RecorteCriterioAlumno = {
  id: string;
  layer: string;
  /** Filas que el criterio deja pasar. */
  pasan: number;
  /** Filas que recorta, o null si no se conoce el total sobre el que corta. */
  recorta: number | null;
  /** Proporción recortada (0..1), o null sin total. */
  pctRecorte: number | null;
  /** El criterio está activo y no deja fuera a nadie. */
  noRecorta: boolean;
  /** Se pudo medir. Falso si su columna no trae datos. */
  evaluable: boolean;
};

export type RecorteCriteriosAlumno = {
  total: number | null;
  /** De más a menos recorte; los que no recortan quedan al final. */
  criterios: RecorteCriterioAlumno[];
  /** Cuántos criterios activos se midieron y no están recortando nada. */
  inertes: number;
  /** Cuántos no se pudieron medir por falta de datos en su columna. */
  noMedibles: number;
};

/**
 * @param reporte lo que publica el motor, ya normalizado
 * @param totalFilas override del universo. Normalmente no se pasa: el motor lo
 *   publica en `reporte.filas_total`. Si no se conoce por ninguna vía, se
 *   infiere del criterio que más deja pasar — que es una cota
 *   inferior del total y sólo es exacta cuando alguno no recorta. Por eso el
 *   `total` inferido nunca se usa para afirmar un porcentaje si ningún criterio
 *   pasa todo: en ese caso `recorta` queda en null antes que mentir.
 */
export function recorteCriteriosAlumno(
  reporte: CalcMuestraCriteriosAlumnoReporte | null,
  totalFilas?: number | null,
): RecorteCriteriosAlumno | null {
  if (!reporte || !reporte.criterios.length) return null;

  const maxPasan = Math.max(...reporte.criterios.map((c) => c.filas_pasan));
  const declarado = totalFilas ?? reporte.filas_total;
  const totalConocido = typeof declarado === "number" && Number.isFinite(declarado) && declarado > 0;
  // Sin total declarado, sólo se puede afirmar uno si algún criterio deja pasar
  // TODO: entonces su conteo es el universo. Si todos recortan algo, el máximo
  // es una cota inferior y calcular porcentajes sobre él inflaría cada recorte.
  const total = totalConocido ? (declarado as number) : null;

  const criterios = reporte.criterios.map((c) => {
    const base = total ?? null;
    const recorta = base != null ? base - c.filas_pasan : null;
    return {
      id: c.id,
      layer: c.layer,
      pasan: c.filas_pasan,
      recorta,
      pctRecorte: base != null && base > 0 ? (base - c.filas_pasan) / base : null,
      // Un criterio no recorta si deja pasar todo lo que hay. Con total
      // declarado se compara contra él; sin total, contra el que más pasa —
      // que es lo máximo que se puede afirmar sin inventar un universo.
      //
      // Uno que no se pudo medir NO cuenta como que no recorta: deja pasar a
      // todos porque no había con qué filtrar, y llamarlo inerte afirmaría que
      // se midió. Es la distinción entera de este modelo.
      noRecorta: c.evaluable && (base != null ? c.filas_pasan >= base : c.filas_pasan >= maxPasan),
      evaluable: c.evaluable,
    };
  });

  criterios.sort((a, b) => a.pasan - b.pasan);

  return {
    total,
    criterios,
    inertes: criterios.filter((c) => c.noRecorta).length,
    noMedibles: criterios.filter((c) => !c.evaluable).length,
  };
}
