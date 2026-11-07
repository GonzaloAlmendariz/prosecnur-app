// materialTelefonica.ts — la campaña telefónica de Material (P10, etapa 4).
//
//   GET/PUT /api/recopiladores/campaigns/telefonica/config   la configuración (sin datos
//       personales: el listado vive en el archivo del operativo).
//   POST    /api/recopiladores/campaigns/telefonica/plantilla  el libro del barrido.
//
// Normalización defensiva: R serializa un vector de largo uno como escalar, un NA como
// `null` y una lista vacía como `{}`.

import { apiFetch, handle, headers } from "./core";

export type ClaseDeStatus = "efectiva" | "pendiente" | "no_contacto" | "rechazo" | "invalido";

export type StatusDelBarrido = { codigo: string; status: string; clase: ClaseDeStatus };

export type ConfigTelefonica = {
  campaign_id: string;
  llave: string;
  estratos: string[];
  telefonos: TelefonosPorCaso;
  reemplazo: boolean;
  muestra: number;
  backup: number;
  responsables: string[];
  /** Los responsables vienen del padrón del equipo de Monitoreo, no tecleados (se siembran, no se guardan). */
  responsables_del_padron: boolean;
  /** Rótulo de la última columna de la cola: «Observación» u «Observaciones» según el estudio (T13). */
  observacion: string;
  /** Estratos marcados sensibles (p. ej. «Estatus Legal»): no salen al Sheets ni a ningún artefacto (T14). */
  sensibles: string[];
  status: StatusDelBarrido[];
  /** El estudio mandó su propio catálogo (si no, es el del RMS). */
  status_propio: boolean;
  revision: number;
  /** Columnas que Monitoreo telefónico lee del Sheets: no se renombran. */
  lee_monitoreo: string[];
  /** El documento del barrido de esta campaña y si Monitoreo ya lo conectó como fuente (revamp v5). */
  barrido: EstadoDelBarrido;
};

export type EstadoDelBarrido = {
  construido: boolean;
  url: string | null;
  pestana: string | null;
  actualizado_en: string | null;
  conectado_en_monitoreo: boolean;
};

export function normalizarEstadoDelBarrido(valor: unknown): EstadoDelBarrido {
  const o = esRegistro(valor) ? valor : {};
  const url = texto(o.url);
  const construido = escalar(o.construido) === true && Boolean(url);
  return {
    construido,
    url: construido ? url : null,
    pestana: construido ? texto(o.pestana) || null : null,
    actualizado_en: construido ? texto(o.actualizado_en) || null : null,
    conectado_en_monitoreo: construido && escalar(o.conectado_en_monitoreo) === true,
  };
}

export type TelefonosPorCaso = 1 | 2 | 3 | 4;

export type CambioTelefonico = Partial<{
  llave: string;
  estratos: string[];
  telefonos: TelefonosPorCaso;
  observacion: string;
  sensibles: string[];
  reemplazo: boolean;
  muestra: number;
  backup: number;
  responsables: string[];
}>;

export type PlantillaDelBarrido = { file_id: string; filename: string; filas: number; status: number };

type Registro = Record<string, unknown>;

function esRegistro(valor: unknown): valor is Registro {
  return Boolean(valor) && typeof valor === "object" && !Array.isArray(valor);
}

function escalar(valor: unknown): unknown {
  return Array.isArray(valor) && valor.length === 1 ? valor[0] : valor;
}

function texto(valor: unknown): string {
  const v = escalar(valor);
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

function entero(valor: unknown): number {
  const v = escalar(valor);
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : Number.NaN;
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
}

function lista(valor: unknown): unknown[] {
  if (Array.isArray(valor)) return valor;
  return esRegistro(valor) && Object.keys(valor).length ? [valor] : [];
}

const CLASES: readonly ClaseDeStatus[] = ["efectiva", "pendiente", "no_contacto", "rechazo", "invalido"];

export function normalizarConfigTelefonica(valor: unknown): ConfigTelefonica {
  const o = esRegistro(valor) ? valor : {};
  const tel = entero(o.telefonos);
  const status = lista(o.status).flatMap((s): StatusDelBarrido[] => {
    if (!esRegistro(s)) return [];
    const etiqueta = texto(s.status);
    const clase = texto(s.clase) as ClaseDeStatus;
    return etiqueta ? [{ codigo: texto(s.codigo), status: etiqueta, clase: CLASES.includes(clase) ? clase : "pendiente" }] : [];
  });
  return {
    campaign_id: texto(o.campaign_id),
    llave: texto(o.llave) || "Código",
    estratos: lista(o.estratos).map(texto).filter(Boolean),
    telefonos: tel === 1 || tel === 3 || tel === 4 ? tel : 2,
    reemplazo: escalar(o.reemplazo) === true,
    muestra: entero(o.muestra),
    backup: entero(o.backup),
    responsables: lista(o.responsables).map(texto).filter(Boolean),
    responsables_del_padron: escalar(o.responsables_del_padron) === true,
    observacion: texto(o.observacion) || "Observación",
    sensibles: lista(o.sensibles).map(texto).filter(Boolean),
    status,
    status_propio: escalar(o.status_propio) === true,
    revision: entero(o.revision),
    lee_monitoreo: lista(o.lee_monitoreo).map(texto).filter(Boolean),
    barrido: normalizarEstadoDelBarrido(o.barrido),
  };
}

export async function apiMaterialTelefonicaConfig(campaignId: string): Promise<ConfigTelefonica> {
  const qs = new URLSearchParams({ id: campaignId });
  return normalizarConfigTelefonica(
    await handle<unknown>(await apiFetch(`/api/recopiladores/campaigns/telefonica/config?${qs.toString()}`, { headers: headers() })),
  );
}

export async function apiMaterialTelefonicaGuardarConfig(campaignId: string, cambio: CambioTelefonico, expectedRevision: number): Promise<ConfigTelefonica> {
  return normalizarConfigTelefonica(
    await handle<unknown>(
      await apiFetch("/api/recopiladores/campaigns/telefonica/config", {
        method: "PUT",
        headers: headers({ "Content-Type": "application/json" }),
        body: JSON.stringify({ id: campaignId, ...cambio, expected_revision: expectedRevision }),
      }),
    ),
  );
}

export async function apiMaterialTelefonicaPlantilla(campaignId: string): Promise<PlantillaDelBarrido> {
  const r = await handle<unknown>(
    await apiFetch("/api/recopiladores/campaigns/telefonica/plantilla", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ id: campaignId }),
    }),
  );
  const o = esRegistro(r) ? r : {};
  const file_id = texto(o.file_id);
  if (!file_id) throw new Error("El backend no devolvió la plantilla.");
  return { file_id, filename: texto(o.filename), filas: entero(o.filas), status: entero(o.status) };
}

// ---- La base de barrido en el Sheets del estudio (decisión de Gonzalo 2 nov 2026) ----------------------

export type AccionEnSheets = "sembrada" | "respetada";
export type PestanaSembrada = { hoja: string; accion: AccionEnSheets; filas: number };
export type BarridoEnSheets = { url: string; hojas: PestanaSembrada[]; columnas: string[]; sinSensibles: string[] };

export function normalizarBarridoEnSheets(r: unknown): BarridoEnSheets {
  const o = esRegistro(r) ? r : {};
  // R manda una lista de uno como escalar suelto (texto u objeto) y una vacía como `{}`.
  const lista = (v: unknown): unknown[] =>
    Array.isArray(v) ? v : typeof v === "string" ? [v] : esRegistro(v) && Object.keys(v).length ? [v] : [];
  const url = texto(o.url);
  if (!url) throw new Error("El backend no devolvió el Sheets.");
  return {
    url,
    hojas: lista(o.hojas).filter(esRegistro).map((h): PestanaSembrada => ({
      hoja: texto(h.hoja),
      accion: texto(h.accion) === "sembrada" ? "sembrada" : "respetada",
      filas: entero(h.filas),
    })).filter((h) => h.hoja),
    columnas: lista(o.columnas).map(texto).filter(Boolean),
    sinSensibles: lista(o.sin_sensibles).map(texto).filter(Boolean),
  };
}

/** Siembra «Barrido», «Listas» y «Léeme» en el Sheets del enlace; una pestaña que ya existe no se toca. */
export async function apiMaterialTelefonicaSheets(campaignId: string, enlace: string): Promise<BarridoEnSheets> {
  return normalizarBarridoEnSheets(
    await handle<unknown>(
      await apiFetch("/api/recopiladores/campaigns/telefonica/sheets", {
        method: "POST",
        headers: headers({ "Content-Type": "application/json" }),
        body: JSON.stringify({ id: campaignId, enlace }),
      }),
    ),
  );
}
