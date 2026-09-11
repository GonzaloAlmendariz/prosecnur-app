import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { ESTADOS_QUE_LIBERAN } from "./candidatosDeReemplazo";
import { pronosticoDelAula } from "./pronosticoDelAula";
import type { CuotaDeFacultad } from "./brechaDeLaFacultad";

/**
 * **Lo que de verdad falta cubrir, descontando lo que ya está en camino.**
 *
 * Gonzalo, 2026-09-11: «el déficit debería también tomar en cuenta que hay
 * esperables agendadas, o sea que no es todo lo que debemos, porque ya hay
 * aulas agendadas que esperan recibir más. No sé si eso se está tomando en
 * cuenta en toda la pestaña».
 *
 * No se estaba, y el efecto es grave. Medido en HSVG26ULT2, Ciencias Sociales:
 * la cuota pedía **82 respuestas más**, y sus **7 cursos-horario pendientes de
 * aplicar —6 ya agendados— esperan traer 118**. La pantalla decía «faltan 82,
 * busca refuerzo» sobre una facultad que ya tenía el déficit cubierto de sobra.
 *
 * Pedir refuerzo de más no es un error inocuo: **gasta una reserva que otra
 * facultad va a necesitar**, y las reservas no se comparten entre facultades.
 * Es el mismo error que el inventario ciego, por el otro lado — aquél veía
 * menos recursos de los que hay, éste veía más necesidad de la que hay.
 *
 * **Las tres cifras son distintas y las tres hacen falta:**
 *
 * 1. **La cuota que falta**: meta menos logrado. Es el compromiso.
 * 2. **Lo que viene**: lo que rendirán los cursos-horario ya agendados y aún
 *    sin aplicar. Es una PROYECCIÓN, no un hecho, y por eso se nombra aparte en
 *    vez de restarse en silencio.
 * 3. **Lo que quedaría**: la resta. Es la única que justifica un refuerzo.
 */

const texto = (v: unknown) => (v == null ? "" : String(v).trim());

/** Ya rindió: por sus respuestas primero, por su estado después. */
const yaSalio = (f: MonitoreoAulasPlanRow) =>
  Number(f.respuestas_validas) > 0
  || ESTADOS_QUE_LIBERAN.has(texto(f.operational_status).toLowerCase());

/**
 * Tiene fecha y todavía no ha salido: su rendimiento está por venir.
 *
 * Se mira el estado de muestra y el operativo, porque el operativo llega tarde
 * —lo teclea quien registra el campo— y aquí importa lo contrario: adelantarse.
 */
export const estaEnCamino = (f: MonitoreoAulasPlanRow) => {
  if (yaSalio(f)) return false;
  const estados = `${texto(f.sample_status)} ${texto(f.operational_status)}`.toLowerCase();
  return /agendada|reagendada|contactada|en_campo|programada/.test(estados);
};

/** Cómo está repartido el plan de la facultad, que es el marco de todo. */
export type PlanDeLaFacultad = {
  /** Cursos-horario que el diseño le asignó. */
  delDiseno: number;
  aplicados: number;
  agendados: number;
  sinAgendar: number;
};

export type DeficitOperativo = CuotaDeFacultad & {
  /** Lo que rendirán los cursos-horario ya agendados y sin aplicar. */
  enCamino: { mujeres: number; hombres: number; total: number };
  /** Cuántos cursos-horario sostienen esa proyección. */
  cursosEnCamino: number;
  /** Lo que quedaría tras lo agendado. Es lo único que justifica un refuerzo. */
  quedaria: { mujeres: number; hombres: number; total: number };
  /** `true` cuando lo agendado ya cubre la cuota: aquí NO toca reforzar. */
  loAgendadoAlcanza: boolean;
  /**
   * El reparto del plan de la facultad.
   *
   * Gonzalo, 2026-09-11: «el popover no avisa cuántos CH ya están agendados,
   * cuántos están aplicados y cuántos propone el diseño». Sin ese marco, «82
   * respuestas» flota: no se sabe si esa facultad tiene doce aulas o dos, ni
   * cuántas le quedan por delante.
   */
  plan: PlanDeLaFacultad;
};

export function deficitOperativo(
  cuota: CuotaDeFacultad,
  filas: ReadonlyArray<MonitoreoAulasPlanRow> | null | undefined,
  facultad: string,
): DeficitOperativo {
  const fac = texto(facultad);
  let mujeres = 0;
  let hombres = 0;
  let cursos = 0;
  const plan: PlanDeLaFacultad = { delDiseno: 0, aplicados: 0, agendados: 0, sinAgendar: 0 };

  for (const f of filas ?? []) {
    if (texto(f.faculty) !== fac) continue;
    // El marco es el plan del DISEÑO: los titulares. Las reservas no son
    // cursos-horario que la facultad tenga que aplicar, son su red.
    if (texto(f.sample_role) === "titular") {
      plan.delDiseno += 1;
      if (yaSalio(f)) plan.aplicados += 1;
      else if (estaEnCamino(f)) plan.agendados += 1;
      else plan.sinAgendar += 1;
    }
    if (!estaEnCamino(f)) continue;
    // El reparto por sexo sale del mismo sitio que en la tarjeta de candidato:
    // el padrón del aula por su tasa. Una segunda fórmula del mismo pronóstico
    // empieza a discrepar con la primera.
    const pr = pronosticoDelAula(f);
    mujeres += pr.ritmo.mujeres;
    hombres += pr.ritmo.hombres;
    cursos += 1;
  }

  const quedaM = Math.max(0, cuota.mujeres - mujeres);
  const quedaH = Math.max(0, cuota.hombres - hombres);
  return {
    ...cuota,
    enCamino: { mujeres, hombres, total: mujeres + hombres },
    cursosEnCamino: cursos,
    quedaria: { mujeres: quedaM, hombres: quedaH, total: quedaM + quedaH },
    // Alcanza sólo si cubre LOS DOS sexos: la deuda no se compensa entre ellos,
    // y sobrar hombres no tapa que falten mujeres.
    loAgendadoAlcanza: cuota.mujeres + cuota.hombres > 0 && quedaM + quedaH === 0,
    plan,
  };
}
