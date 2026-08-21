/**
 * El sustento del dimensionamiento: POR QUÉ salen las aulas que salen, por
 * facultad y con cada factor nombrado.
 *
 * Gonzalo (I2+J3, textual): «por qué vamos a ciento noventa y no a ciento
 * setenta finalmente, ¿no? ¿Es exclusivamente por el estadístico del primer
 * cuartil, o también tiene algo que ver el ratio de asistencia? Este tipo de
 * cosas tienen que estar claras y no lo están de momento».
 *
 * La respuesta del motor (calc_muestra_engine.R, ~línea 1347) es una sola
 * fórmula por estrato:
 *
 *     titulares = ⌈ cuota ÷ (alumnos_por_aula × τ) ⌉
 *
 * donde `alumnos_por_aula` es el estadístico decidido (p25/mediana/media de
 * los elegibles por curso-horario DE ESA FACULTAD) y τ la tasa de respuesta
 * esperada. O sea: las dos cosas a la vez — el estadístico Y el ratio— y este
 * módulo las separa por columna para que se vea cuánto pone cada una.
 *
 * Dos honestidades que el modelo VERIFICA en vez de asumir:
 * - Recalcula la fórmula y si no reproduce el `aulas_base` publicado, la fila
 *   se marca «fijada a mano» (el botón «¿un aula más?» fija `aulas_base_fijas`
 *   y el sello de Gonzalo exige que nada manual quede sin registrar).
 * - Si el τ es idéntico en todas las filas, lo declara GLOBAL: es el hallazgo
 *   J2 medido en HSVG2026 (0.53 en las 15 facultades, aunque el motor soporta
 *   τ por estrato y la referencia publica asistencia por facultad).
 */
import type {
  CalcMuestraAulasEstrato,
  CalcMuestraReferenciaAsistenciaCadenaSeleccion,
} from "../../../../api/calcMuestra";

export type FilaSustento = {
  facultad: string;
  cuota: number;
  estadisticoValor: number | null;
  estadisticoNombre: string;
  tau: number | null;
  /** Lo que la facultad rindió en el estudio anterior (Σefectivas/Σelegibles
   *  sobre sus aulas aplicadas — el MISMO tipo de tasa que el τ del diseño, no
   *  la asistencia bruta), sólo con k ≥ 12 aulas.
   *
   *  NO es una alternativa descartada, aunque la UI lo llamó «referencial»
   *  hasta el 2026-08-21: de este número sale el FACTOR DE FACULTAD, que ya
   *  está dentro de la tasa que dimensiona (τ = mix de tamaños × factor). Lo
   *  que no se hace es usarlo en CRUDO, porque arrastra la composición del
   *  marco de aquel año. Medido en HSVG2026: en crudo daría 194 titulares
   *  contra los 190 del diseño, y +3 de esa brecha son Arte y Diseño, cuyo
   *  marco 2026 tiene aulas más chicas que las que aplicó en 2025. */
  tauPropio: number | null;
  kPropio: number | null;
  /** Cuántas aulas daría la MISMA fórmula con ese rendimiento en crudo. Es la
   *  lectura del contraste, no una vía alternativa de dimensionar. */
  aulasConTauPropio: number | null;
  /** Lo que da la fórmula del motor con estos insumos. */
  aulasFormula: number | null;
  /** Lo publicado. Si difiere de la fórmula, alguien la fijó a mano. */
  aulasBase: number;
  ajustadaAMano: boolean;
  reservas: number;
  aCoordinar: number;
};

export type SustentoDimensionamiento = {
  filas: FilaSustento[];
  /** τ único de todo el diseño; null si hay τ distintos por facultad. */
  tauGlobal: number | null;
  totales: { cuota: number; aulasBase: number; reservas: number; aCoordinar: number };
  ajustadasAMano: number;
};

const NOMBRE_ESTADISTICO: Record<string, string> = {
  p25: "primer cuartil (p25)",
  p50: "mediana",
  mediana: "mediana",
  media: "media",
};

export function nombreEstadistico(codigo: unknown): string {
  const clave = String(codigo ?? "").trim().toLowerCase();
  return NOMBRE_ESTADISTICO[clave] ?? (clave || "estadístico del diseño");
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Clave de facultad tolerante a acentos/puntuación, para el join con 2025. */
function claveFac(x: unknown): string {
  return String(x ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Umbral de suficiencia de la casa (referencia: insuficiente_max = 11). */
const K_MINIMO_TAU_PROPIO = 12;

/**
 * τ propio por facultad, medido de las aulas APLICADAS del estudio anterior:
 * Σefectivas/Σelegibles — el MISMO tipo de tasa que el τ del diseño (no la
 * asistencia bruta, que tiene otro denominador). Solo publica facultades con
 * k ≥ 12 aulas; con menos, el τ propio sería ruido y se queda en null.
 */
export function tauPropioPorFacultad(
  cadenas: ReadonlyArray<CalcMuestraReferenciaAsistenciaCadenaSeleccion> | null | undefined,
): Map<string, { tau: number; k: number }> {
  const acc = new Map<string, { efectivas: number; elegibles: number; k: number }>();
  for (const cadena of cadenas ?? []) {
    const clave = claveFac(cadena.facultad);
    if (!clave) continue;
    for (const escalon of cadena.escalones) {
      if (escalon.estado !== "aplicado") continue;
      const efectivas = num(escalon.efectivas);
      const elegibles = num(escalon.elegibles);
      if (efectivas == null || elegibles == null || elegibles <= 0) continue;
      const previo = acc.get(clave) ?? { efectivas: 0, elegibles: 0, k: 0 };
      previo.efectivas += efectivas;
      previo.elegibles += elegibles;
      previo.k += 1;
      acc.set(clave, previo);
    }
  }
  const out = new Map<string, { tau: number; k: number }>();
  for (const [clave, { efectivas, elegibles, k }] of acc) {
    if (k >= K_MINIMO_TAU_PROPIO && elegibles > 0) {
      out.set(clave, { tau: efectivas / elegibles, k });
    }
  }
  return out;
}

export function construirSustento(
  filas: ReadonlyArray<CalcMuestraAulasEstrato> | null | undefined,
  cadenasReferencia: ReadonlyArray<CalcMuestraReferenciaAsistenciaCadenaSeleccion> | null = null,
): SustentoDimensionamiento | null {
  if (!filas?.length) return null;
  const tausPropios = tauPropioPorFacultad(cadenasReferencia);
  const out: FilaSustento[] = [];
  const taus = new Set<number>();
  for (const fila of filas) {
    const cuota = num(fila.cuota);
    const aulasBase = num(fila.aulas_base);
    if (cuota == null || aulasBase == null) continue;
    const raw = fila as unknown as Record<string, unknown>;
    const avg = num(raw.avg_conglomerado);
    const tau = num(raw.tau);
    if (tau != null) taus.add(tau);
    // La MISMA aritmética del motor, incluidos sus pisos (divisor mínimo 1,
    // τ mínimo 0.01): si esto no reproduce lo publicado, la fila fue fijada.
    const aulasFormula = avg != null && tau != null
      ? Math.ceil(cuota / (Math.max(avg, 1) * Math.max(tau, 0.01)))
      : null;
    const reservas = num(raw.aulas_reemplazo) ?? 0;
    const propio = tausPropios.get(claveFac(fila.estrato)) ?? null;
    out.push({
      facultad: String(fila.estrato ?? ""),
      cuota,
      estadisticoValor: avg,
      estadisticoNombre: nombreEstadistico(raw.estadistico_usado),
      tau,
      tauPropio: propio?.tau ?? null,
      kPropio: propio?.k ?? null,
      aulasConTauPropio: propio != null && avg != null
        ? Math.ceil(cuota / (Math.max(avg, 1) * Math.max(propio.tau, 0.01)))
        : null,
      aulasFormula,
      aulasBase,
      ajustadaAMano: aulasFormula != null && aulasFormula !== aulasBase,
      reservas,
      aCoordinar: num(raw.aulas_total) ?? aulasBase + reservas,
    });
  }
  if (!out.length) return null;
  out.sort((a, b) => b.cuota - a.cuota || a.facultad.localeCompare(b.facultad));
  return {
    filas: out,
    tauGlobal: taus.size === 1 ? [...taus][0]! : null,
    totales: {
      cuota: out.reduce((s, f) => s + f.cuota, 0),
      aulasBase: out.reduce((s, f) => s + f.aulasBase, 0),
      reservas: out.reduce((s, f) => s + f.reservas, 0),
      aCoordinar: out.reduce((s, f) => s + f.aCoordinar, 0),
    },
    ajustadasAMano: out.filter((f) => f.ajustadaAMano).length,
  };
}
