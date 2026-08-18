import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { avanceEnRespuestas, type AvanceEnRespuestas } from "./avanceEnRespuestas";

/**
 * Cómo va cada facultad contra la meta del plan.
 *
 * Es la cuarta pregunta del histórico del cálculo de muestra —«¿y por
 * facultad?»— y la que decide a dónde va el equipo mañana. Avance contestaba el
 * total y el aula, y entre esos dos grados no había nada: para saber que a
 * Derecho le faltan cien respuestas había que sumar a mano 30 filas de la tabla.
 *
 * **El denominador es la meta del PLAN** (`expected_valid` de cada
 * curso-horario), no la cuota de sexo×facultad, que es otra cosa y vive en su
 * propia pestaña. Cada facultad se calcula con `avanceEnRespuestas()`, la misma
 * función que da el total, así que las partes y el total no pueden discrepar —y
 * el excedente tampoco se cuela como avance dentro de una facultad.
 */

export type FacultadEnAvance = AvanceEnRespuestas & {
  facultad: string;
  /** Cursos-horario del plan en esa facultad. */
  aulas: number;
};

function texto(valor: unknown) {
  return typeof valor === "string" ? valor.trim() : "";
}

export function perfilPorFacultad(filas: ReadonlyArray<MonitoreoAulasPlanRow>) {
  const grupos = new Map<string, MonitoreoAulasPlanRow[]>();
  let sinFacultad = 0;
  for (const fila of filas) {
    const facultad = texto(fila.faculty) || texto(fila.stratum);
    // Un aula sin facultad no se reparte a ojo entre las demás: se cuenta
    // aparte y se dice, que es lo que deja arreglarlo en el plan.
    if (!facultad) { sinFacultad += 1; continue; }
    const actual = grupos.get(facultad);
    if (actual) actual.push(fila);
    else grupos.set(facultad, [fila]);
  }

  const facultades: FacultadEnAvance[] = [...grupos.entries()]
    .map(([facultad, propias]) => ({
      facultad,
      aulas: propias.length,
      ...avanceEnRespuestas(propias),
    }))
    // Primero donde más falta: es el orden con el que se decide a dónde mandar
    // al equipo. La tasa sola pondría arriba una facultad a la que le faltan
    // tres respuestas por delante de otra a la que le faltan doscientas.
    .sort((a, b) => b.falta - a.falta || a.facultad.localeCompare(b.facultad, "es"));

  return {
    facultades,
    sinFacultad,
    /** La meta más alta marca la escala de las barras. */
    tope: facultades.reduce((max, f) => Math.max(max, f.meta), 0),
    cumplidas: facultades.filter((f) => f.falta === 0 && f.meta > 0).length,
  };
}

/** Una fila de `avance_por_facultad` tal como la publica el motor. */
export type FilaDeFacultadDelMotor = {
  faculty?: unknown;
  aulas?: unknown;
  meta?: unknown;
  brecha?: unknown;
  respuestas_validas?: unknown;
};

/**
 * El perfil por facultad a partir del bloque que YA agrega el motor.
 *
 * Antes se calculaba en la vista sobre `course_status`, y ese bloque viaja
 * recortado a 500 filas de 2 615 y ademas incluye las reservas dormidas de cada
 * cadena: el panel que contesta «¿cómo va Derecho?» medía un subconjunto
 * arbitrario. El motor lo agrega sobre el mismo conjunto que las demás cifras de
 * avance —un aula por slot, sin banco— así que las cuatro cuentan lo mismo.
 */
export function perfilDesdeElMotor(filas: ReadonlyArray<FilaDeFacultadDelMotor>) {
  const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const facultades = filas
    .map((f) => {
      const meta = num(f.meta);
      const validas = num(f.respuestas_validas);
      const falta = Math.max(0, num(f.brecha));
      const cubierto = Math.max(0, meta - falta);
      return {
        facultad: String(f.faculty ?? "").trim() || "Sin facultad",
        aulas: num(f.aulas),
        meta,
        validas,
        cubierto,
        excedente: Math.max(0, validas - cubierto),
        falta,
        aulasConBrecha: falta > 0 ? 1 : 0,
        avance: meta ? Math.round((100 * cubierto) / meta) : 0,
        sinMeta: 0,
      };
    })
    .filter((f) => f.meta > 0 || f.aulas > 0);

  return {
    facultades,
    // El motor no publica las aulas sin facultad por separado; el bloque ya las
    // agrupa bajo su propio nombre vacío, que arriba se rotula «Sin facultad».
    sinFacultad: 0,
    tope: facultades.reduce((max, f) => Math.max(max, f.meta), 0),
    cumplidas: facultades.filter((f) => !f.falta).length,
  };
}
