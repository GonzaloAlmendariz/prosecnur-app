/**
 * Los tiempos de respuesta, tal como llegan del motor.
 *
 * El payload viaja por jsonlite, que envuelve escalares en arrays de uno según
 * cómo se construyó la lista en R. El normalizador es defensivo por eso y no
 * por desconfianza: un `mediana: [14.12]` que se pinte como `[object Array]`
 * es el defecto clásico de esta frontera.
 *
 * **Cuando el estudio no trae marcas de tiempo, esto NO devuelve null.**
 * Devuelve `disponible: false` con su motivo, para que la superficie pueda
 * decir qué falta. La base del estudio de aulas de hoy es exactamente ese
 * caso: 43 columnas y una sola de tiempo, `_submission_time`, que dice cuándo
 * se envió pero no cuánto duró.
 */

const num = (v: unknown): number | null => {
  const crudo = Array.isArray(v) ? v[0] : v;
  if (crudo === null || crudo === undefined || crudo === "") return null;
  const n = typeof crudo === "number" ? crudo : Number(crudo);
  return Number.isFinite(n) ? n : null;
};

const texto = (v: unknown): string => {
  const crudo = Array.isArray(v) ? v[0] : v;
  return typeof crudo === "string" ? crudo : "";
};

const bool = (v: unknown): boolean => {
  const crudo = Array.isArray(v) ? v[0] : v;
  return crudo === true || crudo === "TRUE" || crudo === 1;
};

export type AulaConTiempo = {
  aula: string;
  n: number;
  pocosCasos: boolean;
  mediana: number;
  bandaInf: number | null;
  bandaSup: number | null;
  medianaResto: number | null;
  destaca: boolean;
};

export type TiemposDeRespuesta = {
  disponible: boolean;
  motivo: string;
  columnas: { inicio: string; fin: string };
  umbral: { declarado: boolean; minutos: number | null; leyenda: string };
  resumen: {
    n: number;
    mediana: number | null;
    p25: number | null;
    p75: number | null;
    p95: number | null;
    maximo: number | null;
    colaMin: number | null;
    colaLarga: number | null;
  } | null;
  marcadas: { n: number; de: number } | null;
  aulas: AulaConTiempo[];
};

export function tiemposDeRespuesta(crudo: unknown): TiemposDeRespuesta {
  const raiz = (crudo ?? {}) as Record<string, unknown>;
  const criterio = (raiz.criterio ?? {}) as Record<string, unknown>;
  const resumenCrudo = raiz.resumen as Record<string, unknown> | null | undefined;
  const marcadasCrudo = raiz.marcadas as Record<string, unknown> | null | undefined;

  const disponible = bool(raiz.disponible);
  const declarado = bool(criterio.declarado);

  const resumen = resumenCrudo && num(resumenCrudo.n) !== null
    ? {
      n: num(resumenCrudo.n) ?? 0,
      mediana: num(resumenCrudo.mediana),
      p25: num(resumenCrudo.p25),
      p75: num(resumenCrudo.p75),
      p95: num(resumenCrudo.p95),
      maximo: num(resumenCrudo.maximo),
      colaMin: num(resumenCrudo.cola_min),
      colaLarga: num(resumenCrudo.cola_larga),
    }
    : null;

  const filas = Array.isArray(raiz.por_aula) ? raiz.por_aula : [];
  const aulas: AulaConTiempo[] = filas.flatMap((fila) => {
    const f = (fila ?? {}) as Record<string, unknown>;
    const aula = texto(f.grupo);
    const mediana = num(f.mediana);
    if (!aula || mediana === null) return [];
    return [{
      aula,
      n: num(f.n) ?? 0,
      pocosCasos: bool(f.n_bajo),
      mediana,
      bandaInf: num(f.banda_inf),
      bandaSup: num(f.banda_sup),
      medianaResto: num(f.mediana_resto),
      destaca: bool(f.destaca),
    }];
  });

  return {
    disponible,
    motivo: texto(raiz.motivo),
    columnas: { inicio: texto(raiz.columna_inicio), fin: texto(raiz.columna_fin) },
    umbral: {
      declarado,
      minutos: declarado ? num(criterio.umbral_min) : null,
      leyenda: texto(criterio.leyenda),
    },
    resumen: disponible ? resumen : null,
    marcadas: disponible && declarado && marcadasCrudo
      ? { n: num(marcadasCrudo.n) ?? 0, de: num(marcadasCrudo.de) ?? 0 }
      : null,
    aulas: disponible ? aulas : [],
  };
}
