import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { composicionDelAula } from "./composicionDelAula";

/**
 * **Lo que un curso-horario puede dar, por las tres varas que existen.**
 *
 * Gonzalo, 2026-09-11, sobre la tarjeta de candidato: «le falta los hombres y
 * mujeres elegibles y los esperados en base a lo planeado y en base a lo
 * obtenido hasta ahora».
 *
 * Tenía razón y son tres cosas distintas, no una:
 *
 * - **Elegibles**: el padrón. Toda la gente que PODRÍA responder. Es el techo,
 *   y sin él las otras dos cifras no tienen contra qué leerse.
 * - **Según el plan**: `expected_valid`, lo que el diseño pidió de esa celda.
 *   Es el compromiso, y no depende de cómo vaya el campo.
 * - **Al ritmo de hoy**: los elegibles por la tasa que el campo está
 *   consiguiendo de verdad. Es el pronóstico, y es el que cambia cada jornada.
 *
 * Las dos últimas se separan porque **discrepan, y esa discrepancia es la
 * decisión**: un aula cuyo plan pide 16 y al ritmo real dará 11 no es lo mismo
 * que una cuyo plan pide 11 y dará 14, aunque las dos «cumplan» según la vara
 * que se elija. Enseñar una sola escondía cuál de las dos se estaba usando.
 *
 * **El reparto por sexo es proporcional al padrón**, y eso se declara: nadie
 * mide el sexo de una respuesta que aún no existe. La proporción del aula es la
 * mejor estimación disponible y la única que no inventa una fuente.
 */

const numero = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Reparte un total entre dos sexos según la proporción del padrón. */
function reparte(total: number, mujeres: number, hombres: number) {
  const padron = mujeres + hombres;
  if (padron <= 0 || total <= 0) return { mujeres: 0, hombres: 0, total: 0 };
  // Hacia abajo en cada sexo y el total es su SUMA, nunca un tercer redondeo:
  // tres celdas donde dos tienen que dar la tercera. Ya falló una vez aquí.
  const m = Math.floor((total * mujeres) / padron);
  const h = Math.floor((total * hombres) / padron);
  return { mujeres: m, hombres: h, total: m + h };
}

export type PronosticoDelAula = {
  elegibles: { mujeres: number; hombres: number; total: number };
  /** Lo que el plan pidió de esta celda. `null` si no lo declara. */
  plan: { mujeres: number; hombres: number; total: number } | null;
  /** Lo que dará al ritmo que el campo consigue hoy. */
  ritmo: { mujeres: number; hombres: number; total: number };
  /** La tasa con la que se calcula el ritmo, y de dónde sale. */
  tasa: number;
  deDondeLaTasa: "aula" | "facultad" | "perfil";
  /**
   * **Cuánto se aparta la proyección de lo que el plan pidió.**
   *
   * Positivo es dar de más. `null` cuando el plan no declara meta, porque
   * entonces no hay contra qué compararse y un cero diría «coinciden».
   *
   * Es la cifra que hace accionable la tabla: las dos filas discrepan sólo
   * cuando el curso-horario ya se aplicó y su tasa propia se separó de la que
   * usó el diseño. Mientras coinciden —el caso de un candidato que no ha
   * salido— decirlo ahorra leer dos filas iguales.
   */
  desvio: number | null;
};

/** La tasa del perfil cuando no hay ninguna medida. Se declara al usarla. */
const TASA_DEL_PERFIL = 0.55;

export function pronosticoDelAula(f: MonitoreoAulasPlanRow): PronosticoDelAula {
  const anon = f as Record<string, unknown>;
  const { mujeres, hombres } = composicionDelAula(f);
  const elegibles = { mujeres, hombres, total: mujeres + hombres };

  /**
   * **La tasa del aula primero, la de su facultad después.**
   *
   * La del aula sólo existe si ese curso-horario ya se aplicó; para un
   * candidato que todavía no ha salido, la vara honesta es la que su facultad
   * está consiguiendo. Se dice cuál se usó porque no son lo mismo: una es
   * medida sobre él, la otra es una expectativa prestada.
   */
  const delAula = numero(anon.tasa_efectividad_aula);
  const deLaFacultad = numero(anon.tasa_facultad) || numero(anon.efectividad_tau);
  const tasa = delAula > 0 ? delAula : deLaFacultad > 0 ? deLaFacultad : TASA_DEL_PERFIL;
  const deDondeLaTasa = delAula > 0 ? "aula" : deLaFacultad > 0 ? "facultad" : "perfil";

  const metaDelPlan = Math.round(numero(f.expected_valid));
  const plan = metaDelPlan > 0 ? reparte(metaDelPlan, mujeres, hombres) : null;
  const ritmo = reparte(Math.floor(elegibles.total * tasa), mujeres, hombres);
  return {
    elegibles,
    plan,
    ritmo,
    tasa,
    deDondeLaTasa,
    desvio: plan ? ritmo.total - plan.total : null,
  };
}
