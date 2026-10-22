// Matriz de públicos de Avance › Correo. Puro: orden, umbrales y geometría de
// la barra de respuesta. Las tasas las publica el backend; aquí no se
// recalculan, solo se decide cómo se leen.

import type {
  MonitoreoMailchimpPublico,
  MonitoreoMailchimpUmbrales,
} from "../../../../api/monitoreoMailchimp";

export type OrdenMatriz = "tasa" | "universo" | "nombre";

export const ORDENES_MATRIZ: readonly { valor: OrdenMatriz; etiqueta: string }[] = [
  { valor: "tasa", etiqueta: "Respuesta" },
  { valor: "universo", etiqueta: "Universo" },
  { valor: "nombre", etiqueta: "Nombre" },
];

/** Mayor a menor tasa sobre la base alcanzable o universo; nombre A→Z. Sin dato al final. */
export function ordenarPublicos(
  publicos: readonly MonitoreoMailchimpPublico[],
  orden: OrdenMatriz,
): MonitoreoMailchimpPublico[] {
  const porNombre = (a: MonitoreoMailchimpPublico, b: MonitoreoMailchimpPublico) => a.actor.localeCompare(b.actor, "es");
  const desc = (x: number | null, y: number | null) => {
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    return y - x;
  };
  return [...publicos].sort((a, b) => {
    if (orden === "nombre") return porNombre(a, b);
    const d = orden === "tasa" ? desc(a.tasa_alcanzable, b.tasa_alcanzable) : desc(a.universo, b.universo);
    return d || porNombre(a, b);
  });
}

/** Ningún público recibió envíos: el estado se dice una vez, no nueve. */
export function todosSinEnvios(publicos: readonly MonitoreoMailchimpPublico[]): boolean {
  return publicos.length > 0 && publicos.every((p) => p.ritmo === "sin_envios");
}

export type NivelUmbral = "ok" | "advertencia" | "alerta" | "sin-dato";

/** La baja se colorea solo si cruza el umbral de espaciar. */
export function nivelBaja(tasa: number | null, u: MonitoreoMailchimpUmbrales): NivelUmbral {
  if (tasa == null) return "sin-dato";
  if (u.baja_espaciar != null && tasa >= u.baja_espaciar) return "advertencia";
  return "ok";
}

/** La queja: alerta sobre el tope de detener, advertencia sobre el de espaciar. */
export function nivelQueja(tasa: number | null, u: MonitoreoMailchimpUmbrales): NivelUmbral {
  if (tasa == null) return "sin-dato";
  if (u.queja_detener != null && tasa >= u.queja_detener) return "alerta";
  if (u.queja_espaciar != null && tasa >= u.queja_espaciar) return "advertencia";
  return "ok";
}

/**
 * Barra de respuesta: la pista es la base alcanzable (100 %), el relleno las
 * efectivas sobre ella y la marca la tasa sobre el universo, en la misma
 * escala. Las dos lecturas quedan a la vista y la distancia entre ellas es lo
 * que se pierde por correos inválidos.
 */
export function barraDeRespuesta(p: Pick<MonitoreoMailchimpPublico, "tasa_alcanzable" | "tasa_universo">): {
  relleno: number;
  marca: number | null;
} {
  const pct = (x: number | null) => (x == null ? null : Math.max(0, Math.min(100, x * 100)));
  return { relleno: pct(p.tasa_alcanzable) ?? 0, marca: pct(p.tasa_universo) };
}

// ---------- Tiempo relativo ----------

/** «hace un momento», «hace 12 min», «hace 3 h», «hace 2 días». `""` sin fecha válida. */
export function haceCuanto(iso: string, ahora: number): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  const min = Math.floor(Math.max(0, ahora - ms) / 60000);
  if (min < 1) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "hace 1 día" : `hace ${d} días`;
}

/** Fecha completa para el `title`: «22 oct. 2026, 11:00». */
export function fechaCompleta(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-PE", { dateStyle: "medium", timeStyle: "short" });
}

/** Fecha corta para ejes: «27/10». */
export function fechaCorta(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}
