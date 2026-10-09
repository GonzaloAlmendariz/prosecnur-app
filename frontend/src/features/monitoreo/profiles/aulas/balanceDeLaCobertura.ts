import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";

/**
 * **¿Vamos en déficit o en superávit, y con lo agendado llegamos?**
 *
 * Gonzalo, 2026-09-10, sobre «Cursos-horario por cobertura»: «esto está súper
 * bien, pero no nos dice si estamos en déficit o superávit de lo esperado a
 * fecha de hoy con las aplicadas hasta ahora, y si con las esperadas agendadas
 * llegamos».
 *
 * El panel repartía los aplicados en seis tramos y publicaba las dos TASAS
 * —«se les pedía 53,9 % y están rindiendo 60,0 %»—. Una tasa contesta «¿rinden
 * lo que se supuso?»; él pregunta otras dos cosas, y las dos en PERSONAS:
 *
 * 1. **A fecha de hoy**: de los cursos-horario ya aplicados se esperaban N
 *    respuestas y han llegado M. La diferencia es el déficit o el superávit
 *    acumulado, y en personas se lee de una vez —«+26»— donde «+6,1 puntos»
 *    obliga a multiplicar por los elegibles para saber si son diez o doscientas.
 * 2. **Con lo agendado**: sumando lo que se espera de los cursos-horario que ya
 *    tienen fecha y todavía no se han aplicado, ¿se alcanza la cuota?
 *
 * **Y la segunda se contesta DOS veces**, que es la instrucción suya de fondo:
 * «contrastando siempre que tenemos un rendimiento diferenciado entre el
 * rendimiento planificado y el rendimiento que vamos encontrando». Con la tasa
 * del diseño y con la que está dando el campo, porque son distintas y la
 * respuesta puede cambiar de una a otra.
 *
 * Las esperadas de un curso-horario son `expected_valid` —sus elegibles por la
 * tasa que el diseño le supuso— y no se recalculan aquí. La cadena, que ya costó
 * una discusión: matriculados → elegibles (criterios) → los que esperamos ver
 * (asistencia) → los que esperamos que respondan (efectividad) → efectivas.
 * `expected_valid` es el cuarto eslabón.
 */

const numero = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const texto = (v: unknown) => (v == null ? "" : String(v)).trim();

/** Los que ya se visitaron: es el mismo par de claves del motor que usa el reparto. */
const APLICADO = new Set(["en_aplicacion", "cerrando"]);
/** Los que tienen fecha y todavía no se han aplicado. */
const AGENDADO = new Set(["lista"]);

export type BalanceDeLaCobertura = {
  /** Lo aplicado hasta hoy. */
  aplicados: number;
  esperadasHoy: number;
  efectivas: number;
  /** Positivo = superávit; negativo = déficit. En PERSONAS. */
  balance: number;
  /** Lo que ya tiene fecha y aún no se aplica. */
  agendados: number;
  /** Lo que esas aulas darían a la tasa del DISEÑO. */
  esperadasAgendadas: number;
  /**
   * Lo que darían a la tasa que está dando el campo. `null` cuando no hay tasa
   * observada con la que proyectar —sin aplicados o sin elegibles—.
   */
  esperadasAlRitmo: number | null;
  /** La cuota contra la que se mide; `null` si no llegó. */
  cuota: number | null;
  /** Adónde se llega con lo aplicado más lo agendado, en las dos tasas. */
  conAgendaPrevisto: number;
  conAgendaObservado: number | null;
};

export function balanceDeLaCobertura(
  filas: ReadonlyArray<MonitoreoAulasPlanRow> | null | undefined,
  cuota: number | null | undefined,
): BalanceDeLaCobertura | null {
  let aplicados = 0, esperadasHoy = 0, efectivas = 0, elegiblesAplicados = 0;
  let agendados = 0, esperadasAgendadas = 0, elegiblesAgendados = 0;

  for (const f of filas ?? []) {
    const estado = texto((f as Record<string, unknown>).application_state);
    const elegibles = numero(f.eligible_n);
    if (APLICADO.has(estado)) {
      aplicados += 1;
      esperadasHoy += numero(f.expected_valid);
      efectivas += numero(f.respuestas_validas);
      elegiblesAplicados += elegibles;
    } else if (AGENDADO.has(estado)) {
      agendados += 1;
      esperadasAgendadas += numero(f.expected_valid);
      elegiblesAgendados += elegibles;
    }
  }

  if (!aplicados && !agendados) return null;

  // La tasa OBSERVADA, sobre los elegibles de lo aplicado. Es la misma que
  // publica `tasasDeLaCobertura`; aquí se usa para proyectar lo agendado.
  const observada = elegiblesAplicados > 0 ? efectivas / elegiblesAplicados : null;
  const esperadasAlRitmo = observada != null && elegiblesAgendados > 0
    ? Math.round(observada * elegiblesAgendados)
    : null;

  const c = cuota == null || !Number.isFinite(Number(cuota)) ? null : Math.round(Number(cuota));
  const conAgendaPrevisto = Math.round(efectivas + esperadasAgendadas);

  return {
    aplicados,
    esperadasHoy: Math.round(esperadasHoy),
    efectivas: Math.round(efectivas),
    // **En personas y con signo.** «+6,1 puntos» obliga a multiplicar por los
    // elegibles para saber si son diez personas o doscientas.
    balance: Math.round(efectivas - esperadasHoy),
    agendados,
    esperadasAgendadas: Math.round(esperadasAgendadas),
    esperadasAlRitmo,
    cuota: c,
    conAgendaPrevisto,
    conAgendaObservado: esperadasAlRitmo == null ? null : Math.round(efectivas + esperadasAlRitmo),
  };
}
