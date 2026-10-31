// materialTerritorial.ts — la campaña territorial de Material de campo (ADR 0118).
//
// Contrato `ump_territorial_v1` (ADR 0108 §1), bajo /api/recopiladores/:
//   GET campaigns/territorial/unidades?id=territorial.principal
//       las UMP titulares y de reemplazo de la FOTO que Hojas de ruta envió en
//       la fase de la campaña, con su huella y `stale` si la muestra viva ya no
//       la tiene. 409 `E_COLLECTION_TERRITORIAL_SIN_FUENTE` si la foto no está.
//
// Y, para «Nueva campaña», qué fases tienen un envío: `runs[fase].envio_meta`
// de `GET /api/hojas-ruta/state` (sin la foto).
//
// Normalización defensiva: R serializa un vector de largo uno como escalar, un
// NA como `null` y una lista vacía como `{}`. Una unidad sin `unit_id` o con un
// rol que esta versión no conoce se descarta, no se inventa.

import { ApiError, apiFetch, handle, headers } from "./core";

export const FASES_TERRITORIALES = ["pilot", "field"] as const;
export type FaseTerritorial = (typeof FASES_TERRITORIALES)[number];

export type RolDeUmp = "titular" | "reemplazo";

export type UnidadTerritorial = {
  unit_id: string;
  label: string;
  role: RolDeUmp;
  /** La titular a la que reemplaza; `null` en una titular. */
  titular_id: string | null;
  distrito: string;
  ubigeo: string;
  zona: string;
  manzana: string;
  rango_inicio: number | null;
  rango_fin: number | null;
  viviendas: number | null;
};

export type UnidadesTerritoriales = {
  campaign_id: string;
  fase: FaseTerritorial;
  units: UnidadTerritorial[];
  n_titulares: number;
  n_reemplazos: number;
  /** ISO del envío; `null` si no vino. */
  enviado_at: string | null;
  sample_fingerprint: string;
  /** La muestra viva de la fase ya no es la que se envió. */
  stale: boolean;
};

export type EnvioMeta = {
  enviado_at: string | null;
  sample_fingerprint: string;
  n_titulares: number;
  n_reemplazos: number;
  desactualizado: boolean;
};

export type EnviosPorFase = Record<FaseTerritorial, EnvioMeta | null>;

// ---- normalización ------------------------------------------------------------

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

function textoONulo(valor: unknown): string | null {
  return texto(valor) || null;
}

function enteroONulo(valor: unknown): number | null {
  const v = escalar(valor);
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : Number.NaN;
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function entero(valor: unknown): number {
  return Math.max(0, enteroONulo(valor) ?? 0);
}

function logico(valor: unknown): boolean {
  const v = escalar(valor);
  return v === true || v === "true" || v === 1;
}

function lista(valor: unknown): unknown[] {
  if (Array.isArray(valor)) return valor;
  return esRegistro(valor) && Object.keys(valor).length ? [valor] : [];
}

export function esFaseTerritorial(valor: unknown): valor is FaseTerritorial {
  return typeof valor === "string" && (FASES_TERRITORIALES as readonly string[]).includes(valor);
}

export function normalizarUnidadTerritorial(valor: unknown): UnidadTerritorial | null {
  if (!esRegistro(valor)) return null;
  const unit_id = texto(valor.unit_id);
  const role = texto(valor.role);
  if (!unit_id || (role !== "titular" && role !== "reemplazo")) return null;
  return {
    unit_id,
    label: texto(valor.label) || unit_id,
    role,
    titular_id: role === "reemplazo" ? textoONulo(valor.titular_id) : null,
    distrito: texto(valor.distrito),
    ubigeo: texto(valor.ubigeo),
    zona: texto(valor.zona),
    manzana: texto(valor.manzana),
    rango_inicio: enteroONulo(valor.rango_inicio),
    rango_fin: enteroONulo(valor.rango_fin),
    viviendas: enteroONulo(valor.viviendas),
  };
}

export function normalizarUnidadesTerritoriales(valor: unknown): UnidadesTerritoriales {
  if (!esRegistro(valor)) throw new Error("El backend devolvió unidades territoriales inválidas.");
  const vistas = new Set<string>();
  const units: UnidadTerritorial[] = [];
  for (const crudo of lista(valor.units)) {
    const u = normalizarUnidadTerritorial(crudo);
    // Una manzana no se repite: la segunda aparición es ruido del payload.
    if (!u || vistas.has(u.unit_id)) continue;
    vistas.add(u.unit_id);
    units.push(u);
  }
  const fase = texto(valor.fase);
  const titulares = units.filter((u) => u.role === "titular").length;
  return {
    campaign_id: texto(valor.campaign_id),
    fase: esFaseTerritorial(fase) ? fase : "field",
    units,
    n_titulares: enteroONulo(valor.n_titulares) ?? titulares,
    n_reemplazos: enteroONulo(valor.n_reemplazos) ?? units.length - titulares,
    enviado_at: textoONulo(valor.enviado_at),
    sample_fingerprint: texto(valor.sample_fingerprint),
    stale: logico(valor.stale),
  };
}

export function normalizarEnvioMeta(valor: unknown): EnvioMeta | null {
  if (!esRegistro(valor)) return null;
  const huella = texto(valor.sample_fingerprint);
  if (!huella) return null;
  return {
    enviado_at: textoONulo(valor.enviado_at),
    sample_fingerprint: huella,
    n_titulares: entero(valor.n_titulares),
    n_reemplazos: entero(valor.n_reemplazos),
    desactualizado: logico(valor.desactualizado),
  };
}

/** `runs[fase].envio_meta` del estado de Hojas de ruta; una fase sin envío queda en `null`. */
export function normalizarEnviosPorFase(estado: unknown): EnviosPorFase {
  const runs = esRegistro(estado) && esRegistro(estado.runs) ? estado.runs : {};
  const de = (fase: FaseTerritorial) => {
    const run = runs[fase];
    return esRegistro(run) ? normalizarEnvioMeta(run.envio_meta) : null;
  };
  return { pilot: de("pilot"), field: de("field") };
}

// ---- API ----------------------------------------------------------------------

export const CODIGO_SIN_FUENTE = "E_COLLECTION_TERRITORIAL_SIN_FUENTE";

export type LecturaDeUnidades =
  | { ok: true; datos: UnidadesTerritoriales }
  | { ok: false; sinFuente: true; mensaje: string };

/** Las UMP de la foto; sin foto (409) devuelve `sinFuente`, no una lista vacía. */
export async function apiMaterialTerritorialUnidades(campaignId: string): Promise<LecturaDeUnidades> {
  const qs = new URLSearchParams({ id: campaignId });
  try {
    const crudo = await handle<unknown>(
      await apiFetch(`/api/recopiladores/campaigns/territorial/unidades?${qs.toString()}`, { headers: headers() }),
    );
    return { ok: true, datos: normalizarUnidadesTerritoriales(crudo) };
  } catch (causa) {
    if (causa instanceof ApiError && causa.code === CODIGO_SIN_FUENTE) {
      return { ok: false, sinFuente: true, mensaje: causa.message.replace(/ · E_[A-Z_]+$/, "") };
    }
    throw causa;
  }
}

/** Qué fases de Hojas de ruta tienen una muestra enviada (para elegir la de la campaña). */
export async function apiMaterialTerritorialEnvios(): Promise<EnviosPorFase> {
  return normalizarEnviosPorFase(await handle<unknown>(await apiFetch("/api/hojas-ruta/state", { headers: headers() })));
}

// ---- asignación UMP → encuestador (decisión I3, «la de Monitoreo») ---------------
//
//   GET campaigns/territorial/asignacion?id=   lectura pura; sin envío, `sin_fuente`.
//   PUT campaigns/territorial/asignacion       {id, asignacion[{id_manzana, codigo}], expected_revision}
//
// El equipo es la lista de encuestadores de Monitoreo (sólo código y nombre); Material
// guarda qué código va a cada UMP. Un reemplazo hereda en lectura el de su titular.

export type IntegranteEquipo = { codigo: string; nombre: string };

export type UmpAsignada = { id_manzana: string; label: string; role: RolDeUmp; codigo: string; origen: "explicita" | "heredada" };

export type AsignacionTerritorial = {
  campaign_id: string;
  /** "DNI": la lista de Monitoreo identifica por DNI y no se expone (equipo vacío). */
  code_format: string;
  equipo: IntegranteEquipo[];
  asignacion: UmpAsignada[];
  revision: number;
  sin_fuente: boolean;
  /** La muestra viva cambió desde el envío: no se puede asignar. */
  stale: boolean;
  /** Lo guardado es de otra foto (se reenvió la muestra). */
  desactualizada: boolean;
  huerfanas: number;
  codigos_fuera_del_equipo: string[];
  descartadas: number;
};

export function normalizarAsignacionTerritorial(valor: unknown): AsignacionTerritorial {
  if (!esRegistro(valor)) throw new Error("El backend devolvió una asignación territorial inválida.");
  const equipo: IntegranteEquipo[] = [];
  for (const crudo of lista(valor.equipo)) {
    if (!esRegistro(crudo)) continue;
    const codigo = texto(crudo.codigo);
    if (codigo && !equipo.some((e) => e.codigo === codigo)) equipo.push({ codigo, nombre: texto(crudo.nombre) });
  }
  const asignacion: UmpAsignada[] = [];
  for (const crudo of lista(valor.asignacion)) {
    if (!esRegistro(crudo)) continue;
    const id_manzana = texto(crudo.id_manzana);
    const codigo = texto(crudo.codigo);
    const role = texto(crudo.role);
    if (!id_manzana || !codigo || (role !== "titular" && role !== "reemplazo")) continue;
    asignacion.push({ id_manzana, label: texto(crudo.label) || id_manzana, role, codigo, origen: texto(crudo.origen) === "heredada" ? "heredada" : "explicita" });
  }
  return {
    campaign_id: texto(valor.campaign_id),
    code_format: texto(valor.code_format) || "PXXX",
    equipo,
    asignacion,
    revision: entero(valor.asignacion_revision),
    sin_fuente: logico(valor.sin_fuente),
    stale: logico(valor.stale),
    desactualizada: logico(valor.desactualizada),
    huerfanas: entero(valor.huerfanas),
    codigos_fuera_del_equipo: lista(valor.codigos_fuera_del_equipo).map(texto).filter(Boolean),
    descartadas: entero(valor.descartadas),
  };
}

export async function apiMaterialTerritorialAsignacion(campaignId: string): Promise<AsignacionTerritorial> {
  const qs = new URLSearchParams({ id: campaignId });
  return normalizarAsignacionTerritorial(
    await handle<unknown>(await apiFetch(`/api/recopiladores/campaigns/territorial/asignacion?${qs.toString()}`, { headers: headers() })),
  );
}

export async function apiMaterialTerritorialGuardarAsignacion(
  campaignId: string,
  asignacion: { id_manzana: string; codigo: string }[],
  expectedRevision: number,
): Promise<AsignacionTerritorial> {
  return normalizarAsignacionTerritorial(
    await handle<unknown>(
      await apiFetch("/api/recopiladores/campaigns/territorial/asignacion", {
        method: "PUT",
        headers: headers({ "Content-Type": "application/json" }),
        body: JSON.stringify({ id: campaignId, asignacion, expected_revision: expectedRevision }),
      }),
    ),
  );
}
