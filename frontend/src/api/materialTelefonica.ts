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
};

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
    observacion: texto(o.observacion) || "Observación",
    sensibles: lista(o.sensibles).map(texto).filter(Boolean),
    status,
    status_propio: escalar(o.status_propio) === true,
    revision: entero(o.revision),
    lee_monitoreo: lista(o.lee_monitoreo).map(texto).filter(Boolean),
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
