// monitoreoAulasTablas.ts — Monitoreo comprueba que las tablas que Material
// construyó en el Sheets existen (ADR 0125). Contrato:
// `api/R/monitoreo_aulas_tablas_construidas.R`.
//   GET /api/monitoreo/aulas/tablas-construidas  lectura de los nombres de pestaña

import { apiFetch, handle, headers } from "./core";
import { escalar, registro, texto } from "./normalizarR";

/** `null` cuando hay destino pero el documento no se pudo leer. */
export type ExisteTabla = boolean | null;

export type TablaDeMaterial = {
  destino: string;
  url: string;
  existe: ExisteTabla;
  error: string;
};

export type TablasConstruidas = {
  libro: TablaDeMaterial & { faltan: string[] };
  distribucion: TablaDeMaterial & { semanas: string[] };
};

function textos(value: unknown): string[] {
  const v = Array.isArray(value) ? value : value == null ? [] : [value];
  return v.map(texto).filter(Boolean);
}

function existe(value: unknown): ExisteTabla {
  const v = escalar(value);
  if (v === true || v === false) return v;
  return null;
}

function tabla(raw: unknown): TablaDeMaterial {
  const r = registro(raw);
  const destino = texto(r.destino);
  return { destino, url: texto(r.url), existe: destino ? existe(r.existe) : false, error: texto(r.error) };
}

export function normalizarTablasConstruidas(raw: unknown): TablasConstruidas {
  const r = registro(raw);
  const libro = registro(r.libro);
  const distribucion = registro(r.distribucion);
  return {
    libro: { ...tabla(libro), faltan: textos(libro.faltan) },
    distribucion: { ...tabla(distribucion), semanas: textos(distribucion.semanas) },
  };
}

export async function apiMonitoreoAulasTablasConstruidas(): Promise<TablasConstruidas> {
  return normalizarTablasConstruidas(
    await handle<unknown>(await apiFetch("/api/monitoreo/aulas/tablas-construidas", { headers: headers() })),
  );
}
