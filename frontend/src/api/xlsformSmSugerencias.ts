// xlsformSmSugerencias.ts — sugerencias de lógica al importar desde SurveyMonkey.
//
// La API de SurveyMonkey no comparte la lógica de saltos: el formulario se
// importa sin saltos. El servidor reconoce lo evidente —la pregunta de
// consentimiento corta la encuesta cuando la respuesta es negativa— y lo ofrece
// como SUGERENCIA. El cliente la muestra; nunca la aplica sola (checklist
// 2026-10-14, H4).
//
// R serializa las listas vacías como `[]` y los objetos nulos como `{}`: el
// normalizador no confía en la forma.
//
// No se reexporta desde el barrel `client.ts`.

import { apiFetch, handle, headers } from "./core";

export type SmOpcionQueCorta = {
  codigo: string;
  etiqueta: string;
};

export type SmSugerenciaLogica = {
  tipo: "fin_de_encuesta";
  /** Variable del formulario (`p1`), no la referencia de SurveyMonkey. */
  variable: string;
  etiqueta: string;
  opciones_que_cortan: SmOpcionQueCorta[];
  motivo: string;
};

export type SmSugerenciasLogica = {
  survey_id: string;
  logica_disponible_en_api: boolean;
  aviso: string;
  sugerencias: SmSugerenciaLogica[];
};

const AVISO_POR_DEFECTO =
  "SurveyMonkey no comparte la lógica de saltos por su API: el formulario se importa sin saltos.";

function texto(value: unknown): string {
  if (Array.isArray(value)) return texto(value[0]);
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function registro(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function lista(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  // `{}` es una lista vacía serializada por R; un objeto con campos es un
  // único elemento que jsonlite no envolvió.
  const r = registro(value);
  return r && Object.keys(r).length ? [r] : [];
}

function normalizeOpcion(raw: unknown): SmOpcionQueCorta | null {
  const r = registro(raw);
  if (!r) return null;
  const codigo = texto(r.codigo);
  const etiqueta = texto(r.etiqueta);
  if (!codigo && !etiqueta) return null;
  return { codigo, etiqueta: etiqueta || codigo };
}

function normalizeSugerencia(raw: unknown): SmSugerenciaLogica | null {
  const r = registro(raw);
  if (!r || texto(r.tipo) !== "fin_de_encuesta") return null;
  const variable = texto(r.variable);
  const opciones = lista(r.opciones_que_cortan)
    .map(normalizeOpcion)
    .filter((o): o is SmOpcionQueCorta => o !== null);
  if (!variable || !opciones.length) return null;
  return {
    tipo: "fin_de_encuesta",
    variable,
    etiqueta: texto(r.etiqueta) || variable,
    opciones_que_cortan: opciones,
    motivo: texto(r.motivo),
  };
}

export function normalizeSmSugerenciasLogica(raw: unknown): SmSugerenciasLogica {
  const r = registro(raw) ?? {};
  return {
    survey_id: texto(r.survey_id),
    logica_disponible_en_api: r.logica_disponible_en_api === true || texto(r.logica_disponible_en_api) === "TRUE",
    aviso: texto(r.aviso) || AVISO_POR_DEFECTO,
    sugerencias: lista(r.sugerencias)
      .map(normalizeSugerencia)
      .filter((s): s is SmSugerenciaLogica => s !== null),
  };
}

export async function apiXlsformSmSugerenciasLogica(surveyId: string): Promise<SmSugerenciasLogica> {
  const raw = await handle<unknown>(
    await apiFetch("/api/xlsform-editor/surveymonkey/sugerencias-logica", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ survey_id: surveyId }),
    }),
  );
  return normalizeSmSugerenciasLogica(raw);
}
