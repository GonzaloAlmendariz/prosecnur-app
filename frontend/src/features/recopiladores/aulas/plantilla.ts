// Plantillas de enlace personalizado por curso-horario.
//
// Kobo no tiene un collector remoto por unidad: lo que hay es UN web form y N
// enlaces parametrizados sobre él (`d[collectorID]=<unidad>`). Este módulo
// construye esos enlaces localmente, que es lo que el ADR 0046 §4 permite
// mientras el usuario aporte una URL base válida.
//
// El bloqueo de landing administrativa NO vive aquí: es `lib/captureUrl.ts`, que
// se aplica antes de ofrecer generación. Este módulo asume una base ya validada.

import type { ConnectionProfileState, MonitoreoAulasPlanRow, MonitoreoKoboAssetItem } from "../../../api/client";
import { normalizeText } from "./texto";
import { classroomLabel, roleLabel, rowFaculty, sampleLabel } from "./filas";

export const KOBO_DEFAULT_BASE_URL = "https://kf.kobotoolbox.org";
export const KOBO_PARAM_TEMPLATE = "d[collectorID]={curso_horario}";

export type TemplateContext = Record<string, string>;

export function cleanKoboBaseUrl(value: unknown) {
  return normalizeText(value).replace(/\/+$/, "") || KOBO_DEFAULT_BASE_URL;
}

export function koboProfileLabel(profile: ConnectionProfileState) {
  return [profile.alias || "Kobo", profile.server_label || profile.base_url || ""].filter(Boolean).join(" · ");
}

/**
 * Las variables disponibles en una plantilla. `aula` y `curso_horario` son
 * sinónimos a propósito: la unidad se llama curso-horario, pero las plantillas
 * escritas antes del cambio de vocabulario usan `{aula}` y deben seguir
 * funcionando.
 */
export function rowTemplateContext(
  row: MonitoreoAulasPlanRow,
  asset: MonitoreoKoboAssetItem | null,
): TemplateContext {
  return {
    aula: classroomLabel(row),
    curso_horario: classroomLabel(row),
    curso_id: normalizeText(row.course_id),
    curso: normalizeText(row.course_name),
    seccion: normalizeText(row.section),
    horario: normalizeText(row.schedule),
    docente: normalizeText(row.teacher),
    correo_docente: normalizeText(row.teacher_email),
    facultad: rowFaculty(row),
    carrera: normalizeText(row.program),
    nivel: normalizeText(row.level),
    muestra: sampleLabel(row),
    rol: roleLabel(row),
    orden: normalizeText(row.orden),
    estudiantes: normalizeText(row.eligible_n),
    asset_uid: normalizeText(asset?.uid),
    formulario: normalizeText(asset?.name),
    version: normalizeText(asset?.version_id),
  };
}

/** Una variable desconocida se resuelve a vacío, no se deja `{loquesea}` en la URL. */
export function fillTemplate(value: string, context: TemplateContext) {
  return value.replace(/\{([a-z0-9_]+)\}/gi, (_, key: string) => context[key.toLowerCase()] ?? "");
}

/**
 * Pega los parámetros personalizados a la base. Codifica clave y valor por
 * separado —`d[collectorID]` tiene corchetes que deben viajar escapados— y
 * respeta el `?`/`&` que la base ya traiga.
 */
export function appendPersonalizedParams(
  baseLink: string,
  paramsTemplate: string,
  context: TemplateContext,
) {
  const base = fillTemplate(normalizeText(baseLink), context);
  const rawParams = fillTemplate(normalizeText(paramsTemplate), context).replace(/^[?&]+/, "");
  if (!base || !rawParams) return base;
  const encoded = rawParams
    .split("&")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [key, ...rest] = part.split("=");
      const cleanKey = key.trim();
      const cleanValue = rest.join("=").trim();
      if (!cleanKey) return "";
      return `${encodeURIComponent(cleanKey)}=${encodeURIComponent(cleanValue)}`;
    })
    .filter(Boolean)
    .join("&");
  if (!encoded) return base;
  const separator = base.includes("?")
    ? base.endsWith("?") || base.endsWith("&") ? "" : "&"
    : "?";
  return `${base}${separator}${encoded}`;
}
