// Modelo puro de Avance › Correo (reportes de Mailchimp, checklist T3).
//
// Aquí vive todo lo que la vista decide sin DOM: rótulos, porcentajes con su
// frecuencia y su base, filtros, paginación, el estado terminal de la vista y
// su marca de readiness. La presentación (`AvanceCorreo*.tsx`) solo pinta.

import type {
  MonitoreoMailchimpAudiencia,
  MonitoreoMailchimpEnvio,
  MonitoreoMailchimpEstado,
  MonitoreoMailchimpRitmo,
  MonitoreoMailchimpUmbrales,
} from "../../../../api/monitoreoMailchimp";
import { formatoConteo, formatoDecimal, numeroFinito, SIN_CIFRA } from "../../../../lib/formatoNumero";

// ---------- Cifras ----------

/** Conteo es-PE («22,779») o «—» si no hay dato. */
export function cifra(valor: number | null | undefined): string {
  return formatoConteo(valor);
}

/**
 * Proporción 0–1 como porcentaje legible.
 *
 * Delega en el formateador compartido (`lib/formatoNumero`): no construye su
 * propia cifra. La precisión es adaptativa porque las tasas de correo viven
 * muy cerca de cero —una queja de 0.05 % frente a un umbral de 0.1 %— y con un
 * solo decimal ambas se leerían «0.1 %». Bajo 1 % se muestran dos decimales.
 */
export function porcentaje(proporcion: number | null | undefined): string {
  const p = numeroFinito(proporcion);
  if (p == null) return SIN_CIFRA;
  const puntos = p * 100;
  if (puntos === 0) return "0 %";
  return `${formatoDecimal(puntos, Math.abs(puntos) < 1 ? 2 : 1)} %`;
}

/**
 * Tasa con su frecuencia y su base: «0.4 % · 9 de 2,341».
 *
 * Si la tasa llega `null` (base 0 o sin dato) se escribe «—»: no se recalcula
 * en el navegador una cifra que el motor decidió no publicar.
 */
export function tasaConBase(
  proporcion: number | null | undefined,
  frecuencia: number | null | undefined,
  base: number | null | undefined,
): string {
  const p = porcentaje(proporcion);
  if (frecuencia == null || base == null) return p;
  return `${p} · ${cifra(frecuencia)} de ${cifra(base)}`;
}

// ---------- Rótulos ----------

export function etiquetaTipoEnvio(envio: Pick<MonitoreoMailchimpEnvio, "tipo" | "orden">): string {
  if (envio.orden != null && envio.orden >= 1) {
    return envio.orden === 1 ? "Invitación" : `Recordatorio ${cifra(envio.orden - 1)}`;
  }
  return envio.tipo === "recordatorio" ? "Recordatorio" : "Invitación";
}

export type TonoRitmo = "ready" | "warning" | "danger" | "neutral";

export const RITMO: Record<MonitoreoMailchimpRitmo, { etiqueta: string; tono: TonoRitmo }> = {
  seguir: { etiqueta: "Seguir", tono: "ready" },
  espaciar: { etiqueta: "Espaciar", tono: "warning" },
  detener: { etiqueta: "Detener", tono: "danger" },
  sin_envios: { etiqueta: "Sin envíos", tono: "neutral" },
};

export function motivoInvalido(motivo: string): string {
  if (motivo === "rebote_duro") return "Rebote";
  if (motivo === "limpiado") return "Dado de baja por Mailchimp";
  return motivo || SIN_CIFRA;
}

/** Línea de umbrales: siempre se presenta como propuesta por decidir (D4). */
export function textoUmbrales(u: MonitoreoMailchimpUmbrales): string {
  const partes: string[] = [];
  if (u.queja_detener != null) partes.push(`detener si las quejas llegan a ${porcentaje(u.queja_detener)}`);
  if (u.baja_espaciar != null || u.queja_espaciar != null) {
    const condiciones = [
      u.baja_espaciar != null ? `las bajas llegan a ${porcentaje(u.baja_espaciar)}` : "",
      u.queja_espaciar != null ? `las quejas llegan a ${porcentaje(u.queja_espaciar)}` : "",
      "hay menos respuestas que bajas",
    ].filter(Boolean);
    partes.push(`espaciar si ${condiciones.join(", ").replace(/, ([^,]*)$/, " o $1")}`);
  }
  if (!partes.length) return "";
  return `Umbrales propuestos, por decidir: ${partes.join("; ")}. Se miden sobre el último envío de cada público.`;
}

/** Umbrales como piezas cortas para una leyenda: «Bajas ≥ 0.5 % espaciar». */
export function piezasDeUmbrales(u: MonitoreoMailchimpUmbrales): { clave: string; texto: string; tono: "warning" | "danger" }[] {
  const out: { clave: string; texto: string; tono: "warning" | "danger" }[] = [];
  if (u.baja_espaciar != null) out.push({ clave: "baja", texto: `Bajas ≥ ${porcentaje(u.baja_espaciar)}`, tono: "warning" });
  if (u.queja_espaciar != null) out.push({ clave: "queja", texto: `Quejas ≥ ${porcentaje(u.queja_espaciar)}`, tono: "warning" });
  if (u.queja_detener != null) out.push({ clave: "detener", texto: `Quejas ≥ ${porcentaje(u.queja_detener)}`, tono: "danger" });
  return out;
}

export function nombreAudiencia(listId: string, audiencias: readonly MonitoreoMailchimpAudiencia[]): string {
  const hallada = audiencias.find((a) => a.id === listId);
  return hallada?.name || listId;
}

// ---------- Envíos ----------

/** Envíos en orden de salida; los sin fecha al final. */
export function enviosOrdenados(envios: readonly MonitoreoMailchimpEnvio[]): MonitoreoMailchimpEnvio[] {
  const t = (e: MonitoreoMailchimpEnvio) => {
    const ms = Date.parse(e.enviado_at);
    return Number.isFinite(ms) ? ms : Number.POSITIVE_INFINITY;
  };
  return [...envios].sort((a, b) => t(a) - t(b));
}

/** Públicos que aparecen en los envíos (mayoritario o en `por_actor`). */
export function publicosDeEnvios(envios: readonly MonitoreoMailchimpEnvio[]): string[] {
  const vistos = new Set<string>();
  for (const e of envios) {
    if (e.actor) vistos.add(e.actor);
    for (const a of e.por_actor) if (a.actor) vistos.add(a.actor);
  }
  return [...vistos].sort((a, b) => a.localeCompare(b, "es"));
}

/** Filtra por público: un envío entra si su público mayoritario o alguno de `por_actor` coincide. */
export function filtrarEnvios(envios: readonly MonitoreoMailchimpEnvio[], publico: string): MonitoreoMailchimpEnvio[] {
  if (!publico) return [...envios];
  return envios.filter((e) => e.actor === publico || e.por_actor.some((a) => a.actor === publico));
}

/** Un envío se desglosa solo si tocó a más de un público. */
export function tieneDesglose(envio: MonitoreoMailchimpEnvio): boolean {
  return envio.por_actor.length > 1;
}

// ---------- Paginación ----------

export type Pagina<T> = { filas: T[]; pagina: number; paginas: number; desde: number; hasta: number; total: number };

export function paginar<T>(filas: readonly T[], pagina: number, tamano: number): Pagina<T> {
  const total = filas.length;
  const paginas = Math.max(1, Math.ceil(total / Math.max(1, tamano)));
  const actual = Math.min(Math.max(1, Math.trunc(pagina) || 1), paginas);
  const inicio = (actual - 1) * tamano;
  const corte = filas.slice(inicio, inicio + tamano);
  return { filas: corte, pagina: actual, paginas, desde: total ? inicio + 1 : 0, hasta: inicio + corte.length, total };
}

// ---------- Estado de la vista ----------

export type FaseCorreo =
  | "cargando"
  | "error"
  | "sin-conexion"
  | "sin-audiencia"
  | "preparando"
  | "sin-lecturas"
  | "sin-envios"
  | "listo";

export function faseCorreo(input: {
  estado: MonitoreoMailchimpEstado | null;
  cargando: boolean;
  error: string;
}): FaseCorreo {
  if (input.cargando && !input.estado) return "cargando";
  if (input.error && !input.estado) return "error";
  const e = input.estado;
  if (!e) return "cargando";
  if (!e.conectado) return "sin-conexion";
  if (!e.list_id) return "sin-audiencia";
  if (e.preparando) return "preparando";
  if (!e.leido_at) return "sin-lecturas";
  if (!e.envios.length) return "sin-envios";
  return "listo";
}

/**
 * Marca de readiness para el QA (`data-audit-ready`).
 *
 * `false` solo significa «todavía no»: un estado terminal sin contenido
 * publica `vacio:<motivo>` para no colgar la captura (readinessAnidada).
 */
export function marcaReadiness(fase: FaseCorreo): string {
  if (fase === "cargando") return "false";
  if (fase === "listo") return "monitoreo-correo";
  if (fase === "error") return "monitoreo-correo:error";
  return `vacio:${fase}`;
}

// ---------- Estado efímero de la vista (reducer) ----------

export type AvanceDeLectura = { percent: number | null; message: string };

export type EstadoCorreo = {
  estado: MonitoreoMailchimpEstado | null;
  audiencias: MonitoreoMailchimpAudiencia[];
  cargando: boolean;
  error: string;
  /** `null` = no hay lectura en curso. */
  lectura: AvanceDeLectura | null;
  guardandoAudiencia: boolean;
  aviso: string;
  /** Público elegido para el embudo y los envíos; `""` = todos. */
  publico: string;
};

export const ESTADO_CORREO_INICIAL: EstadoCorreo = {
  estado: null,
  audiencias: [],
  cargando: true,
  error: "",
  lectura: null,
  guardandoAudiencia: false,
  aviso: "",
  publico: "",
};

export type AccionCorreo =
  | { tipo: "cargar" }
  | { tipo: "cargado"; estado: MonitoreoMailchimpEstado }
  | { tipo: "fallo"; error: string }
  | { tipo: "audiencias"; audiencias: MonitoreoMailchimpAudiencia[] }
  | { tipo: "guardar-audiencia" }
  | { tipo: "lectura-inicio" }
  | { tipo: "lectura-avance"; avance: AvanceDeLectura }
  | { tipo: "lectura-fin"; estado: MonitoreoMailchimpEstado; aviso: string }
  | { tipo: "publico"; publico: string };

export function reducirCorreo(s: EstadoCorreo, a: AccionCorreo): EstadoCorreo {
  switch (a.tipo) {
    case "cargar":
      return { ...s, cargando: true, error: "" };
    case "cargado":
      return { ...s, estado: a.estado, cargando: false, error: "", guardandoAudiencia: false };
    case "fallo":
      return { ...s, cargando: false, error: a.error, guardandoAudiencia: false, lectura: null };
    case "audiencias":
      return { ...s, audiencias: a.audiencias };
    case "guardar-audiencia":
      return { ...s, guardandoAudiencia: true, error: "", aviso: "" };
    case "lectura-inicio":
      return { ...s, lectura: { percent: null, message: "" }, error: "", aviso: "" };
    case "lectura-avance":
      return s.lectura ? { ...s, lectura: a.avance } : s;
    case "lectura-fin":
      return { ...s, estado: a.estado, lectura: null, cargando: false, aviso: a.aviso };
    case "publico":
      // Elegir el público ya elegido lo suelta: vuelve a «todos».
      return { ...s, publico: s.publico === a.publico ? "" : a.publico };
    default:
      return s;
  }
}
