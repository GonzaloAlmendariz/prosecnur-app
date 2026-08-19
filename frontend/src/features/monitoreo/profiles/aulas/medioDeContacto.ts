import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";

/**
 * Qué medio de contacto agenda mejor, y a qué coste en intentos.
 *
 * Medido en el libro real de 2025 (194 filas): la llamada agenda el **80 %** con
 * **2** intentos de mediana y el correo el **65 %** con **3**. Es una
 * preferencia leve, no una regla — el correo agenda dos de cada tres.
 *
 * **Siempre la MEDIANA, nunca la media.** En el libro real la media de intentos
 * del correo sale 19,65 porque la columna tiene fechas de Excel filtradas
 * (45909, 23252). Un panel que dijera «19,65 intentos por correo» llevaría a
 * prohibir el correo; el dato real dice «prefiere llamar cuando puedas». La
 * diferencia entre las dos lecturas es una decisión operativa distinta.
 */

export type MedioDeContacto = {
  medio: string;
  aulas: number;
  agendadas: number;
  /** Porcentaje de agendadas sobre las aulas de ese medio, 0-100. */
  tasa: number;
  /** Mediana de intentos. `null` si ninguna fila la declara. */
  intentos: number | null;
  /** Filas cuyo número de intentos es absurdo y quedan fuera de la mediana. */
  intentosDescartados: number;
};

/**
 * Tope de cordura para el número de intentos.
 *
 * Ninguna aula se llama cien veces: en el libro real el máximo creíble es 7 y lo
 * que pasa de ahí son fechas de Excel que se colaron en la columna. Se descartan
 * de la mediana y se CUENTAN, para que el descarte se vea y no parezca que el
 * dato estaba limpio.
 */
const INTENTOS_MAXIMO_CREIBLE = 50;

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : valor == null ? "" : String(valor).trim();
}

function mediana(xs: number[]): number | null {
  if (!xs.length) return null;
  const o = [...xs].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : Math.round(((o[m - 1] + o[m]) / 2) * 10) / 10;
}

export function medioDeContacto(
  filas: ReadonlyArray<MonitoreoAulasPlanRow>,
): MedioDeContacto[] {
  const porMedio = new Map<string, { aulas: number; agendadas: number; intentos: number[]; fuera: number }>();

  for (const fila of filas) {
    // El banco no se contacta: no cuelga de ningún titular ni tiene agenda.
    if (texto(fila.sample_role) === "extra_reserve_pool") continue;
    const medio = texto(fila.contact_medium);
    if (!medio) continue;
    let m = porMedio.get(medio);
    if (!m) { m = { aulas: 0, agendadas: 0, intentos: [], fuera: 0 }; porMedio.set(medio, m); }
    m.aulas += 1;
    // «Agendada» y «reagendada» cuentan las dos: el medio consiguió la cita, que
    // luego se moviera es otra historia.
    const estado = texto(fila.sample_status).toLowerCase();
    if (estado.startsWith("agendada") || estado.startsWith("reagendada")) m.agendadas += 1;
    const n = Number(fila.contact_attempts);
    if (Number.isFinite(n) && n > 0) {
      if (n <= INTENTOS_MAXIMO_CREIBLE) m.intentos.push(n);
      else m.fuera += 1;
    }
  }

  const salida = [...porMedio.entries()].map(([medio, m]) => ({
    medio,
    aulas: m.aulas,
    agendadas: m.agendadas,
    tasa: m.aulas ? Math.round((1000 * m.agendadas) / m.aulas) / 10 : 0,
    intentos: mediana(m.intentos),
    intentosDescartados: m.fuera,
  }));

  // Por el que MÁS agenda. A igualdad, el que lo consigue con menos intentos.
  return salida.sort((x, y) => y.tasa - x.tasa
    || (x.intentos ?? Infinity) - (y.intentos ?? Infinity)
    || y.aulas - x.aulas);
}
