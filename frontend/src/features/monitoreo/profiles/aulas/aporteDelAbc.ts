import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { ESTADOS_QUE_LIBERAN } from "./candidatosDeReemplazo";

/**
 * **Qué nos dio cada aula que se metió, y cuánto de eso fue ganancia.**
 *
 * Gonzalo, 2026-09-10: «hay que diferenciar dos cosas: qué tan bien nos fue en
 * esa aula, que es una cosa, pero la otra cosa —y es la que también nos importa
 * sobremanera— es cómo esa aula nos ayudó, porque esa aula no estaba prevista
 * […] los alumnos tanto hombres como mujeres que habíamos recolectado allí son
 * alumnos netos o puros, ingresos completos».
 *
 * Son dos preguntas y hasta ahora se contestaban con la misma cifra:
 *
 * - **Qué tal rindió**: su tasa contra la prevista de su facultad. Es la vara
 *   de la calidad del trabajo de campo en ESE salón.
 * - **Cuánto aportó**: si esas respuestas suman al plan o sólo tapan un hueco
 *   que el plan ya contaba. Es la vara de la decisión de meterla.
 *
 * Y no se ordenan igual. Un complemento con tasa mediocre puede aportar más que
 * un reemplazo impecable, porque el reemplazo sólo repone lo que el titular
 * caído iba a dar y el complemento es ingreso entero.
 *
 * **El criterio no es el verbo del libro, es el hecho.** El verbo —«REEMPLAZADA
 * POR», «COMPLEMENTADA CON», «APLICADA DE REFUERZO»— se teclea al aplicar, así
 * que un aula puede llevar días siendo un refuerzo sin que nadie lo haya
 * escrito; eso ya mordió una vez en este perfil (4 tipo A en curso, 0
 * declarados). Lo que se mira es si su titular salió:
 *
 * - **El titular también se aplicó** → no cayó nadie, el plan ya tenía esa
 *   celda cubierta, y lo que trae esta aula es NETO. Es B o C.
 * - **El titular no salió** → esta aula está ocupando su sitio. REPONE: el plan
 *   contaba con esas respuestas, sólo que de otra aula.
 * - **Reserva adicional aplicada** → nunca tuvo titular al que reponer. Neta
 *   siempre, y es el caso C puro.
 */

const texto = (v: unknown) => (v == null ? "" : String(v).trim());
const numero = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const seAplico = (f: MonitoreoAulasPlanRow | undefined) =>
  !!f && ESTADOS_QUE_LIBERAN.has(texto(f.operational_status).toLowerCase());

/** Qué fue esta aula para el plan. */
export type PapelEnElPlan = "repone" | "neta";

export type AulaQueSeMetio = {
  codigo: string;
  facultad: string;
  curso: string;
  papel: PapelEnElPlan;
  /** El titular al que acompaña o al que releva. Vacío en la reserva adicional. */
  titular: string;
  /** De dónde salió: de una cadena o de la reserva adicional. */
  deLaReserva: boolean;
  efectivas: number;
  /**
   * El reparto por sexo de esas efectivas. `null` cuando el estudio no publica
   * el sexo por aula: no saberlo no es saber que no hubo, y pintarlo a cero
   * diría que este refuerzo no trajo ninguna mujer.
   */
  porSexo: { mujeres: number; hombres: number } | null;
  /** Lo que rindió: efectivas sobre elegibles. `null` sin elegibles. */
  observada: number | null;
  /** Lo previsto para su facultad, que es contra lo que se juzga. */
  prevista: number | null;
};

const opcional = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Las aulas que se metieron y ya rindieron, con su papel en el plan. */
export function aulasQueSeMetieron(
  filas: ReadonlyArray<MonitoreoAulasPlanRow> | null | undefined,
): AulaQueSeMetio[] {
  const todas = filas ?? [];
  const porCodigo = new Map<string, MonitoreoAulasPlanRow>();
  for (const f of todas) {
    const c = texto(f.operational_code) || texto(f.classroom_id);
    if (c) porCodigo.set(c, f);
  }

  const salida: AulaQueSeMetio[] = [];
  for (const f of todas) {
    const rol = texto(f.sample_role);
    if (rol === "titular") continue;      // el titular es el plan, no lo que se metió
    if (!seAplico(f)) continue;           // todavía no rindió nada que juzgar

    const efectivas = Math.round(numero(f.respuestas_validas));
    const deLaReserva = rol === "extra_reserve_pool";
    const claveTitular = texto(f.titular_operational_code);
    const titular = claveTitular ? porCodigo.get(claveTitular) : undefined;
    // Sin titular al que reponer —reserva adicional— o con el titular ya
    // aplicado, lo que trae es ganancia entera sobre el plan.
    const papel: PapelEnElPlan =
      deLaReserva || !claveTitular || seAplico(titular) ? "neta" : "repone";

    const anon = f as Record<string, unknown>;
    const m = anon.validas_mujeres;
    const h = anon.validas_hombres;
    const hayReparto = m != null && h != null && (m !== "" || h !== "");

    const elegibles = numero(f.eligible_n);
    salida.push({
      codigo: texto(f.operational_code) || texto(f.classroom_id),
      facultad: texto(f.faculty),
      curso: texto(f.course_name) || texto(f.label),
      papel,
      titular: claveTitular,
      deLaReserva,
      efectivas,
      porSexo: hayReparto
        ? { mujeres: Math.round(numero(m)), hombres: Math.round(numero(h)) }
        : null,
      observada: elegibles > 0 ? efectivas / elegibles : null,
      prevista: opcional(anon.tasa_facultad) ?? opcional(anon.efectividad_tau),
    });
  }

  return salida.sort((a, b) =>
    // Primero lo que suma, y dentro de eso lo que más trajo: es el orden de la
    // pregunta con la que se entra.
    (a.papel === b.papel ? 0 : a.papel === "neta" ? -1 : 1)
    || b.efectivas - a.efectivas
    || a.codigo.localeCompare(b.codigo));
}

/** El resumen con el que se lee el panel. */
export function repartoDelAporte(aulas: ReadonlyArray<AulaQueSeMetio>) {
  const netas = aulas.filter((a) => a.papel === "neta");
  const reponen = aulas.filter((a) => a.papel === "repone");
  const suma = (xs: ReadonlyArray<AulaQueSeMetio>, f: (a: AulaQueSeMetio) => number) =>
    xs.reduce((n, a) => n + f(a), 0);

  // El reparto por sexo sólo se declara si TODAS las que suman lo traen: con la
  // mitad sin sexo, «trajo 40 mujeres» sería una cifra sobre una muestra de las
  // aulas presentada como si fuera sobre todas.
  const conSexo = netas.filter((a) => a.porSexo);
  const repartoCompleto = netas.length > 0 && conSexo.length === netas.length;

  return {
    netas: netas.length,
    reponen: reponen.length,
    ganancia: suma(netas, (a) => a.efectivas),
    repuesto: suma(reponen, (a) => a.efectivas),
    /** `null` cuando el estudio no publica el sexo por aula en todas ellas. */
    gananciaPorSexo: repartoCompleto
      ? {
        mujeres: suma(conSexo, (a) => a.porSexo!.mujeres),
        hombres: suma(conSexo, (a) => a.porSexo!.hombres),
      }
      : null,
    /** Cuántas de las que suman no traen su reparto, para poder decirlo. */
    sinSexo: netas.length - conSexo.length,
  };
}
