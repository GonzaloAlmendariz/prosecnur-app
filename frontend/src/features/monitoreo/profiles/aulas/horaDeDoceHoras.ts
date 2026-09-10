import type { MonitoreoRow } from "../../../../api/monitoreo";

/**
 * Los partes cuya hora de aplicación cae ANTES de que empiece el operativo, y
 * si la ventana del plan sugiere que se escribió en formato de 12 horas.
 *
 * **De dónde sale.** El 2026-09-10, «Fuera de franja» encabezaba la lente de
 * horas con 8 cursos-horario y 207 efectivas, en un panel que se subtitula «a
 * qué hora conviene agendar». Al mirar los partes uno a uno, las nueve horas
 * anteriores a las 7:00 eran 2:45, 3:00, 5:00, 5:04, 5:04, 5:45, 5:45, 6:30 y
 * 6:45 — ninguna madrugada creíble en una universidad—, y **en siete de las
 * nueve la ventana del plan es de tarde y la hora escrita cuadra sumándole doce
 * horas**: R 131.1 a las 2:45 con el curso de 14:00 a 17:00, CH 173 a las 6:30
 * con el de 17:00 a 19:00.
 *
 * **Lo que este módulo NO hace: corregir.** Sumarle doce horas a un dato del
 * campo es inventarlo, y las dos que no cuadran —CH 82 y CH 111— dicen que la
 * regla no es universal. Esto sólo cuenta y aporta la evidencia para que quien
 * lleva la hoja decida; el dato se sigue enseñando tal como vino.
 */

export type HoraDeDoceHoras = {
  codigo: string;
  /**
   * SÓLO la hora, «5:04».
   *
   * El parte publicado manda fecha y hora pegadas en un mismo campo
   * —`applied_at` vale «2026-09-08 5:04»—, así que enseñar el texto crudo
   * repetía la fecha en cada elemento de la lista: «2026-09-08 5:04,
   * 2026-09-08 5:00, 2026-09-08 6:45…». Visto en pantalla el 2026-09-10. La
   * fecha no aporta nada aquí: lo que se está señalando es la HORA.
   */
  escrita: string;
  /** El texto tal cual vino, para quien tenga que ir a buscarlo a la hoja. */
  cruda: string;
  /** La ventana del curso según el plan («MAR 16:00-19:00»), si la hay. */
  ventana: string | null;
  /** La hora escrita más doce horas cae dentro de la ventana del plan. */
  cuadraDeTarde: boolean;
};

/** Igual que el del ranking: «14:30» y «14.30» → 870. */
function minutos(valor: string): number | null {
  const m = valor.match(/(\d{1,2})[:.](\d{2})/);
  if (!m) return null;
  const h = Number(m[1]); const mi = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(mi) || h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

const texto = (v: unknown) => (v == null ? "" : String(v)).trim();

/** Todas las ventanas «HH:MM-HH:MM» de un horario, que puede traer varias sesiones. */
function ventanas(horario: string): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const m of horario.matchAll(/(\d{1,2}[:.]\d{2})\s*[-–]\s*(\d{1,2}[:.]\d{2})/g)) {
    const a = minutos(m[1]); const b = minutos(m[2]);
    if (a != null && b != null && b > a) out.push([a, b]);
  }
  return out;
}

/**
 * @param desde Minuto en que empieza el operativo. Es el mismo 7:00 con el que
 *   `franjaDeAplicacion` manda a «Fuera de franja», y va como parámetro para que
 *   las dos reglas no se separen en silencio si una de las dos cambia.
 */
export function horasDeDoceHoras(
  partes: ReadonlyArray<MonitoreoRow> | null | undefined,
  plan: ReadonlyArray<MonitoreoRow> | null | undefined,
  desde = 7 * 60,
): HoraDeDoceHoras[] {
  const horarioPorCodigo = new Map<string, string>();
  for (const fila of plan ?? []) {
    const codigo = texto(fila?.operational_code);
    if (!codigo || horarioPorCodigo.has(codigo)) continue;
    // `sesiones_dia_hora` es el horario limpio («MAR 16:00-19:00»); `schedule`
    // trae lo mismo con el aula pegada detrás y sirve de respaldo.
    const horario = texto(fila?.sesiones_dia_hora) || texto(fila?.schedule);
    if (horario) horarioPorCodigo.set(codigo, horario);
  }

  const out: HoraDeDoceHoras[] = [];
  for (const p of partes ?? []) {
    const cruda = texto(p?.applied_time) || texto(p?.applied_at);
    const t = minutos(cruda);
    if (t == null || t >= desde) continue;
    const escrita = (cruda.match(/\d{1,2}[:.]\d{2}/) ?? [cruda])[0];
    const codigo = texto(p?.operational_code);
    const ventana = horarioPorCodigo.get(codigo) ?? null;
    const deTarde = t + 12 * 60;
    const cuadraDeTarde = ventanas(ventana ?? "").some(([a, b]) => deTarde >= a && deTarde <= b);
    out.push({ codigo, escrita, cruda, ventana, cuadraDeTarde });
  }
  return out;
}
