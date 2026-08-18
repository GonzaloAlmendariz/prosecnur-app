/**
 * Ranking de desempeño de los cursos-horario APLICADOS del estudio anterior,
 * por facultad.
 *
 * Gonzalo (2026-08-18, textual): «quizás podríamos tener la relación de cuáles
 * fueron los cursos-horario que tuvieron mejor desempeño el año pasado por
 * facultad (…) lógicamente fueron los obligatorios, pero ¿de qué ciclo?,
 * ¿cuántos alumnos tenían?, ¿cuánto fue su porcentaje de asistencia? (…) pero
 * también importante si fueron en la primera semana, en la segunda semana, en
 * la tercera semana».
 *
 * Este módulo sólo PROYECTA cifras que el motor ya publicó: el rendimiento por
 * escalón aplicado viaja en las cadenas de la referencia (`rendimiento` =
 * efectivas/elegibles, nacido en R), y la semana en el propio escalón. Lo único
 * que se añade es un JOIN de lectura contra el marco VIGENTE para decir tipo y
 * ciclo del curso: los códigos de curso-horario de 2025 son los mismos
 * `classroom_id` del catálogo de hoy (verificado en HSVG2026: `1dee24_1201`,
 * `1ing07_07b1`…). Un curso que ya no existe en el catálogo vigente queda con
 * tipo/ciclo en null y el consumidor DECLARA esa cobertura — el join es una
 * lectura, no un censo.
 */
import type {
  CalcMuestraReferenciaAsistenciaCadenaSeleccion,
} from "../../../../api/calcMuestra";

export type AulaFrameRowLike = Record<string, string | number | boolean | null>;

export type FilaRankingDesempeno = {
  facultad: string;
  cursoHorario: string;
  nombreCurso: string;
  rol: string;
  semana: number | null;
  efectivas: number | null;
  elegibles: number;
  /** efectivas/elegibles del escalón, publicado por el motor. 0–1. */
  rendimiento: number;
  /** Del marco VIGENTE (join por código); null si el curso ya no existe hoy. */
  tipo: string | null;
  ciclo: number | null;
  /** Quiénes RESPONDIERON en 2025, por sexo. El motor lo publica por escalón. */
  efectivasMujeres: number | null;
  efectivasHombres: number | null;
  /** Elegibles por sexo del marco VIGENTE (los sex_top de la certificación).
   *  La base 2025 NO trae el denominador por sexo por aula —el propio lector
   *  del libro lo documenta: «nadie observa» ese denominador—, así que la
   *  previsión por sexo que se puede decir con verdad es la de HOY, y se
   *  etiqueta como tal. null si el curso no existe hoy o no declara el sexo. */
  elegiblesHoyMujeres: number | null;
  elegiblesHoyHombres: number | null;
};

export type GrupoRankingDesempeno = {
  facultad: string;
  filas: FilaRankingDesempeno[];
  /** Aulas aplicadas de la facultad que entraron al ranking (pasan el mínimo). */
  consideradas: number;
};

export type RankingDesempeno = {
  grupos: GrupoRankingDesempeno[];
  /** Cobertura que la vista DEBE declarar: el corte por semana y el join no
   *  son censales y presentarlos sin denominador sería mentir con cifras. */
  cobertura: {
    aplicadas: number;
    conSemana: number;
    conJoin: number;
    descartadasPorMinimo: number;
    /** Aulas con más efectivas que elegibles (rendimiento > 1): el desborde
     *  que el ADR 0060 sanciona. No pueden competir —su porcentaje premia un
     *  error de medición— y su exclusión se declara, no se esconde. */
    desbordadas: number;
  };
  minElegibles: number;
  topPorFacultad: number;
};

function num(v: unknown): number | null {
  const x = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  return typeof x === "number" && Number.isFinite(x) ? x : null;
}

function texto(v: unknown): string {
  return typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "";
}

/** Clave canónica del código de CH: la base 2025 escribe «DER268-0901» con
 *  guion y el catálogo vigente «der268_0901» con guion bajo. Medido: con la
 *  clave cruda el join daba 0 de 194. */
export function claveCursoHorario(codigo: unknown): string {
  return texto(codigo)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Índice tipo/ciclo del marco vigente por código de curso-horario. */
export function indiceMarcoVigente(
  aulaFrame: ReadonlyArray<AulaFrameRowLike> | null | undefined,
): Map<string, {
  tipo: string | null;
  ciclo: number | null;
  mujeres: number | null;
  hombres: number | null;
}> {
  const out = new Map<string, {
    tipo: string | null; ciclo: number | null;
    mujeres: number | null; hombres: number | null;
  }>();
  for (const row of aulaFrame ?? []) {
    const id = claveCursoHorario(row.classroom_id);
    if (!id) continue;
    // El sexo viaja como top-2 categorías («F»/«M» + su n). Sólo se lee lo
    // observado: si una celda no aparece queda null, nunca se deriva por resta
    // (eligible_n puede incluir sexo sin declarar).
    let mujeres: number | null = null;
    let hombres: number | null = null;
    for (const [cat, n] of [
      [row.sex_top_1, row.sex_top_1_n],
      [row.sex_top_2, row.sex_top_2_n],
    ] as const) {
      const clave = texto(cat).toUpperCase();
      if (clave === "F") mujeres = num(n);
      else if (clave === "M") hombres = num(n);
    }
    out.set(id, {
      tipo: texto(row.condicion_curso) || null,
      ciclo: num(row.course_level_num),
      mujeres,
      hombres,
    });
  }
  return out;
}

/**
 * Las mejores aulas aplicadas de cada facultad, por rendimiento.
 *
 * `minElegibles` existe para que un aula de 5 alumnos no «gane» por ruido: con
 * denominadores chicos el rendimiento salta a 1.0 sin decir nada. El descarte
 * se CUENTA y se publica en la cobertura, nunca se esconde.
 */
export function construirRankingDesempeno(
  cadenas: ReadonlyArray<CalcMuestraReferenciaAsistenciaCadenaSeleccion> | null | undefined,
  aulaFrame: ReadonlyArray<AulaFrameRowLike> | null | undefined,
  { minElegibles = 15, topPorFacultad = 3 }: { minElegibles?: number; topPorFacultad?: number } = {},
): RankingDesempeno | null {
  if (!cadenas?.length) return null;
  const marco = indiceMarcoVigente(aulaFrame);

  let aplicadas = 0;
  let conSemana = 0;
  let conJoin = 0;
  let descartadas = 0;
  let desbordadas = 0;
  const porFacultad = new Map<string, { filas: FilaRankingDesempeno[]; consideradas: number }>();

  for (const cadena of cadenas) {
    const facultad = texto(cadena.facultad);
    if (!facultad) continue;
    for (const escalon of cadena.escalones) {
      if (escalon.estado !== "aplicado") continue;
      aplicadas += 1;
      if (escalon.semana != null) conSemana += 1;
      const codigo = texto(escalon.curso_horario);
      const vigente = marco.get(claveCursoHorario(codigo)) ?? null;
      if (vigente) conJoin += 1;
      const elegibles = num(escalon.elegibles);
      const rendimiento = num(escalon.rendimiento);
      if (elegibles == null || rendimiento == null) continue;
      if (elegibles < minElegibles) {
        descartadas += 1;
        continue;
      }
      if (rendimiento > 1) {
        desbordadas += 1;
        continue;
      }
      const grupo = porFacultad.get(facultad) ?? { filas: [], consideradas: 0 };
      grupo.consideradas += 1;
      grupo.filas.push({
        facultad,
        cursoHorario: codigo,
        nombreCurso: texto(cadena.nombre_curso),
        rol: texto(escalon.rol) || "Titular",
        semana: escalon.semana,
        efectivas: num(escalon.efectivas),
        elegibles,
        rendimiento,
        tipo: vigente?.tipo ?? null,
        ciclo: vigente?.ciclo ?? null,
        efectivasMujeres: num(escalon.efectivas_mujeres),
        efectivasHombres: num(escalon.efectivas_hombres),
        elegiblesHoyMujeres: vigente?.mujeres ?? null,
        elegiblesHoyHombres: vigente?.hombres ?? null,
      });
      porFacultad.set(facultad, grupo);
    }
  }
  if (!aplicadas) return null;

  const grupos: GrupoRankingDesempeno[] = [...porFacultad.entries()]
    .map(([facultad, { filas, consideradas }]) => ({
      facultad,
      consideradas,
      filas: [...filas]
        .sort((a, b) =>
          b.rendimiento - a.rendimiento ||
          b.elegibles - a.elegibles ||
          a.cursoHorario.localeCompare(b.cursoHorario))
        .slice(0, topPorFacultad),
    }))
    // Del mejor rendimiento al peor, POR FACULTAD (vara 1: nunca sólo el agregado).
    .sort((a, b) =>
      (b.filas[0]?.rendimiento ?? 0) - (a.filas[0]?.rendimiento ?? 0) ||
      a.facultad.localeCompare(b.facultad));

  return {
    grupos,
    cobertura: { aplicadas, conSemana, conJoin, descartadasPorMinimo: descartadas, desbordadas },
    minElegibles,
    topPorFacultad,
  };
}
