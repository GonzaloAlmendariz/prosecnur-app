// materialSupervision.ts — la base de supervisión de un lote de Monitoreo (ADR 0125 anexo A3).
//
// Bajo /api/recopiladores/campaigns/supervision/:
//   GET  columnas?id=supervision.<lote>   lo disponible (barrido y resultados), lo elegido y lo fijo
//   PUT  columnas {id, barrido, resultados, expected_revision}
//   POST excel {id}                        el Excel del lote, una fila por caso
//
// Normalización defensiva: R manda un vector de uno como escalar y una lista vacía como `{}`.

import { apiFetch, handle, headers } from "./core";
import { camposDeEntregable, type CamposDeEntregable } from "./jobs";

export type VariableDeResultados = { nombre: string; etiqueta: string };

export type ColumnasDeSupervision = {
  campaign_id: string;
  llave: string;
  disponibles: { barrido: string[]; resultados: VariableDeResultados[] };
  elegidas: { barrido: string[]; resultados: string[] };
  /** Las tres que lee Monitoreo, con nombre fijo. */
  fijas: string[];
  veredictos: string[];
  revision: number;
};

type Registro = Record<string, unknown>;
const esRegistro = (v: unknown): v is Registro => Boolean(v) && typeof v === "object" && !Array.isArray(v);
const escalar = (v: unknown): unknown => (Array.isArray(v) && v.length === 1 ? v[0] : v);
const texto = (v: unknown): string => {
  const x = escalar(v);
  return typeof x === "string" ? x.trim() : typeof x === "number" && Number.isFinite(x) ? String(x) : "";
};
const entero = (v: unknown): number => {
  const x = escalar(v);
  const n = typeof x === "number" ? x : typeof x === "string" && x.trim() ? Number(x) : Number.NaN;
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
};
const lista = (v: unknown): unknown[] =>
  Array.isArray(v) ? v : typeof v === "string" ? [v] : esRegistro(v) && Object.keys(v).length ? [v] : [];
const textos = (v: unknown): string[] => [...new Set(lista(v).map(texto).filter(Boolean))];

export function normalizarColumnasDeSupervision(r: unknown): ColumnasDeSupervision {
  if (!esRegistro(r)) throw new Error("El backend devolvió columnas de supervisión inválidas.");
  const disp = esRegistro(r.disponibles) ? r.disponibles : {};
  const eleg = esRegistro(r.elegidas) ? r.elegidas : {};
  return {
    campaign_id: texto(r.campaign_id),
    llave: texto(r.llave) || "Código",
    disponibles: {
      barrido: textos(disp.barrido),
      resultados: lista(disp.resultados).filter(esRegistro).map((x) => ({ nombre: texto(x.nombre), etiqueta: texto(x.etiqueta) })).filter((x) => x.nombre),
    },
    elegidas: { barrido: textos(eleg.barrido), resultados: textos(eleg.resultados) },
    fijas: textos(r.fijas),
    veredictos: textos(r.veredictos),
    revision: entero(r.revision),
  };
}

export async function apiSupervisionColumnas(campaignId: string): Promise<ColumnasDeSupervision> {
  const qs = new URLSearchParams({ id: campaignId });
  return normalizarColumnasDeSupervision(await handle<unknown>(
    await apiFetch(`/api/recopiladores/campaigns/supervision/columnas?${qs.toString()}`, { headers: headers() }),
  ));
}

export async function apiSupervisionGuardarColumnas(
  campaignId: string,
  elegidas: { barrido: string[]; resultados: string[] },
  expectedRevision: number,
): Promise<ColumnasDeSupervision> {
  return normalizarColumnasDeSupervision(await handle<unknown>(
    await apiFetch("/api/recopiladores/campaigns/supervision/columnas", {
      method: "PUT",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ id: campaignId, ...elegidas, expected_revision: expectedRevision }),
    }),
  ));
}

/** La base de supervisión generada, con su nombre y el meta del entregable (ADR 0133). */
export type BaseDeSupervision = { file_id: string; filename: string; casos: number } & CamposDeEntregable;

export async function apiSupervisionExcel(campaignId: string): Promise<BaseDeSupervision> {
  const r = await handle<unknown>(await apiFetch("/api/recopiladores/campaigns/supervision/excel", {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({ id: campaignId }),
  }));
  const o = esRegistro(r) ? r : {};
  const file_id = texto(o.file_id);
  if (!file_id) throw new Error("El backend no devolvió la base de supervisión.");
  return { ...camposDeEntregable(o), file_id, filename: texto(o.filename), casos: entero(o.casos) };
}

// ---- La base en su propio Sheets (Gonzalo: «Fórmula en el Sheets») ----------------------------------

export type SupervisionEnSheets = { url: string; pestana: string; hojas: { hoja: string; accion: "sembrada" | "respetada"; filas: number }[] };

export function normalizarSupervisionEnSheets(r: unknown): SupervisionEnSheets {
  const o = esRegistro(r) ? r : {};
  const url = texto(o.url);
  if (!url) throw new Error("El backend no devolvió el Sheets de la supervisión.");
  return {
    url,
    pestana: texto(o.pestana),
    hojas: lista(o.hojas).filter(esRegistro).map((h) => ({
      hoja: texto(h.hoja),
      accion: texto(h.accion) === "sembrada" ? ("sembrada" as const) : ("respetada" as const),
      filas: entero(h.filas),
    })).filter((h) => h.hoja),
  };
}

/** Arma la pestaña del lote en el Sheets de supervisión; vacío usa el documento ya recordado. */
export async function apiSupervisionSheets(campaignId: string, enlace: string): Promise<SupervisionEnSheets> {
  return normalizarSupervisionEnSheets(await handle<unknown>(await apiFetch("/api/recopiladores/campaigns/supervision/sheets", {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({ id: campaignId, enlace }),
  })));
}
