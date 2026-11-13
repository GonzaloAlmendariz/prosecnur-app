// cargaEmparejamiento.ts — emparejar las columnas de la base por el texto de la pregunta.
//
// Ítem 4 del checklist de validación del practicante. Cuando la base trae como
// encabezado el texto de cada pregunta y no su `name`, el backend propone el
// emparejamiento (api/R/carga_emparejar_por_texto.R) y, si la persona lo
// acepta, carga la base con los encabezados renombrados
// (api/R/carga_emparejar_por_texto_aplicar.R).
//
// No se reexporta desde el barrel `client.ts`.

import { apiFetch, handle, headers } from "./core";
import { normalizarCambiosDeRespuestas } from "./estudio";
import { enteroONulo, lista, registro, texto } from "./normalizarR";
import type { apiCargaData } from "./xlsformEditor";

type VistaPreviaDeCarga = Awaited<ReturnType<typeof apiCargaData>>["preview"];

export type EstadoEmparejamiento = "nombre" | "exacta" | "contenida" | "dudosa" | "ambigua" | "sin_pareja";

const ESTADOS: readonly EstadoEmparejamiento[] = ["nombre", "exacta", "contenida", "dudosa", "ambigua", "sin_pareja"];

export type CandidataEmparejamiento = { name: string; pregunta: string };

export type ColumnaEmparejamiento = {
  /** Posición de la columna en la base (1, 2, ...). */
  columna: number;
  /** Encabezado tal como viene en el archivo, sin recortar: el backend lo compara literal. */
  encabezado: string;
  estado: EstadoEmparejamiento;
  /** Pregunta propuesta (`name` o `pregunta/opción`); vacío si no hay. */
  name: string;
  pregunta: string;
  confianza: "alta" | "media" | "baja" | "";
  causa: string;
  candidatos: CandidataEmparejamiento[];
};

export type ResumenEmparejamiento = {
  n_columnas: number;
  n_ya_calzan: number;
  n_propuestas: number;
  n_dudosas: number;
  n_ambiguas: number;
  n_sin_pareja: number;
  n_preguntas: number;
  n_preguntas_sin_columna: number;
};

export type PropuestaEmparejamiento = {
  resumen: ResumenEmparejamiento;
  columnas: ColumnaEmparejamiento[];
  sin_columna: CandidataEmparejamiento[];
};

export type ParejaAceptada = { columna: number; encabezado: string; name: string };

function textoCrudo(value: unknown): string {
  const v = Array.isArray(value) && value.length === 1 ? value[0] : value;
  return typeof v === "string" ? v : texto(v);
}

function estado(value: unknown): EstadoEmparejamiento {
  const v = texto(value) as EstadoEmparejamiento;
  return ESTADOS.includes(v) ? v : "sin_pareja";
}

function confianza(value: unknown): ColumnaEmparejamiento["confianza"] {
  const v = texto(value);
  return v === "alta" || v === "media" || v === "baja" ? v : "";
}

function candidata(raw: Record<string, unknown>): CandidataEmparejamiento {
  return { name: texto(raw.name), pregunta: texto(raw.pregunta) };
}

export function normalizarPropuestaEmparejamiento(raw: unknown): PropuestaEmparejamiento {
  const r = registro(raw);
  const res = registro(r.resumen);
  const n = (k: string) => enteroONulo(res[k]) ?? 0;
  return {
    resumen: {
      n_columnas: n("n_columnas"),
      n_ya_calzan: n("n_ya_calzan"),
      n_propuestas: n("n_propuestas"),
      n_dudosas: n("n_dudosas"),
      n_ambiguas: n("n_ambiguas"),
      n_sin_pareja: n("n_sin_pareja"),
      n_preguntas: n("n_preguntas"),
      n_preguntas_sin_columna: n("n_preguntas_sin_columna"),
    },
    columnas: lista(r.columnas).map((c) => ({
      columna: enteroONulo(c.columna) ?? 0,
      encabezado: textoCrudo(c.encabezado),
      estado: estado(c.estado),
      name: texto(c.name),
      pregunta: texto(c.pregunta),
      confianza: confianza(c.confianza),
      causa: texto(c.causa),
      candidatos: lista(c.candidatos).map(candidata).filter((x) => x.name),
    })),
    sin_columna: lista(r.sin_columna).map(candidata).filter((x) => x.name),
  };
}

/** Propuesta para un archivo recién subido. No carga nada y retira la subida del registro. */
export async function apiCargaEmparejamientoTexto(file_id: string): Promise<PropuestaEmparejamiento> {
  const raw = await handle<unknown>(
    await apiFetch("/api/carga/data/emparejamiento-texto", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ file_id }),
    }),
  );
  return normalizarPropuestaEmparejamiento(raw);
}

/** Carga la base subida con los encabezados de las parejas aceptadas renombrados. */
export async function apiCargaEmparejamientoTextoAplicar(file_id: string, parejas: ParejaAceptada[]) {
  // Mismo preview que `POST /api/carga/data`: el backend carga la copia con `.carga_procesar_data()`.
  const raw = await handle<{
    ok: true;
    preview: VistaPreviaDeCarga;
    cambios?: unknown;
    emparejamiento?: { n_renombradas: number; archivo: string };
  }>(
    await apiFetch("/api/carga/data/emparejamiento-texto/aplicar", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ file_id, parejas }),
    }),
  );
  return { ...raw, cambios: normalizarCambiosDeRespuestas(raw.cambios) };
}
