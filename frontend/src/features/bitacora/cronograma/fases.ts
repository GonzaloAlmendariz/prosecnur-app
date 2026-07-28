// Lógica pura del cronograma por fases (ADR 0047).
//
// Vive acá y no en el componente porque vitest corre en Node puro —sin jsdom—
// así que lo único testeable es lo que no toca el DOM. La regla que sigue todo
// este módulo: las DECISIONES son funciones puras y el componente solo las
// cablea.
//
// Por qué `vencido` se calcula en el cliente y no en R: `.plan_now_iso()`
// formatea en UTC mientras `start_date`/`end_date` son fechas de DÍA local (por
// eso existe `dateUtils.dateValue`, que interpreta "YYYY-MM-DD" como medianoche
// local). Compararlas en el servidor es escribir el bug de zona horaria a mano.
// Además el payload puede quedar en memoria pasada la medianoche y seguiría
// afirmando que nada venció.

import type { PlanTrabajoTask } from "../../../api/planTrabajo";
import type { BitacoraFase, BitacoraFaseVista } from "../../../api/bitacora";
import { dateValue, parseTimeMinutes } from "../dateUtils";

export type BucketCronograma = "vencido" | "hoy" | "semana" | "adelante" | "sin-fecha";

export const ORDEN_BUCKETS: readonly BucketCronograma[] = [
  "vencido",
  "hoy",
  "semana",
  "adelante",
  "sin-fecha",
];

export const ETIQUETA_BUCKET: Record<BucketCronograma, string> = {
  vencido: "Vencidos",
  hoy: "Hoy",
  semana: "Esta semana",
  adelante: "Más adelante",
  "sin-fecha": "Sin fecha",
};

/** Medianoche local del día de `fecha`. Base de toda comparación temporal. */
export function inicioDelDia(fecha: Date): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
}

/**
 * Instante local en que la tarea termina.
 *
 * Sin hora, una tarea que termina "el 20 de marzo" vence al terminar ese día,
 * no al empezarlo: por eso el fin de un evento de todo el día es la medianoche
 * SIGUIENTE. Sin esa corrección, cualquier entrega marcada para hoy aparecería
 * vencida desde las 00:01.
 */
export function finLocalDe(task: Pick<PlanTrabajoTask, "start_date" | "end_date" | "end_time">): Date | null {
  const base = dateValue(task.end_date || task.start_date || "");
  if (base == null) return null;
  const minutos = parseTimeMinutes(task.end_time);
  if (minutos == null) {
    const d = new Date(base);
    d.setDate(d.getDate() + 1);
    return d;
  }
  const d = new Date(base);
  d.setMinutes(d.getMinutes() + minutos);
  return d;
}

/**
 * `vencido` es DERIVADO, nunca un estado que se guarda: una tarea cumplida no
 * vence, y una archivada tampoco (dejó de estar en juego).
 */
export function estaVencida(task: PlanTrabajoTask, ahora: Date): boolean {
  if (task.archived_at) return false;
  if (task.status === "done") return false;
  const fin = finLocalDe(task);
  if (fin == null) return false;
  return fin.getTime() < ahora.getTime();
}

/**
 * Bucket cronológico. "Esta semana" son los próximos siete días desde hoy y no
 * la semana calendario: un jueves, "esta semana" que termina el domingo deja
 * fuera casi todo lo que importa.
 */
export function bucketDe(task: PlanTrabajoTask, ahora: Date): BucketCronograma {
  const inicioHoy = inicioDelDia(ahora);
  const referencia = dateValue(task.start_date || task.end_date || "");
  if (referencia == null) return "sin-fecha";
  if (estaVencida(task, ahora)) return "vencido";

  const finSemana = new Date(inicioHoy);
  finSemana.setDate(finSemana.getDate() + 7);

  // Una tarea en curso que empezó antes pero no venció es de hoy: está pasando.
  if (referencia <= inicioHoy.getTime()) return "hoy";
  const inicioManana = new Date(inicioHoy);
  inicioManana.setDate(inicioManana.getDate() + 1);
  if (referencia < inicioManana.getTime()) return "hoy";
  if (referencia < finSemana.getTime()) return "semana";
  return "adelante";
}

export type GrupoCronograma = {
  bucket: BucketCronograma;
  label: string;
  tareas: PlanTrabajoTask[];
};

/**
 * Agrupa y ordena. Dentro de cada bucket manda la fecha; a igual fecha, la
 * prioridad (`priority_rank` viene del backend justamente para no replicar acá
 * la tabla de prioridades).
 */
export function agruparCronograma(
  tareas: readonly PlanTrabajoTask[],
  ahora: Date,
): GrupoCronograma[] {
  const porBucket = new Map<BucketCronograma, PlanTrabajoTask[]>();
  for (const t of tareas) {
    const bucket = bucketDe(t, ahora);
    const lista = porBucket.get(bucket);
    if (lista) lista.push(t);
    else porBucket.set(bucket, [t]);
  }

  return ORDEN_BUCKETS.flatMap((bucket) => {
    const tareas = porBucket.get(bucket);
    if (!tareas || tareas.length === 0) return [];
    const ordenadas = [...tareas].sort((a, b) => {
      const fa = dateValue(a.start_date || a.end_date || "") ?? Number.POSITIVE_INFINITY;
      const fb = dateValue(b.start_date || b.end_date || "") ?? Number.POSITIVE_INFINITY;
      if (fa !== fb) return fa - fb;
      return (a.priority_rank ?? 2) - (b.priority_rank ?? 2);
    });
    return [{ bucket, label: ETIQUETA_BUCKET[bucket], tareas: ordenadas }];
  });
}

/** Cuántos días cubre una fase. 0 cuando todavía no tiene fechas. */
export function duracionEnDias(inicio: string, fin: string): number {
  const a = dateValue(inicio);
  const b = dateValue(fin);
  if (a == null || b == null) return 0;
  return Math.round((b - a) / 86_400_000) + 1;
}

/**
 * Texto del rango de una fase, en el registro del usuario: "3–20 mar", no
 * "2026-03-03 - 2026-03-20".
 */
export function etiquetaRango(inicio: string, fin: string): string {
  const a = dateValue(inicio);
  const b = dateValue(fin);
  if (a == null && b == null) return "Sin fechas";
  if (a == null || b == null) {
    const unico = a ?? b;
    return unico == null ? "Sin fechas" : formatoCorto(new Date(unico));
  }
  if (a === b) return formatoCorto(new Date(a));
  const da = new Date(a);
  const db = new Date(b);
  if (da.getMonth() === db.getMonth() && da.getFullYear() === db.getFullYear()) {
    return `${da.getDate()}–${formatoCorto(db)}`;
  }
  return `${formatoCorto(da)} – ${formatoCorto(db)}`;
}

// `Intl` en español abrevia con punto ("15 mar."). En una etiqueta compacta ese
// punto final se lee como un error de tipeo, no como una abreviatura, así que se
// quita. Es una decisión de presentación: el dato subyacente no cambia.
function formatoCorto(d: Date): string {
  return new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "short" })
    .format(d)
    .replace(/\.$/, "");
}

/**
 * Solapamientos entre fases consecutivas. No es un error —el procesamiento
 * suele arrancar antes de que termine el campo— pero sí algo que el compositor
 * señala, porque a veces es un dedazo en una fecha.
 */
export function fasesSolapadas(fases: readonly BitacoraFaseVista[]): BitacoraFase[] {
  const conFechas = fases.filter((f) => f.start_date && f.end_date);
  const solapadas = new Set<BitacoraFase>();
  for (let i = 0; i < conFechas.length; i += 1) {
    for (let j = i + 1; j < conFechas.length; j += 1) {
      const a = conFechas[i];
      const b = conFechas[j];
      if (a.start_date <= b.end_date && b.start_date <= a.end_date) {
        solapadas.add(a.id);
        solapadas.add(b.id);
      }
    }
  }
  return [...solapadas];
}

/** Rango total del estudio: de la primera fecha de cualquier fase a la última. */
export function rangoDelEstudio(fases: readonly BitacoraFaseVista[]): {
  inicio: string;
  fin: string;
} {
  const inicios = fases.map((f) => f.start_date).filter(Boolean).sort();
  const fines = fases.map((f) => f.end_date).filter(Boolean).sort();
  return { inicio: inicios[0] ?? "", fin: fines[fines.length - 1] ?? "" };
}
