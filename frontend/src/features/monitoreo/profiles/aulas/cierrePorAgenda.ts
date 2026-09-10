import type { MonitoreoRow } from "../../../../api/monitoreo";
import { MINIMO_PARA_COMPARAR } from "./rendimientoPorFacultad";

/**
 * Cuándo se termina de aplicar el plan, según LA AGENDA.
 *
 * Gonzalo, 2026-09-10, corrigiendo el modelo anterior:
 *
 * > «No es que nosotros tengamos un pronóstico lineal de que si hoy aplicamos
 * > treinta, mañana treinta, entonces pasado mañana treinta. De eso no depende:
 * > depende del ritmo de la agenda… no entender la agendación ni las metas como
 * > cosas lineales, sino cosas que dependen de las aulas que se hayan agendado y
 * > de los esperables que esperamos allí, contrastando siempre que tenemos un
 * > rendimiento diferenciado entre el rendimiento planificado y el que vamos
 * > encontrando una vez que ya tenemos ciertas aulas aplicadas.»
 *
 * **Lo que esto cambia.** El pronóstico anterior extrapolaba «al ritmo observado
 * de N cursos-horario por día de campo»: la velocidad futura como propiedad del
 * equipo. Aquí la velocidad es una propiedad de la AGENDA — se aplicará lo que
 * esté agendado, el día que esté agendado—, y un lunes con ocho aulas y un
 * martes con dos dejan de ser el mismo día.
 *
 * **Las tres piezas del modelo:**
 *
 * 1. **Cuándo**: la fecha de cada curso-horario agendado.
 * 2. **Cuánto**: lo esperable de ESAS aulas —`expected_valid`—, no un promedio
 *    de encuestas por día.
 * 3. **Corregido por lo observado**: la tasa que cada facultad está sacando de
 *    verdad, aplicada a lo que le queda agendado. Con menos de
 *    `MINIMO_PARA_COMPARAR` aulas aplicadas NO se corrige: una facultad con dos
 *    visitas no tiene una tasa, tiene dos anécdotas, y proyectar sobre ellas es
 *    lo que este perfil lleva media sesión desmontando.
 *
 * **Lo que el modelo NO puede decir, y la vista tiene que declararlo**: cuándo
 * cierra el plan ENTERO. Sólo dice hasta dónde llega lo agendado. Las aulas sin
 * fecha no tienen cuándo, y ponerles uno inventado sería volver a la
 * extrapolación por otra puerta.
 */

export type DiaDeAgenda = {
  fecha: string;
  /** Cursos-horario con esa fecha que todavía no se han aplicado. */
  cursos: number;
  /** Lo que el DISEÑO espera de ellos. */
  esperadasPlan: number;
  /** Lo mismo, corregido por lo que su facultad está sacando. */
  esperadasObservado: number;
  /** Acumulados, arrastrando lo ya conseguido. */
  acumuladoPlan: number;
  acumuladoObservado: number;
};

export type CierrePorAgenda = {
  dias: DiaDeAgenda[];
  /** Lo ya conseguido al corte: el punto de partida de las dos curvas. */
  conseguidas: number;
  /** Última fecha con algo agendado, o «» si no hay nada. */
  ultimaFecha: string;
  /** Cursos-horario en juego SIN fecha: el plan no puede cerrar sin ellos. */
  sinAgendar: number;
  /** Lo que esas aulas sin fecha esperan aportar, para poder nombrarlo. */
  esperadasSinAgendar: number;
  /** Por qué no se puede proyectar, si no se puede. */
  motivo: "" | "sin-agenda" | "sin-plan";
};

const texto = (v: unknown) => (v == null ? "" : String(v)).trim();

const numero = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** `2026-09-08` de un valor que puede traer hora pegada. */
function fechaDe(valor: unknown): string {
  const m = texto(valor).match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[0] : "";
}

/**
 * **Los estados se leen de TRES campos, y no por gusto.**
 *
 * Este módulo se escribió mirando `application_state`, que es lo que trae
 * `course_status`… y la AGENDA no lo lleva: el motor la publica desde `plan_df`,
 * donde ese campo todavía no existe. Resultado medido en pantalla el 2026-09-10:
 * el filtro descartaba las 143 filas con fecha, `dias` salía vacío, la vista
 * caía al pronóstico de respaldo y el eje del gráfico se iba a **enero de 2027**.
 *
 * El fixture de los tests tenía la forma del `course_status` y no la de la
 * agenda, así que ningún test lo vio. Ahora los hay de las dos formas.
 */
const APLICADO_ESTADO = new Set(["en_aplicacion", "cerrando"]);
const APLICADO_OPERATIVO = new Set(["aplicada", "cerrada", "parcial"]);
/** Su desenlace ya no es aplicarse por esta vía. */
const FUERA = new Set(["reemplazada", "rechazo", "rechazada", "retirada", "cancelada"]);

const clave = (v: unknown) => texto(v).toLowerCase().replace(/\s+/g, "_");

function estaAplicado(f: MonitoreoRow): boolean {
  return APLICADO_ESTADO.has(clave(f.application_state))
    || APLICADO_OPERATIVO.has(clave(f.operational_status))
    || numero(f.respuestas_validas) > 0;
}

function estaFuera(f: MonitoreoRow): boolean {
  return FUERA.has(clave(f.application_state))
    || FUERA.has(clave(f.sample_status))
    || FUERA.has(clave(f.operational_status));
}

/**
 * @param plan Las filas del plan (`agenda`), con `scheduled_date`,
 *   `expected_valid`, `faculty` y `application_state`.
 * @param corte Día del último parte. Lo agendado ANTES del corte y sin aplicar
 *   ya no va a pasar en su fecha: se arrastra al primer día que queda, porque
 *   fingir que se aplicó ayer sería adelantar el cierre.
 */
export function cierrePorAgenda(
  plan: ReadonlyArray<MonitoreoRow> | null | undefined,
  corte = "",
): CierrePorAgenda {
  const vacio: CierrePorAgenda = {
    dias: [], conseguidas: 0, ultimaFecha: "", sinAgendar: 0,
    esperadasSinAgendar: 0, motivo: "sin-plan",
  };
  const filas = plan ?? [];
  if (!filas.length) return vacio;

  // Primero, lo que cada facultad está sacando de verdad frente a lo previsto.
  // Se mide SOBRE LO APLICADO, que es lo único que tiene resultado.
  const porFacultad = new Map<string, { aulas: number; esperadas: number; efectivas: number }>();
  let conseguidas = 0;
  for (const f of filas) {
    if (!estaAplicado(f)) continue;
    const fac = texto(f.faculty);
    const acc = porFacultad.get(fac) ?? { aulas: 0, esperadas: 0, efectivas: 0 };
    acc.aulas += 1;
    acc.esperadas += numero(f.expected_valid);
    acc.efectivas += numero(f.respuestas_validas);
    porFacultad.set(fac, acc);
    conseguidas += numero(f.respuestas_validas);
  }
  /** 1 = va como el diseño previó. `null` cuando no hay evidencia suficiente. */
  const correccion = (fac: string): number | null => {
    const a = porFacultad.get(fac);
    if (!a || a.aulas < MINIMO_PARA_COMPARAR || a.esperadas <= 0) return null;
    return a.efectivas / a.esperadas;
  };

  const porDia = new Map<string, DiaDeAgenda>();
  let sinAgendar = 0;
  let esperadasSinAgendar = 0;

  for (const f of filas) {
    if (estaAplicado(f) || estaFuera(f)) continue;
    const esperadas = numero(f.expected_valid);
    const fecha = fechaDe(f.scheduled_date ?? f.fecha_agendada ?? f.applied_at);
    if (!fecha) {
      // **Sin fecha, sólo el TITULAR es trabajo pendiente.** Las reservas
      // dormidas y el banco no se agendan: son respaldo, y contarlas aquí
      // volvería a inflar el plan de 174 a 1 392, que es el defecto que este
      // perfil ya corrigió dos veces. Una reserva ACTIVADA sí cuenta, y se
      // reconoce porque tiene fecha.
      if (clave(f.sample_role) === "titular") {
        sinAgendar += 1;
        esperadasSinAgendar += esperadas;
      }
      continue;
    }
    // Lo agendado y no aplicado que ya quedó atrás se mueve al corte: su fecha
    // pasó y sigue pendiente, así que cuenta desde hoy, no desde ayer.
    const dia = corte && fecha < corte ? corte : fecha;
    const acc = porDia.get(dia) ?? {
      fecha: dia, cursos: 0, esperadasPlan: 0, esperadasObservado: 0,
      acumuladoPlan: 0, acumuladoObservado: 0,
    };
    const factor = correccion(texto(f.faculty));
    acc.cursos += 1;
    acc.esperadasPlan += esperadas;
    acc.esperadasObservado += esperadas * (factor ?? 1);
    porDia.set(dia, acc);
  }

  const dias = [...porDia.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
  let plan_ = conseguidas;
  let obs = conseguidas;
  for (const d of dias) {
    plan_ += d.esperadasPlan;
    obs += d.esperadasObservado;
    d.acumuladoPlan = Math.round(plan_ * 10) / 10;
    d.acumuladoObservado = Math.round(obs * 10) / 10;
  }

  return {
    dias,
    conseguidas,
    ultimaFecha: dias.length ? dias[dias.length - 1].fecha : "",
    sinAgendar,
    esperadasSinAgendar: Math.round(esperadasSinAgendar * 10) / 10,
    motivo: dias.length ? "" : "sin-agenda",
  };
}
