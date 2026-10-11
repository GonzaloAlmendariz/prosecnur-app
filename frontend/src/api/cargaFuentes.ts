// cargaFuentes.ts — cómo se emparejó cada pregunta de las fuentes de una base
// (ADR 0099, ítem 15 del checklist `codificacion-sm-2026-10-11`).
//
// Una base SurveyMonkey puede juntar varias encuestas: los canales de un mismo
// público. Cada fuente se empareja con la base pregunta por pregunta, con la
// clave de Equivalencias. Este endpoint devuelve el detalle por pregunta para
// que Carga › Revisión lo muestre en llano.
//
// No se reexporta desde el barrel `client.ts`: el código nuevo importa de su
// módulo de dominio (patrón de `equivalencias.ts`).

import { apiFetch, handle, headers } from "./core";

export type EmparejamientoEstadoFila =
  | "emparejada"
  | "otro_nombre"
  | "no_entro"
  | "sin_respuesta"
  | "ambigua";

export const EMPAREJAMIENTO_ESTADOS_FILA: readonly EmparejamientoEstadoFila[] = [
  "emparejada",
  "otro_nombre",
  "no_entro",
  "sin_respuesta",
  "ambigua",
];

export type EmparejamientoFila = {
  seccion: string;
  /**
   * La pregunta madre cuando la variable es una fila de matriz; `""` si no lo
   * es o si el backend no lo manda.
   */
  enunciado: string;
  etiqueta: string;
  /** Vacía cuando la pregunta solo existe en la fuente (`no_entro`). */
  variable_base: string;
  /** Vacía cuando la fuente no trae la pregunta (`sin_respuesta`). */
  variable_fuente: string;
  estado: EmparejamientoEstadoFila;
};

export type EmparejamientoFuente = {
  survey_id: string;
  titulo: string;
  estado: "incorporada" | "excluida";
  n_emparejadas: number;
  n_preguntas_base: number;
  /** Respuestas de la fuente que entraron a la base. `null` si el payload no lo trae. */
  n_filas_incorporadas: number | null;
  n_filas_excluidas: number;
  /** `false` en bases importadas antes de que se guardara el detalle por pregunta. */
  detalle_disponible: boolean;
  filas: EmparejamientoFila[];
};

export type EmparejamientoEquivalencias = {
  /** El mismo predicado que ofrece la pestaña Equivalencias (ADR 0061/0062). */
  disponible: boolean;
  /** Por qué no está, en llano. Vacío cuando está disponible. */
  motivo: string;
};

export type CargaFuentesEmparejamiento = {
  base_nombre: string | null;
  equivalencias: EmparejamientoEquivalencias;
  fuentes: EmparejamientoFuente[];
};

// ---------------------------------------------------------------------------
// Normalizador defensivo
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

function booleano(value: unknown): boolean {
  const v = escalar(value);
  return v === true || v === 1 || v === "1" || v === "true" || v === "TRUE";
}

function lista(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  // Un único objeto que R desenrolló al tener largo uno.
  return value && typeof value === "object" ? [value] : [];
}

/**
 * Filas (`[{seccion, …}]`) o columnas (`{seccion: [], etiqueta: [], …}`): las
 * dos formas en que un data.frame de R llega serializado.
 */
function filasDeDataFrame(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw.map(registro);
  const columnas = registro(raw);
  const nombres = Object.keys(columnas);
  if (!nombres.length) return [];
  const columnar = nombres.every((nombre) => Array.isArray(columnas[nombre]));
  if (!columnar) return [columnas];
  const largo = Math.max(...nombres.map((nombre) => (columnas[nombre] as unknown[]).length));
  return Array.from({ length: largo }, (_, index) => {
    const fila: Record<string, unknown> = {};
    for (const nombre of nombres) fila[nombre] = (columnas[nombre] as unknown[])[index];
    return fila;
  });
}

function esEstadoFila(value: string): value is EmparejamientoEstadoFila {
  return (EMPAREJAMIENTO_ESTADOS_FILA as readonly string[]).includes(value);
}

/**
 * Un estado desconocido se lee como «emparejada» solo si la fila trae las dos
 * variables: sin ellas no hay forma honesta de decir qué le pasó, y se descarta.
 */
function normalizarFila(raw: Record<string, unknown>): EmparejamientoFila | null {
  const variableBase = texto(raw.variable_base);
  const variableFuente = texto(raw.variable_fuente);
  const estadoCrudo = texto(raw.estado);
  let estado: EmparejamientoEstadoFila;
  if (esEstadoFila(estadoCrudo)) {
    estado = estadoCrudo;
  } else if (variableBase && variableFuente) {
    estado = "emparejada";
  } else {
    return null;
  }
  const etiqueta = texto(raw.etiqueta);
  if (!etiqueta && !variableBase && !variableFuente) return null;
  return {
    seccion: texto(raw.seccion),
    enunciado: texto(raw.enunciado),
    etiqueta,
    variable_base: variableBase,
    variable_fuente: variableFuente,
    estado,
  };
}

function normalizarFuente(raw: Record<string, unknown>): EmparejamientoFuente | null {
  const surveyId = texto(raw.survey_id);
  const titulo = texto(raw.titulo);
  if (!surveyId && !titulo) return null;
  const filas = filasDeDataFrame(raw.filas)
    .map(normalizarFila)
    .filter((fila): fila is EmparejamientoFila => fila !== null);
  return {
    survey_id: surveyId,
    titulo,
    estado: texto(raw.estado) === "excluida" ? "excluida" : "incorporada",
    n_emparejadas: entero(raw.n_emparejadas),
    n_preguntas_base: entero(raw.n_preguntas_base),
    // Ausente no es cero: sin el dato no se puede decir que no tenga respuestas.
    n_filas_incorporadas: escalar(raw.n_filas_incorporadas) == null ? null : entero(raw.n_filas_incorporadas),
    n_filas_excluidas: entero(raw.n_filas_excluidas),
    // Sin la marca, el detalle cuenta como disponible solo si trae filas.
    detalle_disponible: raw.detalle_disponible === undefined
      ? filas.length > 0
      : booleano(raw.detalle_disponible),
    filas,
  };
}

export function normalizeCargaFuentesEmparejamiento(raw: unknown): CargaFuentesEmparejamiento {
  const root = registro(raw);
  const equivalencias = registro(root.equivalencias);
  const disponible = booleano(equivalencias.disponible);
  const baseNombre = texto(root.base_nombre);
  return {
    base_nombre: baseNombre || null,
    equivalencias: {
      disponible,
      motivo: disponible ? "" : texto(equivalencias.motivo),
    },
    fuentes: lista(root.fuentes)
      .map(registro)
      .map(normalizarFuente)
      .filter((fuente): fuente is EmparejamientoFuente => fuente !== null),
  };
}

export async function apiCargaFuentesEmparejamiento(
  baseNombre?: string | null,
): Promise<CargaFuentesEmparejamiento> {
  const base = baseNombre?.trim();
  const qs = base ? `?${new URLSearchParams({ base_nombre: base }).toString()}` : "";
  const raw = await handle<unknown>(
    await apiFetch(`/api/carga/fuentes/emparejamiento${qs}`, { headers: headers() }),
  );
  return normalizeCargaFuentesEmparejamiento(raw);
}
