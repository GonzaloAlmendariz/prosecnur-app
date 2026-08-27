import type {
  MonitoreoAulasAvanceCuota,
  MonitoreoAulasEfectividadSeguimiento,
  MonitoreoRow,
} from "../../../../api/monitoreo";

/**
 * El avance como lo lee el cliente: por facultad y por sexo.
 *
 * Gonzalo lo pidió así: «el reporte de avance por facultad por sexo a la
 * muestra y la sobremuestra y la cantidad de aulas aplicadas». La misma tabla
 * va en tres soportes —esta pantalla, el PDF y la hoja «Cómo va el campo» del
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

const ES_MUJER = /^(f|fem)/;
const ES_HOMBRE = /^(m|masc|varon|hombre)/;

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
    if (ES_MUJER.test(s)) { actual.fT = t; actual.fO = o; }
    else if (ES_HOMBRE.test(s)) { actual.mT = t; actual.mO = o; }
    sexo.set(k, actual);
  }

  const aplicadas = new Map<string, number>();
  for (const f of efectividad?.facultades ?? []) {
    if (f.faculty_key) aplicadas.set(f.faculty_key, f.aulas_aplicadas);
  }

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
      // Acotado en 0: el superávit de una facultad NO descuenta lo que falta en
      // otra, y un negativo aquí invitaría a sumarlo (ADR 0079).
      faltan: cuota != null ? Math.max(0, cuota - conseguidas) : null,
    };
  })
  // La que peor va abre la tabla: es lo que se mira primero. Sin cuota, al
  // final —no se puede ordenar por un faltante que no existe—.
  .sort((a, b) => (b.faltan ?? -1) - (a.faltan ?? -1));
}
