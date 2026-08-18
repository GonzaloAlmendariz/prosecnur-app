import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";

/**
 * Qué aulas ya pasaron su fecha y siguen sin parte.
 *
 * El perfil sabía por separado las dos mitades —la agenda tiene la fecha de cada
 * aula, la hoja de partes dice cuáles se llenaron— y nadie las cruzaba. Sin ese
 * cruce, «cómo va el operativo» sólo se podía contestar en agregado: cuántas
 * respuestas por día, cuántas aulas por estado. Ninguna de las dos dice **a qué
 * aula hay que ir a reclamar hoy**, que es la pregunta que se hace a mitad de
 * campo.
 *
 * Un aula vencida sin parte no es lo mismo que un aula pendiente: la pendiente
 * todavía tiene su día por delante y la vencida ya lo gastó.
 */

export type AulaVencida = {
  codigo: string;
  facultad: string;
  fecha: string;
  hora: string;
  donde: string;
  /** Días corridos desde su fecha hasta el corte. */
  dias: number;
};

export type FrenteDelOperativo = {
  /** Aulas del plan con fecha declarada. Es el denominador de todo lo demás. */
  conFecha: number;
  /** Ya pasaron su fecha. */
  vencidas: number;
  /** De las vencidas, las que sí tienen parte. */
  vencidasConParte: number;
  /** Las vencidas sin parte, de la más antigua a la más reciente. */
  pendientes: AulaVencida[];
  /** Todavía no llega su día. */
  porVenir: number;
  /** Sin fecha en la agenda: no se pueden situar en el tiempo. */
  sinFecha: number;
};

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : valor == null ? "" : String(valor).trim();
}

function dias(desde: string, hasta: string): number {
  const a = Date.parse(`${desde}T00:00:00`);
  const b = Date.parse(`${hasta}T00:00:00`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((b - a) / 86400000);
}

/**
 * @param filas la agenda del plan, con `scheduled_date`.
 * @param partes la hoja de partes; se une por `operational_code`, la MISMA clave
 *   que usa `parteDeCampo`, para que dos superficies no discrepen en qué aula
 *   tiene parte.
 * @param corte el día contra el que se mide, en ISO. Entra por argumento y no se
 *   toma del reloj: un panel que lee `new Date()` da un resultado distinto cada
 *   vez que se abre y no hay forma de fijarlo en un test.
 */
export function frenteDelOperativo(
  filas: ReadonlyArray<MonitoreoAulasPlanRow>,
  partes: ReadonlyArray<Record<string, unknown>>,
  corte: string,
): FrenteDelOperativo {
  const conParte = new Set<string>();
  for (const fila of partes) {
    const codigo = texto(fila.operational_code);
    if (codigo) conParte.add(codigo);
  }

  const pendientes: AulaVencida[] = [];
  let conFecha = 0;
  let vencidas = 0;
  let vencidasConParte = 0;
  let porVenir = 0;
  let sinFecha = 0;

  for (const fila of filas) {
    // El BANCO fuera. Los extras no están agendados —no cuelgan de ningún
    // titular y no tienen día que vencer— y contarlos hacía que el panel
    // hablara de 236 cursos-horario donde la agenda tiene 196. Es la misma
    // corrección que ya hubo que hacer en la agenda y en la meta.
    if (texto(fila.sample_role) === "extra_reserve_pool") continue;
    const fecha = texto(fila.scheduled_date);
    if (!fecha) { sinFecha += 1; continue; }
    conFecha += 1;
    // El día del corte NO cuenta como vencido: el aula todavía puede aplicarse
    // esa misma tarde, y marcarla en rojo por la mañana es una alarma falsa.
    if (dias(fecha, corte) <= 0) { porVenir += 1; continue; }
    vencidas += 1;
    const codigo = texto(fila.operational_code);
    if (conParte.has(codigo)) { vencidasConParte += 1; continue; }
    pendientes.push({
      codigo,
      facultad: texto(fila.faculty) || "Sin facultad",
      fecha,
      hora: texto(fila.scheduled_time),
      donde: texto(fila.label),
      dias: dias(fecha, corte),
    });
  }

  // De la más antigua a la más reciente: la que lleva más días caída es la que
  // más difícil va a ser de recuperar, y es por donde hay que empezar.
  pendientes.sort((a, b) => b.dias - a.dias
    || a.facultad.localeCompare(b.facultad, "es")
    || a.codigo.localeCompare(b.codigo, "es", { numeric: true }));

  return { conFecha, vencidas, vencidasConParte, pendientes, porVenir, sinFecha };
}
