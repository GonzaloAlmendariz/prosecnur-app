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
