import type { MonitoreoAulasFranjas, MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { leerFecha, leerSesiones } from "./cargaDeCampo";

/**
 * Código → aviso de choque entre la cita pactada y el horario de la clase.
 *
 * Dictado de Gonzalo (2026-09-03, señalando CH 30 en la ruta: «aquí choca la
 * información»): cita pactada 12:40, clase MIE 10:00–13:00, aplicación de
 * 30 min → termina 13:10, diez minutos después del fin de la clase, y los
 * dos datos convivían en la fila sin que nada los confrontara.
 *
 * Las horas vienen SIEMPRE del motor (B11): las ventanas de `franjas` traen
 * el am/pm ya resuelto y la duración llega con eco (`duracion_min`, B70) —
 * re-parsear `scheduled_time` en el cliente es el bug medido del «8:00pm»
 * leído como 08:00. Los bloques de la clase salen de `leerSesiones`, el
 * mismo parser del patrón semanal.
 *
 * Solo se declaran los DOS choques computables sin adivinar:
 *  - la aplicación rebasa el fin del bloque que la contiene;
 *  - la pactada cae fuera de todos los bloques de ese día de semana, cuando
 *    ese día SÍ declara bloques (un sábado extra pactado a propósito no se
 *    marca: el plan no sabe de acuerdos fuera de horario y acusarlos sería
 *    ruido).
 */

const minutos = (t: unknown): number | null => {
  const m = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(String(t ?? ""));
  if (!m) return null;
  const n = Number(m[1]) * 60 + Number(m[2]);
  return Number.isFinite(n) && n >= 0 && n < 24 * 60 ? n : null;
};

const hhmm = (n: number) =>
  `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;

/** ISO `YYYY-MM-DD` → día en la numeración de `leerSesiones` (LUN=0…SAB=5). */
const diaDeSemana = (fecha: string): number => {
  const d = new Date(`${fecha}T12:00:00`).getDay();
  return d === 0 ? -1 : d - 1;
};

export function choquesDeHorario(
  filas: ReadonlyArray<MonitoreoAulasPlanRow>,
  franjas: MonitoreoAulasFranjas | null | undefined,
): Map<string, string> {
  const out = new Map<string, string>();
  const duracion = Number(franjas?.duracion_min) || 30;

  const ventanas = new Map<string, { fecha: string; inicio: number }>();
  for (const dia of franjas?.dias ?? []) {
    const fecha = leerFecha(dia?.fecha);
    for (const v of dia?.ventanas ?? []) {
      if (v?.confirmada !== true) continue;
      const codigo = String(v.codigo ?? "").trim();
      const inicio = minutos(v.inicio);
      if (codigo && fecha && inicio !== null && !ventanas.has(codigo)) {
        ventanas.set(codigo, { fecha, inicio });
      }
    }
  }
  if (!ventanas.size) return out;

  for (const fila of filas) {
    const codigo = String(fila.operational_code ?? "").trim();
    const v = codigo ? ventanas.get(codigo) : undefined;
    if (!v) continue;
    const bloques = leerSesiones(fila.sesiones_dia_hora).filter(
      (b) => b.dia === diaDeSemana(v.fecha),
    );
    if (!bloques.length) continue;
    const contiene = bloques.find((b) => v.inicio >= b.desde && v.inicio < b.hasta);
    if (!contiene) {
      out.set(codigo, `la hora pactada (${hhmm(v.inicio)}) cae fuera del horario de la clase`);
      continue;
    }
    const fin = v.inicio + duracion;
    if (fin > contiene.hasta) {
      out.set(
        codigo,
        `la aplicación de ${duracion} min termina ${hhmm(fin)}, después del fin de la clase (${hhmm(contiene.hasta)})`,
      );
    }
  }
  return out;
}
