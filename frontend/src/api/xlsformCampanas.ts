// xlsformCampanas.ts — campañas complementarias de un formulario (ADR 0101).
//
// Una campaña complementaria es otra encuesta SurveyMonkey que aplica el MISMO
// instrumento (un canal por correo, una versión personalizada). No se importa
// como otro formulario: se declara dentro del principal y queda en
// `source.variants` con `rol = "campana_complementaria"`. El servidor empareja
// por pregunta con la regla del ADR 0099 y recalcula al declarar; el cliente
// sólo muestra la vista previa y confirma.
//
// No se reexporta desde el barrel `client.ts`: el código nuevo importa de su
// módulo de dominio (patrón de `cargaFuentes.ts`).

import { apiFetch, handle, headers } from "./core";
import type { XlsformFormSource } from "./multiIntegrado";
import { normalizeFormLibraryEntry, type FormLibraryEntry } from "./xlsformEditor";

export const CAMPANA_ROL = "campana_complementaria";

/** Una pregunta citada en la vista previa (falta, sobra o es ambigua). */
export type CampanaPregunta = {
  variable: string;
  etiqueta: string;
};

export type CampanaVistaPrevia = {
  survey_id: string;
  titulo: string;
  n_emparejadas: number;
  n_preguntas_base: number;
  /** Proporción 0–1; `null` si el servidor no la manda. */
  cobertura: number | null;
  /** Texto ya formateado por el servidor, con su signo («98.6 %»); se muestra tal cual. */
  cobertura_texto: string;
  /** Calza menos del 80 %: no es una campaña, se bloquea la declaración. */
  instrumento_distinto: boolean;
  /** Preguntas del instrumento que quedarán vacías para esta campaña. */
  faltan: CampanaPregunta[];
  /** Preguntas de la campaña que no entran al instrumento. */
  extra: CampanaPregunta[];
  /** Preguntas que no se pudieron emparejar con certeza. */
  ambiguas: CampanaPregunta[];
};

export type CampanaSugerencia = {
  form_id: string;
  form_name: string;
  survey_id_principal: string;
  cobertura: number | null;
  cobertura_texto: string;
  n_emparejadas: number;
  n_preguntas_base: number;
};

/** Campaña ya declarada, leída de `source.variants`. */
export type CampanaDeclarada = {
  survey_id: string;
  survey_title: string;
  n_emparejadas: number | null;
  n_preguntas_base: number | null;
  cobertura: number | null;
  /** Preguntas del instrumento que la campaña no trae: quedan vacías para ella. */
  sin_par_base: CampanaPregunta[];
  declarada_en: string;
  review_status: string;
};

export type CampanaDeclararResultado = {
  form: FormLibraryEntry | null;
  campana: CampanaDeclarada | null;
};

// ---------------------------------------------------------------------------
// Normalizadores defensivos
// ---------------------------------------------------------------------------

function registro(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

// R puede entregar un escalar como vector de largo uno.
function escalar(value: unknown): unknown {
  return Array.isArray(value) && value.length === 1 ? value[0] : value;
}

function texto(value: unknown): string {
  const v = escalar(value);
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

function entero(value: unknown): number {
  const v = escalar(value);
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

function enteroOpcional(value: unknown): number | null {
  const v = escalar(value);
  if (v == null || v === "") return null;
  return entero(v);
}

function proporcion(value: unknown): number | null {
  const v = escalar(value);
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.min(1, Math.max(0, n));
}

function booleano(value: unknown): boolean {
  const v = escalar(value);
  return v === true || v === 1 || v === "1" || v === "true" || v === "TRUE";
}

function lista(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  // Un único objeto que R desenrolló al tener largo uno.
  return value && typeof value === "object" ? [value] : [];
}

function preguntas(value: unknown): CampanaPregunta[] {
  return lista(value)
    .map((item) => {
      if (typeof item === "string") return { variable: item.trim(), etiqueta: "" };
      const r = registro(item);
      return { variable: texto(r.variable), etiqueta: texto(r.etiqueta) };
    })
    .filter((item) => item.variable || item.etiqueta);
}

export function normalizeCampanaVistaPrevia(raw: unknown): CampanaVistaPrevia {
  const r = registro(raw);
  const nEmparejadas = entero(r.n_emparejadas);
  const nBase = entero(r.n_preguntas_base);
  const cobertura = proporcion(r.cobertura) ?? (nBase > 0 ? nEmparejadas / nBase : null);
  return {
    survey_id: texto(r.survey_id),
    titulo: texto(r.titulo),
    n_emparejadas: nEmparejadas,
    n_preguntas_base: nBase,
    cobertura,
    cobertura_texto: texto(r.cobertura_texto),
    instrumento_distinto: booleano(r.instrumento_distinto),
    faltan: preguntas(r.faltan),
    extra: preguntas(r.extra),
    ambiguas: preguntas(r.ambiguas),
  };
}

export function normalizeCampanaSugerencia(raw: unknown): CampanaSugerencia | null {
  const r = registro(escalar(raw));
  const formId = texto(r.form_id);
  if (!formId) return null;
  return {
    form_id: formId,
    form_name: texto(r.form_name) || "Formulario",
    survey_id_principal: texto(r.survey_id_principal),
    cobertura: proporcion(r.cobertura),
    cobertura_texto: texto(r.cobertura_texto),
    n_emparejadas: entero(r.n_emparejadas),
    n_preguntas_base: entero(r.n_preguntas_base),
  };
}

/** Una variante es campaña sólo si declara su rol; las demás se ignoran. */
export function normalizeCampanaDeclarada(raw: unknown): CampanaDeclarada | null {
  const r = registro(raw);
  if (texto(r.rol) !== CAMPANA_ROL) return null;
  const surveyId = texto(r.survey_id);
  if (!surveyId) return null;
  return {
    survey_id: surveyId,
    survey_title: texto(r.survey_title),
    n_emparejadas: enteroOpcional(r.n_emparejadas),
    n_preguntas_base: enteroOpcional(r.n_preguntas_base),
    cobertura: proporcion(r.cobertura),
    sin_par_base: preguntas(r.sin_par_base),
    declarada_en: texto(r.declarada_en),
    review_status: texto(r.review_status),
  };
}

/** Campañas declaradas en la procedencia de un formulario, sin repetidas. */
export function campanasDeFuente(source: XlsformFormSource | null | undefined): CampanaDeclarada[] {
  const vistas = new Set<string>();
  const salida: CampanaDeclarada[] = [];
  for (const variante of source?.variants ?? []) {
    const campana = normalizeCampanaDeclarada(variante);
    if (!campana || vistas.has(campana.survey_id)) continue;
    vistas.add(campana.survey_id);
    salida.push(campana);
  }
  return salida;
}

// ---------------------------------------------------------------------------
// Endpoints (contrato HTTP del ADR 0101)
// ---------------------------------------------------------------------------

function rutaFormulario(formId: string): string {
  return `/api/xlsform-editor/forms/${encodeURIComponent(formId)}/campanas`;
}

function cuerpoJson(surveyId: string): RequestInit {
  return {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({ survey_id: surveyId }),
  };
}

export async function apiCampanaVistaPrevia(formId: string, surveyId: string): Promise<CampanaVistaPrevia> {
  const raw = await handle<unknown>(
    await apiFetch(`${rutaFormulario(formId)}/vista-previa`, cuerpoJson(surveyId)),
  );
  return normalizeCampanaVistaPrevia(raw);
}

export async function apiCampanaDeclarar(formId: string, surveyId: string): Promise<CampanaDeclararResultado> {
  const raw = registro(await handle<unknown>(
    await apiFetch(rutaFormulario(formId), cuerpoJson(surveyId)),
  ));
  return {
    form: normalizeFormLibraryEntry(raw.form),
    campana: normalizeCampanaDeclarada(raw.campana),
  };
}

export async function apiCampanaQuitar(formId: string, surveyId: string): Promise<{ form: FormLibraryEntry | null }> {
  const raw = registro(await handle<unknown>(
    await apiFetch(`${rutaFormulario(formId)}/${encodeURIComponent(surveyId)}`, {
      method: "DELETE",
      headers: headers(),
    }),
  ));
  return { form: normalizeFormLibraryEntry(raw.form) };
}

export async function apiCampanaSugerir(surveyId: string): Promise<CampanaSugerencia | null> {
  const raw = registro(await handle<unknown>(
    await apiFetch("/api/xlsform-editor/campanas/sugerir", cuerpoJson(surveyId)),
  ));
  return normalizeCampanaSugerencia(raw.sugerencia);
}
