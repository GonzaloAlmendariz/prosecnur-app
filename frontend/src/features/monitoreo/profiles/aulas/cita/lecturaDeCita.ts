/**
 * P4 · La cita de un curso-horario cuando no salió como se agendó: vencida
 * (pasó su fecha sin parte ni respuestas) o reagendada (el equipo la movió en
 * la hoja). Se lee del plan y del parte; no escribe nada.
 */

type Fila = Readonly<Record<string, unknown>>;

const texto = (v: unknown): string => {
  const c = Array.isArray(v) ? v[0] : v;
  return typeof c === "string" ? c.trim() : typeof c === "number" && Number.isFinite(c) ? String(c) : "";
};

const FECHA = /^\d{4}-\d{2}-\d{2}/;
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "setiembre", "octubre", "noviembre", "diciembre"];

export function fechaEnPalabras(iso: string): string {
  if (!FECHA.test(iso)) return iso;
  const [, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} de ${MESES[m - 1] ?? ""}`;
}

function diasEntre(desde: string, hasta: string): number {
  const a = Date.parse(`${desde.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${hasta.slice(0, 10)}T00:00:00Z`);
  return Number.isFinite(a) && Number.isFinite(b) ? Math.round((b - a) / 86_400_000) : 0;
}

export type LecturaDeCita =
  | { caso: "vencida"; citada: string; dias: number; yaReagendada: boolean }
  | { caso: "reagendada"; citada: string; conParte: boolean; aplicada: string; coincide: boolean | null };

export function lecturaDeCita(fila: Fila | null | undefined, parte: Fila | null | undefined, hoy: string): LecturaDeCita | null {
  if (!fila) return null;
  const citada = texto(fila.scheduled_date).slice(0, 10);
  if (!FECHA.test(citada)) return null;
  const muestra = texto(fila.sample_status).toLowerCase();
  const aplicacion = texto(fila.application_status).toLowerCase();
  if (/^rechaz/.test(muestra) || aplicacion === "no_aplicada" || aplicacion === "no aplicada") return null;
  const reagendada = muestra === "reagendada";
  const respuestas = Number(texto(fila.respuestas_validas)) || 0;
  const cerrada = Boolean(parte) || aplicacion === "aplicada" || respuestas > 0;

  // La misma regla que la Agenda pinta como «Cita vencida».
  if (!cerrada && citada < hoy) return { caso: "vencida", citada, dias: diasEntre(citada, hoy), yaReagendada: reagendada };
  if (!reagendada) return null;
  const aplicada = texto(parte?.applied_at).slice(0, 10);
  return {
    caso: "reagendada",
    citada,
    conParte: Boolean(parte),
    aplicada,
    coincide: parte && FECHA.test(aplicada) ? aplicada === citada : null,
  };
}
