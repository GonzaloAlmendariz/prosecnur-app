import type {
  MonitoreoAulasAvanceCuota,
  MonitoreoAulasEfectividadSeguimiento,
  MonitoreoRow,
} from "../../../../api/monitoreo";
import { sexSeriesKind } from "../../../calcMuestra/sexoPalette";

/**
 * El avance como lo lee el cliente: por facultad y por sexo.
 *
 * Gonzalo lo pidió así: «el reporte de avance por facultad por sexo a la
 * muestra y la sobremuestra y la cantidad de aulas aplicadas». La misma tabla
 * va en tres soportes —esta pantalla, el PDF y la hoja «Avance de campo» del
 * libro—, así que **el contenido se decide una vez**.
 *
 * ## No recalcula: JUNTA lo que el motor ya publica
 *
 * Las tres piezas existen y ninguna se rehace aquí:
 *
 * - `avance_cuota.facultades` — la cuota del diseño y las válidas conseguidas
 *   (ADR 0079: el denominador es la cuota, no la suma de metas por aula).
 * - `quotas_sex_faculty` — las celdas facultad × sexo, con su objetivo y lo
 *   observado.
 * - `efectividad_seguimiento.facultades` — las aulas **aplicadas**, que se
 *   cuentan por `operational_status` y no por el parte.
 *
 * Recalcular cualquiera de las tres crearía una segunda fuente del mismo
 * número, que es como nacieron las tasas homónimas de este perfil.
 *
 * ## Lo que NO lleva, y no se inventa
 *
 * **La sobremuestra.** El bloque de metas del diseño trae cuota, reparto por
 * sexo y τ; ni la sobremuestra operativa ni su ratio viajan a Monitoreo
 * —comprobado el 2026-08-27, igual que en el libro—. La tabla lo declara en vez
 * de reconstruirla.
 */

export type FilaAvanceCliente = {
  facultad: string;
  facultyKey: string;
  /** La cuota del diseño para esa facultad. `null` si no la trazó. */
  muestra: number | null;
  muestraMujeres: number | null;
  muestraHombres: number | null;
  conseguidas: number;
  conseguidasMujeres: number | null;
  conseguidasHombres: number | null;
  /** Aulas con `operational_status` aplicada o cerrada. */
  aulasAplicadas: number | null;
  /** Aulas del plan en juego para esa facultad. */
  aulasDelPlan: number | null;
  /** 0–1, sin cap: pasarse de la cuota es un hecho. `null` sin denominador. */
  avance: number | null;
  /** Nunca negativo: el superávit no se resta de lo que falta en otra celda. */
  faltan: number | null;
};

const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const texto = (v: unknown) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim());

/** Clave de facultad, normalizada igual que en el motor. */
function clave(nombre: unknown): string {
  return texto(nombre)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

/**
 * **«Mujer» empieza por `m`.**
 *
 * Aquí había dos regex propias, `/^(f|fem)/` y `/^(m|masc|varon|hombre)/`,
 * probadas en ese orden. Un estudio cuya variable de sexo diga «Mujer» —que es
 * literalmente lo que mapea `audit_reference.R:231`, `"1" = "Mujer"`— fallaba
 * la primera, casaba la segunda y **contaba todas las mujeres como hombres**,
 * sin un solo aviso. El `sex` de `quotas_sex_faculty` sale de la columna del
 * estudio tal cual (`monitoreo_aulas_universitarias.R:1586`), así que sus
 * valores son los que el cliente escribió, no un código fijo.
 *
 * `sexSeriesKind` es el clasificador de la casa y ya resuelve el caso: prueba
 * pertenencia exacta antes que subcadena, así que «m» sola es hombre y «mujer»
 * es mujer.
 */

export function avanceParaCliente(
  avanceCuota: MonitoreoAulasAvanceCuota | null | undefined,
  celdasSexo: ReadonlyArray<MonitoreoRow> = [],
  efectividad: MonitoreoAulasEfectividadSeguimiento | null | undefined = null,
  avancePorFacultad: ReadonlyArray<MonitoreoRow> = [],
): FilaAvanceCliente[] {
  const filas = avanceCuota?.facultades ?? [];
  if (!filas.length) return [];

  // Las celdas de sexo, agrupadas por facultad. `target`/`observed` vienen del
  // motor; aquí sólo se reparten en dos columnas.
  const sexo = new Map<string, { fT: number | null; fO: number | null; mT: number | null; mO: number | null }>();
  for (const c of celdasSexo) {
    const k = clave(c.faculty);
    if (!k) continue;
    const actual = sexo.get(k) ?? { fT: null, fO: null, mT: null, mO: null };
    const s = texto(c.sex).toLowerCase();
    const t = num(c.target);
    const o = num(c.observed);
    const kind = sexSeriesKind(s);
    if (kind === "female") { actual.fT = t; actual.fO = o; }
    else if (kind === "male") { actual.mT = t; actual.mO = o; }
    sexo.set(k, actual);
  }

  const aplicadas = new Map<string, number>();
  for (const f of efectividad?.facultades ?? []) {
    if (f.faculty_key) aplicadas.set(f.faculty_key, f.aulas_aplicadas);
  }

  /**
   * Lo que falta en la facultad SIN netear entre sexos: cada celda aporta su
   * propio déficit. `null` cuando alguna de las dos celdas no está trazada —no
   * se puede sumar lo que no se conoce— y entonces manda la resta de la
   * facultad.
   */
  const faltanPorSexo = (sx: { fT: number | null; fO: number | null; mT: number | null; mO: number | null } | undefined) => {
    if (!sx) return null;
    const { fT, fO, mT, mO } = sx;
    if (fT == null || fO == null || mT == null || mO == null) return null;
    return Math.max(0, fT - fO) + Math.max(0, mT - mO);
  };

  const delPlan = new Map<string, number>();
  for (const r of avancePorFacultad) {
    const k = clave(r.faculty);
    const n = num(r.aulas);
    if (k && n != null) delPlan.set(k, n);
  }

  return filas.map((f) => {
    const k = f.faculty_key || clave(f.facultad);
    const sx = sexo.get(k);
    const cuota = num(f.cuota);
    const conseguidas = f.respuestas_validas;
    return {
      facultad: f.facultad,
      facultyKey: k,
      muestra: cuota,
      muestraMujeres: sx?.fT ?? null,
      muestraHombres: sx?.mT ?? null,
      conseguidas,
      conseguidasMujeres: sx?.fO ?? null,
      conseguidasHombres: sx?.mO ?? null,
      aulasAplicadas: aplicadas.get(k) ?? null,
      aulasDelPlan: delPlan.get(k) ?? null,
      // Sin cap: pasarse de la cuota es un hecho, no un error.
      avance: cuota != null && cuota > 0 ? conseguidas / cuota : null,
      // **La cuota tampoco se compensa ENTRE SEXOS dentro de una facultad.**
      //
      // Aquí decía `max(0, cuota - conseguidas)` con los totales de la
      // facultad, o sea que un excedente de hombres tapaba un déficit de
      // mujeres. El acotado en 0 aplicaba el ADR 0079 entre facultades y se
      // saltaba el mismo argumento un nivel más abajo, que es donde vive la
      // meta: «lo que me interesa es que TODAS LAS FACULTADES CUMPLAN CON SU
      // CUOTA DE SEXO».
      //
      // Medido el 2026-08-29 sobre HSVG2026: por eso la tabla decía «Faltan
      // 2.825» y la tarjeta «Cuota por recoger 2.824» tres centímetros más
      // arriba —ella sí suma celda a celda—. No era un redondeo: eran dos
      // cantidades distintas con el mismo nombre.
      //
      // Cuando el sexo no está trazado no hay dos celdas que sumar y la resta de
      // la facultad es lo único que hay; se usa ésa, que es lo mismo que hacía
      // antes y no inventa un reparto.
      faltan: faltanPorSexo(sx) ?? (cuota != null ? Math.max(0, cuota - conseguidas) : null),
    };
  })
  // La que peor va abre la tabla: es lo que se mira primero. Sin cuota, al
  // final —no se puede ordenar por un faltante que no existe—.
  .sort((a, b) => (b.faltan ?? -1) - (a.faltan ?? -1));
}
