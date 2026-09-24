import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { esMuestraAgendada } from "./muestraAgendada";

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
): { medios: MedioDeContacto[]; aplicadasSinMedio: number } {
  const porMedio = new Map<string, { aulas: number; agendadas: number; intentos: number[]; fuera: number }>();
  let aplicadasSinMedio = 0;

  for (const fila of filas) {
    // La reserva adicional no se contacta: no cuelga de ningún titular ni tiene agenda.
    if (texto(fila.sample_role) === "extra_reserve_pool") continue;
    const medio = texto(fila.contact_medium);
    if (!medio) {
      /**
       * **Lo que se descarta se cuenta, no desaparece.**
       *
       * Estas filas salían del gráfico en silencio. La mayoría es legítima —una
       * reserva dormida no se ha contactado y no tiene por qué declarar medio—
       * pero **las que ya tienen parte sí se contactaron**: alguien las agendó y
       * no dejó por dónde.
       *
       * Medido sobre HSVG2026 «como 2025»: de las 152 filas con parte, **31 no
       * declaran medio** —13 titulares y 18 reservas—, y el panel hablaba de las
       * 121 restantes como si fueran todas. Una de cada cinco.
       *
       * El módulo ya contaba `intentosDescartados` por la misma razón; esto
       * aplica la misma disciplina al descarte de más arriba.
       */
      // **Sólo cuenta si hubo gestión.** Una reserva que se activó al caer su
      // titular hereda la cita: nadie la contactó, así que no tiene medio que
      // declarar y contarla seria una falsa alarma.
      //
      // Medido sobre HSVG2026 «como 2025»: de las 31 con parte y sin medio, **18
      // son reservas con CERO intentos** —las activadas— y 13 son titulares con
      // entre 1 y 7 gestiones. Sólo esos 13 son un hueco de registro: se les
      // contactó y no se anotó por dónde.
      const gestiones = Number(fila.contact_attempts);
      if (texto(fila.applied_at) && Number.isFinite(gestiones) && gestiones > 0) {
        aplicadasSinMedio += 1;
      }
      continue;
    }
    let m = porMedio.get(medio);
    if (!m) { m = { aulas: 0, agendadas: 0, intentos: [], fuera: 0 }; porMedio.set(medio, m); }
    m.aulas += 1;
    // «Agendada» y «reagendada» cuentan las dos: el medio consiguió la cita, que
    // luego se moviera es otra historia.
    if (esMuestraAgendada(fila.sample_status)) m.agendadas += 1;
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
  const medios = salida.sort((x, y) => y.tasa - x.tasa
    || (x.intentos ?? Infinity) - (y.intentos ?? Infinity)
    || y.aulas - x.aulas);
  return { medios, aplicadasSinMedio };
}

/**
 * Si la diferencia entre dos medios es mayor que el azar de sus tamaños.
 *
 * El panel se titula «Qué medio agenda mejor» y su lectura ordena dos medios.
 * Medido sobre el corte: **Llamada 82,3 % (121 de 147) y Correo 79,6 % (39 de
 * 49)**, o sea **2,7 puntos de diferencia contra una banda de 13,1**. Con esos
 * tamaños, esa distancia sale por casualidad la mitad de las veces, y quien lee
 * «Llamada agenda mejor» cambia cómo se contacta a la gente por nada.
 *
 * Se compara contra dos errores estándar de la diferencia de proporciones. Es la
 * misma disciplina que la tasa de caída y la tendencia por facultad: **la cifra
 * se enseña siempre, pero sólo se ordena lo que el dato sostiene**.
 */
export function difereDeVerdad(a: MedioDeContacto, b: MedioDeContacto): boolean {
  if (!a.aulas || !b.aulas) return false;
  const pa = a.agendadas / a.aulas;
  const pb = b.agendadas / b.aulas;
  const error = Math.sqrt((pa * (1 - pa)) / a.aulas + (pb * (1 - pb)) / b.aulas);
  if (error <= 0) return pa !== pb;
  return Math.abs(pa - pb) > 2 * error;
}
