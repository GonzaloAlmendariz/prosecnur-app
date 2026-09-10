import { fechaIsoReal } from "./agendaPorDia";
import { MES_LARGO } from "../../mesesEnPalabras";
import type { DiaDeAgenda } from "./agendaPorDia";

/**
 * La agenda colocada en un calendario: semanas de lunes a domingo entre el
 * primer y el último día agendado del plan.
 *
 * Recibe el `dias` que ya produce `agendaPorDia` —fecha, total del día, sin
 * empezar— y sólo lo COLOCA: recalcular el agregado aquí sería tener dos
 * dueños del mismo número, el tropiezo que la leyenda de tramos ya pagó una
 * vez.
 *
 * Lo que no cabe en un calendario se declara en vez de esfumarse:
 *
 * - una fecha imposible del libro («2026-09-31») no se puede colocar sin
 *   inventarle un día → `fechasIlegibles`, tal como está escrita;
 * - un año tecleado mal («2062») fabricaría casi dos mil semanas vacías → el
 *   lienzo se acota a {@link MAX_SEMANAS} y el resto va a `fueraDelLienzo`;
 * - el grupo sin fecha no tiene celda: su repisa la pinta la superficie.
 *
 * Puro a propósito: `hoy` entra como parámetro ISO —el mapa del martes se
 * calcula igual el lunes que el miércoles—; el reloj lo consulta el
 * componente con {@link hoyISO}.
 */

const MS_DIA = 86_400_000;

/** Techo del lienzo: medio año de semanas ya es un operativo, no un typo. */
export const MAX_SEMANAS = 26;

/** La fecha LOCAL del usuario como ISO: hoy según su reloj, no según UTC. */
export function hoyISO(ahora: Date = new Date()): string {
  const y = ahora.getFullYear();
  const m = String(ahora.getMonth() + 1).padStart(2, "0");
  const d = String(ahora.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const comoISO = (dt: Date): string => dt.toISOString().slice(0, 10);

export type CeldaDeCalendario = {
  /** `YYYY-MM-DD` de la celda. */
  fecha: string;
  diaDelMes: number;
  /** Dentro del rango agendado; el relleno de semana queda fuera. */
  enRango: boolean;
  esHoy: boolean;
  aulas: number;
  sinEmpezar: number;
  cumplen: number;
};

export type SemanaDeCalendario = CeldaDeCalendario[];

export type CalendarioDeAgenda = {
  semanas: SemanaDeCalendario[];
  /** «septiembre 2026», o «agosto – septiembre 2026» si el campo cruza mes. */
  titulo: string;
  /** Fechas del libro que no existen: se declaran tal como están escritas. */
  fechasIlegibles: Array<{ fecha: string; aulas: number }>;
  /** Días reales que quedaron más allá del techo del lienzo. */
  fueraDelLienzo: Array<{ fecha: string; aulas: number }>;
};

export function calendarioDeAgenda(
  dias: ReadonlyArray<DiaDeAgenda>,
  hoy: string,
): CalendarioDeAgenda {
  const validos: Array<{ dia: DiaDeAgenda; fecha: Date }> = [];
  const fechasIlegibles: Array<{ fecha: string; aulas: number }> = [];
  for (const dia of dias) {
    if (!dia.fecha) continue; // la repisa «sin fecha» es de la superficie
    const partes = fechaIsoReal(dia.fecha);
    if (partes) validos.push({ dia, fecha: partes.fecha });
    else fechasIlegibles.push({ fecha: dia.fecha, aulas: dia.aulas });
  }

  if (!validos.length) {
    return { semanas: [], titulo: "", fechasIlegibles, fueraDelLienzo: [] };
  }

  const porFecha = new Map<string, DiaDeAgenda>();
  for (const { dia } of validos) porFecha.set(dia.fecha, dia);

  const tiempos = validos.map((v) => v.fecha.getTime());
  const minMs = Math.min(...tiempos);
  const maxMs = Math.max(...tiempos);
  const minISO = comoISO(new Date(minMs));
  const maxISO = comoISO(new Date(maxMs));

  // Lunes de la primera semana y domingo de la última (getUTCDay: 0=domingo).
  const diaSemana = (ms: number) => new Date(ms).getUTCDay();
  const inicioMs = minMs - ((diaSemana(minMs) + 6) % 7) * MS_DIA;
  const finMs = maxMs + ((7 - diaSemana(maxMs)) % 7) * MS_DIA;

  const semanasPedidas = Math.round((finMs - inicioMs) / MS_DIA + 1) / 7;
  const semanasReales = Math.min(semanasPedidas, MAX_SEMANAS);
  const lienzoFinMs = inicioMs + (semanasReales * 7 - 1) * MS_DIA;

  const semanas: SemanaDeCalendario[] = [];
  for (let s = 0; s < semanasReales; s += 1) {
    const semana: CeldaDeCalendario[] = [];
    for (let d = 0; d < 7; d += 1) {
      const ms = inicioMs + (s * 7 + d) * MS_DIA;
      const fecha = comoISO(new Date(ms));
      const propio = porFecha.get(fecha);
      semana.push({
        fecha,
        diaDelMes: new Date(ms).getUTCDate(),
        enRango: fecha >= minISO && fecha <= maxISO,
        esHoy: fecha === hoy,
        aulas: propio?.aulas ?? 0,
        sinEmpezar: propio?.sinEmpezar ?? 0,
        cumplen: propio?.cumplen ?? 0,
      });
    }
    semanas.push(semana);
  }

  const fueraDelLienzo = validos
    .filter((v) => v.fecha.getTime() > lienzoFinMs)
    .sort((a, b) => a.fecha.getTime() - b.fecha.getTime())
    .map((v) => ({ fecha: v.dia.fecha, aulas: v.dia.aulas }));

  const desde = new Date(minMs);
  const hasta = new Date(maxMs);
  const mesDesde = `${MES_LARGO[desde.getUTCMonth()]}${desde.getUTCFullYear() !== hasta.getUTCFullYear() ? ` ${desde.getUTCFullYear()}` : ""}`;
  const mesHasta = `${MES_LARGO[hasta.getUTCMonth()]} ${hasta.getUTCFullYear()}`;
  const titulo = desde.getUTCMonth() === hasta.getUTCMonth() && desde.getUTCFullYear() === hasta.getUTCFullYear()
    ? mesHasta
    : `${mesDesde} – ${mesHasta}`;

  return { semanas, titulo, fechasIlegibles, fueraDelLienzo };
}
