import type {
  MonitoreoAulasPorFacultad,
  MonitoreoAulasProyeccionFila,
} from "../../../../api/monitoreo";

/**
 * Las derivaciones de la pestaña «Metas», todas puras y todas aquí.
 *
 * **Ninguna recalcula lo que el motor ya dijo.** Las cuatro combinaciones de
 * meta × tasa vienen hechas de `monitoreo_aulas_proyeccion_metas()`; esto sólo
 * suma, ordena y cruza. Es la disciplina que salió de los tres fallos del
 * 2026-09-09, los tres por la misma causa: dos sitios produciendo la misma
 * cifra y discrepando.
 */

/** La cinta de arriba: la meta elegida y lo conseguido, cada una con su sexo. */
export type CintaDeMetas = {
  /** Todas las filas son de una cuota SIN sexo (celdas del eje, p. ej. nivel). */
  sinSexo?: boolean;
  meta: number;
  meta_M: number;
  meta_F: number;
  obtenidas: number;
  obtenidas_M: number;
  obtenidas_F: number;
};

const suma = (
  filas: ReadonlyArray<MonitoreoAulasProyeccionFila>,
  campo: keyof MonitoreoAulasProyeccionFila,
): number => filas.reduce((n, f) => n + (Number(f[campo]) || 0), 0);

/**
 * Los seis totales de la cinta.
 *
 * Se suman las facultades y NO se lee un total del payload: el motor emite por
 * facultad y un total aparte sería la segunda expresión de la misma cifra.
 */
export function cintaDeMetas(
  filas: ReadonlyArray<MonitoreoAulasProyeccionFila> | null,
): CintaDeMetas | null {
  if (!filas || !filas.length) return null;
  return {
    sinSexo: filas.every((f) => Boolean(f.sin_sexo)),
    meta: suma(filas, "meta"),
    meta_M: suma(filas, "meta_M"),
    meta_F: suma(filas, "meta_F"),
    obtenidas: suma(filas, "obtenidas"),
    obtenidas_M: suma(filas, "obtenidas_M"),
    obtenidas_F: suma(filas, "obtenidas_F"),
  };
}

/**
 * Alfabético por facultad, con la intercalación del español.
 *
 * El motor las devuelve ordenadas por BRECHA —el orden con el que se decide a
 * dónde ir— y la pestaña las lista alfabéticamente, que es el orden con el que
 * se BUSCA una. Son dos lecturas distintas del mismo dato, no dos verdades:
 * ninguna cifra cambia al reordenar.
 */
export function filasAlfabeticas(
  filas: ReadonlyArray<MonitoreoAulasProyeccionFila> | null,
): MonitoreoAulasProyeccionFila[] {
  if (!filas || !filas.length) return [];
  return filas.slice().sort((a, b) => a.facultad.localeCompare(b.facultad, "es"));
}

/**
 * Las aulas de cada facultad, por nombre.
 *
 * Viene de `aulas_por_facultad`, que es un bloque APARTE de la proyección: las
 * aulas no se reparten por sexo —la misma visita da de los dos— así que
 * repetirlas en las dos filas diría que hay aulas de hombres y aulas de
 * mujeres. Por eso se cruzan por facultad y se pintan en la fila de la
 * facultad, nunca en las de sexo.
 */
export function aulasPorFacultad(
  aulas: ReadonlyArray<MonitoreoAulasPorFacultad> | null | undefined,
): Map<string, { planificadas: number; aplicadas: number }> {
  const mapa = new Map<string, { planificadas: number; aplicadas: number }>();
  for (const a of aulas ?? []) {
    const nombre = (a?.facultad ?? "").trim();
    if (!nombre || mapa.has(nombre)) continue;
    mapa.set(nombre, {
      planificadas: Number(a.planificadas) || 0,
      aplicadas: Number(a.aplicadas) || 0,
    });
  }
  return mapa;
}

/**
 * Cuántas facultades no alcanzan su meta ni aplicando todo lo agendado.
 *
 * Se lee de `llega`, que lo decide el motor. Recalcularlo aquí como
 * `total >= meta` daría la misma cifra hoy y una distinta el día que el motor
 * afine el criterio — que es exactamente cómo se abre una discrepancia.
 */
export function facultadesQueNoLlegan(
  filas: ReadonlyArray<MonitoreoAulasProyeccionFila> | null,
): { noLlegan: number; total: number } | null {
  if (!filas || !filas.length) return null;
  return { noLlegan: filas.filter((f) => !f.llega).length, total: filas.length };
}

/**
 * Facultades cuya tasa obtenida se aparta más de veinte puntos porcentuales de
 * la del diseño — el material con el que se juzga el escenario «tasa obtenida».
 *
 * Sólo cuentan las que TIENEN tasa propia: una facultad sin aulas aplicadas cae
 * a la del diseño y su desvío no existe, no es cero.
 */
export function tasasQueSeApartan(
  filas: ReadonlyArray<MonitoreoAulasProyeccionFila> | null,
  umbral = 0.2,
): number {
  if (!filas) return 0;
  return filas.filter((f) => {
    const d = f.desvio_de_la_del_diseno;
    return typeof d === "number" && Number.isFinite(d) && Math.abs(d) > umbral;
  }).length;
}

/** Un carril de una fila de Metas: un sexo, o el total cuando la cuota no lo pide. */
export type CarrilDeMeta = {
  rotulo: string;
  tono: "hombres" | "mujeres" | "total";
  meta: number;
  obtenidas: number;
  proyectadas: number | null;
};

const n0 = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const nONull = (v: unknown) => (v == null || !Number.isFinite(Number(v)) ? null : Number(v));

/**
 * Los carriles de una fila, en UN sitio para los cuatro bloques de Metas.
 *
 * Gonzalo, 2026-09-23, sobre CCSS: «la única diferencia es que esas eran por
 * facultad y por sexo, aquí sólo serían por nivel». Una fila del eje llega con
 * `sin_sexo` —la cuota no lo pide— y se pinta con un solo carril, «Total»; las
 * de facultad × sexo, con sus dos de siempre. Decidirlo en cada componente era
 * invitar a que uno pintara dos carriles vacíos.
 */
export function carrilesDeLaFila(f: MonitoreoAulasProyeccionFila): CarrilDeMeta[] {
  if (f.sin_sexo) {
    return [{ rotulo: "Total", tono: "total", meta: n0(f.meta), obtenidas: n0(f.obtenidas),
              proyectadas: nONull(f.proyectadas) }];
  }
  return [
    { rotulo: "Hombres", tono: "hombres", meta: n0(f.meta_M), obtenidas: n0(f.obtenidas_M),
      proyectadas: nONull(f.proyectadas_M) },
    { rotulo: "Mujeres", tono: "mujeres", meta: n0(f.meta_F), obtenidas: n0(f.obtenidas_F),
      proyectadas: nONull(f.proyectadas_F) },
  ];
}
