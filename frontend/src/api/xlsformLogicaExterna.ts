// xlsformLogicaExterna.ts — lógica y limpieza hechas fuera de Prosecnur.
//
// Caso (2026-10-14): el analista ya aplicó los saltos y limpió la base en otro
// programa (SPSS, R…); sólo quiere el instrumento en XLSForm para cargar la base
// limpia en Procesamiento. La declaración es por formulario y la guarda el
// backend en la procedencia: `logic_status = "external_declared"` más
// `logic_external = {herramienta, nota, declarada_en}`.
//
// Este módulo sólo trae tipos y normalizadores puros: la función que llama al
// endpoint vive con las demás del formulario en `xlsformEditor.ts`, que importa
// de aquí (no al revés) para no formar un ciclo.

import type { XlsformFormSource, XlsformLogicaExternaSource } from "./multiIntegrado";

/** Valor de `logic_status` con la lógica declarada fuera de Prosecnur. */
export const LOGICA_EXTERNA_STATUS = "external_declared";

/** Rótulo que el backend usa cuando no se dijo el programa. */
const HERRAMIENTA_SIN_NOMBRE = "otro programa";

/** Cuerpo de `POST /api/xlsform-editor/forms/<id>/logica-externa`. */
export type DeclaracionLogicaExterna = {
  /** `false` retira la declaración. Por defecto `true`. */
  declarada?: boolean;
  herramienta?: string;
  nota?: string;
};

/** Lectura de la declaración para pintar: `null` si el formulario no la tiene. */
export type LogicaExterna = {
  /** Programa donde se hizo; vacío si no se dijo. */
  herramienta: string;
  nota: string;
  declaradaEn: string;
};

// jsonlite serializa un vector de largo 1 como escalar, pero un campo que llegó
// como `["SPSS"]` también debe leerse.
function texto(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value) && typeof value[0] === "string") return value[0].trim();
  return "";
}

/**
 * Normaliza `source.logic_external`. Al retirar la declaración el backend deja
 * `list()`, que llega como `[]` o `{}`: eso es «sin declaración» y devuelve
 * `undefined` para que la procedencia no arrastre un objeto vacío.
 */
export function normalizeLogicaExternaSource(value: unknown): XlsformLogicaExternaSource | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  const herramienta = texto(raw.herramienta);
  const nota = texto(raw.nota);
  const declaradaEn = texto(raw.declarada_en);
  if (!herramienta && !nota && !declaradaEn) return undefined;
  return { herramienta, nota, declarada_en: declaradaEn };
}

/**
 * La declaración vigente, o `null`. Manda `logic_status`: un `logic_external`
 * que sobrevivió a un retiro no cuenta como declaración.
 */
export function leerLogicaExterna(source: XlsformFormSource | null | undefined): LogicaExterna | null {
  if (!source || source.logic_status !== LOGICA_EXTERNA_STATUS) return null;
  const raw = source.logic_external;
  const herramienta = raw?.herramienta?.trim() ?? "";
  return {
    herramienta: herramienta.toLowerCase() === HERRAMIENTA_SIN_NOMBRE ? "" : herramienta,
    nota: raw?.nota?.trim() ?? "",
    declaradaEn: raw?.declarada_en ?? "",
  };
}
