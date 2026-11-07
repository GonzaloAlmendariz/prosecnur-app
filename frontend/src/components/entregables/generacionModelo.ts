// Decisiones puras de una generación: cómo se lee el avance de un job, cómo se
// dice un error, cómo se reconoce el aviso de la descarga que se pidió y cómo
// se escriben el peso y el avance. Sin React ni red: se prueban solas.

import { ApiError } from "../../api/core";
import { jobResultDomainError } from "../../api/jobs";
import { splitErrorDetail } from "../errorPresentation";

export type AvanceDeJob = {
  paso?: number;
  pasos?: number;
  mensaje?: string;
  porcentaje: number | null;
};

function entero(valor: unknown): number | undefined {
  const n = typeof valor === "number" ? valor : typeof valor === "string" && valor.trim() ? Number(valor) : Number.NaN;
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
}

/**
 * Traduce el `progress` de `/api/jobs/<id>` ({ phase, step, steps, current,
 * total, percent, message }) al avance del contenedor. La etapa (`phase`) es un
 * código interno del motor y no se muestra; el mensaje sí, porque ya viene en
 * español. Sin `percent`, la línea es indeterminada.
 */
export function avanceDelJob(progress: unknown): AvanceDeJob {
  const p = progress && typeof progress === "object" && !Array.isArray(progress)
    ? (progress as Record<string, unknown>)
    : {};
  const pct = entero(p.percent);
  const paso = entero(p.step);
  const pasos = entero(p.steps);
  const mensaje = typeof p.message === "string" && p.message.trim() ? p.message.trim() : undefined;
  return {
    porcentaje: pct === undefined ? null : Math.max(0, Math.min(100, pct)),
    ...(paso !== undefined && pasos !== undefined && pasos > 0 && paso > 0 ? { paso: Math.min(paso, pasos), pasos } : {}),
    ...(mensaje ? { mensaje } : {}),
  };
}

/** Lo que dice el contenedor mientras se genera: «Paso 2 de 4: calculando cruces». */
export function textoDelAvance(avance: { paso?: number; pasos?: number; mensaje?: string }): string {
  const mensaje = avance.mensaje?.replace(/\.{3}$|…$/, "").trim();
  const paso = avance.paso && avance.pasos ? `Paso ${avance.paso} de ${avance.pasos}` : "";
  if (paso && mensaje) return `${paso}: ${mensaje.charAt(0).toLowerCase()}${mensaje.slice(1)}`;
  return paso || mensaje || "Generando";
}

export type Articulo = "el" | "la" | "los" | "las";

/**
 * Nombre del contenedor cuando la generación falla, como en el prototipo:
 * «No se pudieron generar las frecuencias», «No se pudo generar el informe en
 * PowerPoint». Sin artículo: «No se pudo generar: Frecuencias».
 */
export function nombreDelFallo(titulo: string, articulo?: Articulo | null): string {
  const t = titulo.trim();
  if (!articulo) return `No se pudo generar: ${t}`;
  const plural = articulo === "los" || articulo === "las";
  const minuscula = /^[A-ZÁÉÍÓÚÑ][a-záéíóúñü]/.test(t) ? `${t.charAt(0).toLowerCase()}${t.slice(1)}` : t;
  return `No se ${plural ? "pudieron" : "pudo"} generar ${articulo} ${minuscula}`;
}

export type ErrorLegible = { causa: string; codigo: string | null };

const SIN_DETALLE = "La generación terminó sin detalle del error. Reintenta; si persiste, revisa la conexión con el backend.";

/**
 * Causa legible y código `E_*` de un error. Usa el mensaje que ya armó
 * `ApiError` (`handle()` lo saca del cuerpo `error.message`, nunca del cuerpo
 * crudo) y separa el código con `splitErrorDetail`, como `ErrorBlock`.
 */
export function errorLegible(e: unknown): ErrorLegible {
  const crudo = e instanceof Error ? e.message : typeof e === "string" ? e : "";
  const { message, code } = splitErrorDetail(crudo);
  const codigo = code ?? (e instanceof ApiError ? e.code : null);
  return { causa: message || SIN_DETALLE, codigo };
}

/** Error de dominio que un job devuelve dentro de `result_data` ({ ok: false, error }). */
export function errorDelResultado(datos: unknown): ErrorLegible | null {
  const e = jobResultDomainError(datos);
  if (!e) return null;
  return { causa: splitErrorDetail(e.message).message || SIN_DETALLE, codigo: e.code };
}

/** `job_id` si la respuesta es el arranque de un job y no un archivo. */
export function jobIdDeInicio(raw: unknown): string | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  if (obj.file_id || obj.zip) return null;
  const id = Array.isArray(obj.job_id) && obj.job_id.length === 1 ? obj.job_id[0] : obj.job_id;
  return typeof id === "string" && id.trim() ? id : null;
}

/**
 * ¿El aviso de descarga terminada corresponde al archivo pedido? Electron no
 * pisa: si el nombre ya existe en Descargas lo deja como `X_2.ext`, `X_3.ext`
 * (desktop/descargas.cjs). Se compara sin mayúsculas, como Windows.
 */
export function coincideDescarga(pedido: string, recibido: string): boolean {
  const a = pedido.trim().toLowerCase();
  const b = recibido.trim().toLowerCase();
  if (!a || !b) return false;
  if (a === b) return true;
  const punto = a.lastIndexOf(".");
  const base = punto > 0 ? a.slice(0, punto) : a;
  const ext = punto > 0 ? a.slice(punto) : "";
  if (!b.startsWith(`${base}_`) || !b.endsWith(ext)) return false;
  return /^\d+$/.test(b.slice(base.length + 1, b.length - ext.length));
}

/** Peso legible: «820 B», «48 KB», «1.4 MB» (es-PE usa punto decimal). */
export function pesoLegible(bytes: number | null | undefined): string | null {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return null;
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.max(1, Math.round(kb))} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}

/** Carpeta de una ruta absoluta (sin el archivo), con el separador que traiga. */
export function carpetaDeRuta(ruta: string): string {
  return ruta.replace(/[\\/][^\\/]*$/, "");
}
