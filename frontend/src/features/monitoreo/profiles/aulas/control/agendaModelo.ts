import type { MonitoreoAulasDashboard } from "../../../../../api/monitoreo";
import { facultadEnPalabras } from "../../../../../lib/nombresDeFacultad";
import { numeroONulo } from "../avanceCuota";
import { fmt } from "../kpisDeAulas";
import { readinessDeAulas } from "../navegacion/readinessDeAulas";
import type { Vacio } from "../avance/porFacultadModelo";

/**
 * Control › Agenda (ficha Ctl1 de `docs/qa/revamp-monitoreo/aulas.md`), listo
 * para pintar. ¿Qué citas tiene la semana y qué falta agendar?
 *
 * - Franja: citas de la semana, aplicadas, hoy, con respuestas sin parte,
 *   vencidas y sin cita.
 * - Izquierda: «Sin cita» y «Citas vencidas», de las acciones que publica el
 *   motor (`course_status_rol_y_estado.acciones`), con su curso-horario.
 * - Derecha: la semana de lunes a viernes (sábado si tiene citas), de 7:00 a
 *   22:00, con cada cita en su hora.
 *
 * P8 respondida: manda el parte. Un curso-horario con parte en el libro está
 * aplicado aunque la agenda diga «pendiente»; con respuestas y sin parte se
 * dice así, no se da por aplicado.
 */

export const MARCA_AGENDA_AULAS = readinessDeAulas("control", "agenda");

export const HORA_INICIO = 7;
export const HORA_FIN = 22;

export type EstadoDeCita = "aplicada" | "sin-parte" | "vencida" | "por-aplicar";

export type Cita = {
  codigo: string;
  fecha: string;
  /** Minutos desde la medianoche; `null` sin hora legible. */
  minuto: number | null;
  hora: string;
  lugar: string;
  papel: string;
  estado: EstadoDeCita;
  texto: string;
};

export type DiaDeLaSemana = { fecha: string; rotulo: string; esHoy: boolean; citas: Cita[] };

export type FilaPendiente = { codigo: string; lugar: string; facultad: string; elegibles: string; detalle: string };

export type CifraDeAgenda = { clave: string; rotulo: string; valor: string; sub: string; tono: "ok" | "aviso" | "riesgo" | "neutro" };

export type ModeloAgenda =
  | { estado: "sin-tablero" }
  | {
    estado: "listo";
    franja: CifraDeAgenda[];
    semana: { titulo: string; dias: DiaDeLaSemana[]; anterior: string | null; siguiente: string | null } | { vacio: Vacio };
    sinCita: FilaPendiente[];
    vencidas: FilaPendiente[];
    /** Citas cuya hora no se pudo leer: se dicen, no se esconden. */
    sinHora: number;
  };

const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "setiembre", "octubre", "noviembre", "diciembre"];
const PAPEL: Record<string, string> = { titular: "Titular", chain_reserve: "Reserva", extra_reserve_pool: "Banco" };

function texto(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

function fila(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

/** «2:10 pm», «14:10», «9:45 am» → minutos. */
export function minutoDeHora(hora: string): number | null {
  const m = /^(\d{1,2}):(\d{2})\s*([ap]\.?\s*m\.?)?/i.exec(hora.trim());
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  const sufijo = (m[3] ?? "").toLowerCase();
  if (sufijo.startsWith("p") && h !== 12) h += 12;
  if (sufijo.startsWith("a") && h === 12) h = 0;
  return h >= 0 && h < 24 && min < 60 ? h * 60 + min : null;
}

function diaIso(fecha: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(fecha);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) ? null : d;
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function lunesDe(fecha: string): string {
  const d = diaIso(fecha);
  if (!d) return fecha;
  const dia = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - ((dia + 6) % 7));
  return iso(d);
}

function sumarDias(fecha: string, n: number): string {
  const d = diaIso(fecha);
  if (!d) return fecha;
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
}

function lugarDe(r: Record<string, unknown>): string {
  return (texto(r.scheduled_venue) || texto(r.venue)).split(/\s+/)[0] ?? "";
}

function estadoDe(r: Record<string, unknown>, conParte: Set<string>, hoy: string): { estado: EstadoDeCita; texto: string } {
  const codigo = texto(r.operational_code);
  const efectivas = numeroONulo(r.respuestas_validas) ?? 0;
  if (conParte.has(codigo) || texto(r.application_status).toLowerCase() === "aplicada") {
    return { estado: "aplicada", texto: `Aplicada, ${fmt(efectivas)} efectivas` };
  }
  if (efectivas > 0) return { estado: "sin-parte", texto: `${fmt(efectivas)} respuestas, sin parte` };
  if (texto(r.scheduled_date) < hoy) return { estado: "vencida", texto: "Cita vencida" };
  return { estado: "por-aplicar", texto: "Por aplicar" };
}

function fechaLarga(fecha: string): string {
  const d = diaIso(fecha);
  return d ? `${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}` : fecha;
}

/**
 * @param semana lunes de la semana pedida (`YYYY-MM-DD`); vacío = la semana de
 *   hoy si tiene citas, si no la última semana con citas.
 * @param hoy fecha local `YYYY-MM-DD`.
 */
export function construirAgenda(dashboard: MonitoreoAulasDashboard | null, hoy: string, semana = ""): ModeloAgenda {
  if (!dashboard) return { estado: "sin-tablero" };
  const agenda = (Array.isArray(dashboard.agenda) ? dashboard.agenda : []).map(fila);
  const porCodigo = new Map(agenda.map((r) => [texto(r.operational_code), r]));
  const conParte = new Set(((dashboard.partes_campo ?? []) as unknown[]).map((p) => texto(fila(p).operational_code)).filter(Boolean));

  const agendadas = agenda.filter((r) => /^\d{4}-\d{2}-\d{2}/.test(texto(r.scheduled_date)));
  const lunesConCitas = [...new Set(agendadas.map((r) => lunesDe(texto(r.scheduled_date))))].sort();
  const lunesHoy = lunesDe(hoy);
  const elegido = semana && lunesConCitas.includes(semana)
    ? semana
    : lunesConCitas.includes(lunesHoy)
      ? lunesHoy
      : [...lunesConCitas].reverse().find((l) => l <= lunesHoy) ?? lunesConCitas[lunesConCitas.length - 1] ?? "";

  let sinHora = 0;
  const citasDe = (fecha: string): Cita[] => agendadas
    .filter((r) => texto(r.scheduled_date).slice(0, 10) === fecha)
    .map((r): Cita => {
      const hora = texto(r.scheduled_time);
      const minuto = minutoDeHora(hora);
      if (minuto == null) sinHora += 1;
      const e = estadoDe(r, conParte, hoy);
      return {
        codigo: texto(r.operational_code), fecha, minuto, hora, lugar: lugarDe(r),
        papel: PAPEL[texto(r.sample_role)] ?? "Titular", estado: e.estado, texto: e.texto,
      };
    })
    .sort((a, b) => (a.minuto ?? 9999) - (b.minuto ?? 9999));

  const acciones = dashboard.course_status_rol_y_estado?.acciones ?? {};
  const lista = (codigos: unknown, detalle: (r: Record<string, unknown>) => string): FilaPendiente[] =>
    (Array.isArray(codigos) ? codigos : codigos ? [codigos] : []).map((c) => {
      const r = porCodigo.get(texto(c)) ?? {};
      return {
        codigo: texto(c),
        lugar: lugarDe(r),
        facultad: facultadEnPalabras(texto(r.faculty)) || texto(r.faculty),
        elegibles: fmt(numeroONulo(r.eligible_n) ?? 0),
        detalle: detalle(r),
      };
    });
  const sinCita = lista(acciones.sin_agendar, (r) => {
    const gestiones = numeroONulo(r.contact_attempts);
    const resultado = texto(r.call_status) || "Sin contactar";
    return gestiones ? `${resultado}, ${fmt(gestiones)} ${gestiones === 1 ? "gestión" : "gestiones"}` : resultado;
  });
  const vencidas = lista(acciones.agendado_vencido, (r) => {
    const d = diaIso(texto(r.scheduled_date));
    return d ? `Citada el ${d.getUTCDate()} ${MESES[d.getUTCMonth()].slice(0, 3)}` : "Cita vencida";
  });

  let semanaModelo: Extract<ModeloAgenda, { estado: "listo" }>["semana"];
  let citasSemana: Cita[] = [];
  if (!elegido) {
    semanaModelo = { vacio: { clase: "legitimo", causa: "Todavía no hay citas en la agenda." } };
  } else {
    const fechas = [0, 1, 2, 3, 4, 5].map((n) => sumarDias(elegido, n));
    const dias = fechas.map((fecha) => {
      const d = diaIso(fecha)!;
      return { fecha, rotulo: `${DIAS[d.getUTCDay()]} ${d.getUTCDate()}`, esHoy: fecha === hoy, citas: citasDe(fecha) };
    }).filter((d, i) => i < 5 || d.citas.length > 0);
    citasSemana = dias.flatMap((d) => d.citas);
    const i = lunesConCitas.indexOf(elegido);
    semanaModelo = {
      titulo: `Semana del ${fechaLarga(fechas[0])} al ${fechaLarga(dias[dias.length - 1].fecha)}`,
      dias,
      anterior: i > 0 ? lunesConCitas[i - 1] : null,
      siguiente: i >= 0 && i < lunesConCitas.length - 1 ? lunesConCitas[i + 1] : null,
    };
  }

  const cuenta = (e: EstadoDeCita) => citasSemana.filter((c) => c.estado === e).length;
  const deHoy = citasSemana.filter((c) => c.fecha === hoy).length;
  const franja: CifraDeAgenda[] = [
    { clave: "semana", rotulo: "Citas de la semana", valor: fmt(citasSemana.length), sub: "en la semana que se ve", tono: "neutro" },
    { clave: "aplicadas", rotulo: "Aplicadas", valor: fmt(cuenta("aplicada")), sub: "con su parte en el libro", tono: "ok" },
    { clave: "hoy", rotulo: "Hoy", valor: fmt(deHoy), sub: deHoy ? "citas para hoy" : "ninguna cita hoy", tono: "neutro" },
    { clave: "sin-parte", rotulo: "Con respuestas, sin parte", valor: fmt(cuenta("sin-parte")), sub: "el libro aún no trae el parte", tono: cuenta("sin-parte") ? "aviso" : "neutro" },
    { clave: "vencidas", rotulo: "Citas vencidas", valor: fmt(vencidas.length), sub: "titulares sin aplicar", tono: vencidas.length ? "riesgo" : "ok" },
    { clave: "sin-cita", rotulo: "Sin cita", valor: fmt(sinCita.length), sub: "titulares por agendar", tono: sinCita.length ? "aviso" : "ok" },
  ];

  return { estado: "listo", franja, semana: semanaModelo, sinCita, vencidas, sinHora };
}

export function readinessDeAgenda(modelo: ModeloAgenda | null, cargando: boolean): string {
  if (cargando || !modelo) return "false";
  return modelo.estado === "listo" ? MARCA_AGENDA_AULAS : `vacio:${modelo.estado}`;
}
