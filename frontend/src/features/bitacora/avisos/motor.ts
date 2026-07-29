// Motor de avisos del cronograma (ADR 0047).
//
// Por qué la evaluación corre en el CLIENTE y no en R:
//
//   1. Plumber no tiene planificador. No existe un lugar en el backend donde
//      corra un temporizador que despierte solo.
//   2. "Ahora" tiene que ser hora de pared local. Las fechas del cronograma son
//      días locales (ver `dateUtils.dateValue`) y `.plan_now_iso()` formatea en
//      UTC: compararlas en el servidor es escribir el bug de zona horaria.
//   3. El requisito es evaluar AL ABRIR la app tras días cerrada, no mantener
//      un proceso vivo.
//
// R conserva lo único que debe ser durable: el libro de disparos, para que un
// aviso no vuelva a sonar en la sesión siguiente.
//
// Todo lo de acá es PURO. La parte que habla con el backend vive en
// `useAvisos.ts`; así el motor se prueba con `it.each` en Node puro, que es lo
// único que vitest permite en este repo.

import type { BitacoraRecordatorio, PlanTrabajoTask } from "../../../api/planTrabajo";
import { dateValue, parseTimeMinutes } from "../dateUtils";

/** Tope duro de instancias de una regla recurrente. Un año de diario. */
export const MAX_OCURRENCIAS = 366;

export type Aviso = {
  /** `<task_id>|<reminder_id>|<ocurrencia>`: identidad estable del disparo. */
  clave: string;
  taskId: string;
  reminderId: string;
  /** Fecha ISO de la instancia a la que corresponde el aviso. */
  ocurrencia: string;
  /** Instante en que el aviso debía sonar. */
  cuando: Date;
  /** Instante del hito en sí, ya aplicado el ancla. */
  vencimiento: Date;
  actividad: string;
  fase: string;
};

export function claveDeAviso(taskId: string, reminderId: string, ocurrencia: string): string {
  return `${taskId}|${reminderId}|${ocurrencia}`;
}

/**
 * Instante local de una fecha-día más una hora opcional y un offset en minutos.
 *
 * `setMinutes` y no aritmética sobre el epoch: al sumar milisegundos a un
 * timestamp UTC, un offset que cruza un cambio de horario estacional cae una
 * hora corrida. `setMinutes` opera en calendario local y respeta la transición.
 * Perú no tiene horario de verano, pero un `.pulso` es portable y la regla no
 * cuesta nada.
 */
export function instanteDe(fecha: string, hora: string | undefined, offsetMinutos: number): Date | null {
  const base = dateValue(fecha);
  if (base == null) return null;
  const d = new Date(base);
  const minutosDelDia = parseTimeMinutes(hora);
  if (minutosDelDia != null) d.setMinutes(d.getMinutes() + minutosDelDia);
  if (offsetMinutos !== 0) d.setMinutes(d.getMinutes() + offsetMinutos);
  return d;
}

/** Fecha del ancla de un recordatorio: el inicio o el fin del hito. */
function fechaDelAncla(task: PlanTrabajoTask, r: BitacoraRecordatorio): { fecha: string; hora?: string } {
  if (r.anchor === "end") {
    return { fecha: task.end_date || task.start_date, hora: task.end_time };
  }
  return { fecha: task.start_date || task.end_date, hora: task.start_time };
}

function sumarSegunRegla(d: Date, regla: string, intervalo: number): Date {
  const siguiente = new Date(d);
  if (regla === "daily") siguiente.setDate(siguiente.getDate() + intervalo);
  else if (regla === "weekly") siguiente.setDate(siguiente.getDate() + 7 * intervalo);
  else siguiente.setMonth(siguiente.getMonth() + intervalo);
  return siguiente;
}

function aISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/**
 * Fechas en que ocurre un hito.
 *
 * Sin recurrencia es una sola: la fecha del ancla. Con recurrencia, la serie
 * acotada por `until`, por `count` y por `MAX_OCURRENCIAS`, saltando las
 * excepciones y las instancias ya cumplidas.
 *
 * Cumplir UNA instancia no mata las demás: como la clave del aviso incluye la
 * ocurrencia, cada repetición tiene su propio disparo.
 */
export function ocurrenciasDe(task: PlanTrabajoTask, anclaFecha: string): string[] {
  const inicio = dateValue(anclaFecha);
  if (inicio == null) return [];
  const rec = task.recurrence;
  if (!rec || !rec.rule) return [anclaFecha];

  const excluidas = new Set([...(rec.exceptions ?? []), ...(rec.done_instances ?? [])]);
  const hasta = rec.until ? dateValue(rec.until) : null;
  const tope = rec.count && rec.count > 0 ? Math.min(rec.count, MAX_OCURRENCIAS) : MAX_OCURRENCIAS;
  const intervalo = Math.max(1, rec.interval || 1);

  const out: string[] = [];
  let cursor = new Date(inicio);
  // `emitidas` cuenta la serie completa, no solo lo que sobrevive al filtro:
  // `count` describe cuántas veces se repite el hito, no cuántos avisos quedan.
  for (let emitidas = 0; emitidas < tope; emitidas += 1) {
    if (hasta != null && cursor.getTime() > hasta) break;
    const iso = aISO(cursor);
    if (!excluidas.has(iso)) out.push(iso);
    cursor = sumarSegunRegla(cursor, rec.rule, intervalo);
  }
  return out;
}

export type EntradaMotor = {
  tareas: readonly PlanTrabajoTask[];
  ahora: Date;
  /** Claves ya disparadas y no repetibles, del libro persistido. */
  disparadas: ReadonlySet<string>;
  /** Claves pospuestas con su instante de reaparición. */
  pospuestas: ReadonlyMap<string, Date>;
  /** Ventana hacia adelante para el panel de próximos, en días. */
  diasProximos?: number;
};

export type ResultadoMotor = {
  /** Debían sonar y todavía no sonaron. */
  vencidos: Aviso[];
  /** Van a sonar dentro de la ventana; se muestran, no se disparan. */
  proximos: Aviso[];
};

/**
 * Evalúa qué avisos corresponden ahora.
 *
 * Un recordatorio `descartado` no vuelve. Uno `pospuesto` reaparece cuando pasa
 * su `snoozed_until`, y para eso se consulta el mapa de pospuestas del libro —
 * no el estado del recordatorio en la tarea, que podría haberse editado.
 */
export function evaluarAvisos(entrada: EntradaMotor): ResultadoMotor {
  const { tareas, ahora, disparadas, pospuestas } = entrada;
  const ventana = new Date(ahora);
  ventana.setDate(ventana.getDate() + (entrada.diasProximos ?? 14));

  const vencidos: Aviso[] = [];
  const proximos: Aviso[] = [];

  for (const task of tareas) {
    if (task.archived_at) continue;
    if (task.status === "done") continue;
    const recordatorios = task.reminders ?? [];
    if (recordatorios.length === 0) continue;

    for (const r of recordatorios) {
      if (r.state === "descartado") continue;
      const ancla = fechaDelAncla(task, r);
      if (!ancla.fecha) continue;

      for (const ocurrencia of ocurrenciasDe(task, ancla.fecha)) {
        const clave = claveDeAviso(task.id, r.id, ocurrencia);
        if (disparadas.has(clave)) continue;

        const vencimiento = instanteDe(ocurrencia, ancla.hora, 0);
        const cuando = instanteDe(ocurrencia, ancla.hora, r.offset_minutes);
        if (cuando == null || vencimiento == null) continue;

        // Un pospuesto no suena hasta su hora, aunque su instante original ya
        // haya pasado hace días.
        const reaparece = pospuestas.get(clave);
        const efectivo = reaparece ?? cuando;

        const aviso: Aviso = {
          clave,
          taskId: task.id,
          reminderId: r.id,
          ocurrencia,
          cuando: efectivo,
          vencimiento,
          actividad: task.activity,
          fase: task.fase ?? "",
        };

        if (efectivo.getTime() <= ahora.getTime()) vencidos.push(aviso);
        else if (efectivo.getTime() <= ventana.getTime()) proximos.push(aviso);
      }
    }
  }

  vencidos.sort((a, b) => a.cuando.getTime() - b.cuando.getTime());
  proximos.sort((a, b) => a.cuando.getTime() - b.cuando.getTime());
  return { vencidos, proximos };
}

export type BucketAviso = "hoy" | "ayer" | "semana" | "antes";

export const ORDEN_BUCKETS_AVISO: readonly BucketAviso[] = ["hoy", "ayer", "semana", "antes"];

export const ETIQUETA_BUCKET_AVISO: Record<BucketAviso, string> = {
  hoy: "Hoy",
  ayer: "Ayer",
  semana: "Esta semana",
  antes: "Antes",
};

export type GrupoAvisos = {
  bucket: BucketAviso;
  label: string;
  avisos: Aviso[];
};

function inicioDelDia(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Agrupa los vencidos por cercanía.
 *
 * Existe porque abrir la app tras una semana cerrada produce decenas de avisos
 * a la vez, y una cascada de notificaciones individuales es ruido, no
 * información. El centro de avisos los presenta agrupados y el deck de toasts
 * muestra un solo agregado.
 */
export function agruparVencidos(avisos: readonly Aviso[], ahora: Date): GrupoAvisos[] {
  const hoy = inicioDelDia(ahora).getTime();
  const ayer = hoy - 86_400_000;
  const semana = hoy - 7 * 86_400_000;

  const porBucket = new Map<BucketAviso, Aviso[]>();
  for (const aviso of avisos) {
    const t = aviso.cuando.getTime();
    const bucket: BucketAviso =
      t >= hoy ? "hoy" : t >= ayer ? "ayer" : t >= semana ? "semana" : "antes";
    const lista = porBucket.get(bucket);
    if (lista) lista.push(aviso);
    else porBucket.set(bucket, [aviso]);
  }

  return ORDEN_BUCKETS_AVISO.flatMap((bucket) => {
    const avisos = porBucket.get(bucket);
    if (!avisos || avisos.length === 0) return [];
    return [{ bucket, label: ETIQUETA_BUCKET_AVISO[bucket], avisos }];
  });
}

/** Offsets ofrecidos al crear un recordatorio. Negativo = antes del hito. */
export const OFFSETS_SUGERIDOS: ReadonlyArray<{ minutos: number; label: string }> = [
  { minutos: 0, label: "En el momento" },
  { minutos: -60, label: "1 hora antes" },
  { minutos: -1440, label: "1 día antes" },
  { minutos: -4320, label: "3 días antes" },
  { minutos: -10080, label: "1 semana antes" },
];

/** Opciones de posponer, en minutos desde ahora. */
export const POSPONER_SUGERIDO: ReadonlyArray<{ minutos: number; label: string }> = [
  { minutos: 60, label: "1 hora" },
  { minutos: 240, label: "4 horas" },
  { minutos: 1440, label: "Mañana" },
  { minutos: 10080, label: "La otra semana" },
];

export function etiquetaOffset(minutos: number): string {
  const conocido = OFFSETS_SUGERIDOS.find((o) => o.minutos === minutos);
  if (conocido) return conocido.label;
  const abs = Math.abs(minutos);
  const cuando = minutos < 0 ? "antes" : "después";
  if (abs % 1440 === 0) {
    const dias = abs / 1440;
    return `${dias} ${dias === 1 ? "día" : "días"} ${cuando}`;
  }
  if (abs % 60 === 0) {
    const horas = abs / 60;
    return `${horas} ${horas === 1 ? "hora" : "horas"} ${cuando}`;
  }
  return `${abs} min ${cuando}`;
}
