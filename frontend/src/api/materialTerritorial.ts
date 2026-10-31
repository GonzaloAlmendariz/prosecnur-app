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
  /** C7: lo declarado en el Excel leído; sin él, el backend conserva lo que había. */
  estados?: EstadoDeclarado[],
): Promise<AsignacionTerritorial> {
  return normalizarAsignacionTerritorial(
    await handle<unknown>(
      await apiFetch("/api/recopiladores/campaigns/territorial/asignacion", {
        method: "PUT",
        headers: headers({ "Content-Type": "application/json" }),
        body: JSON.stringify({ id: campaignId, asignacion, expected_revision: expectedRevision, ...(estados ? { estados } : {}) }),
      }),
    ),
  );
}

// ---- el Excel con el que campo asigna (checklist-formatos-campo C1/C3) ------------
//
//   POST campaigns/territorial/asignacion/excel     {id}  → {file_id, filename, umps}
//   POST campaigns/territorial/asignacion/importar  multipart {file, id}: lectura pura;
//        devuelve la propuesta UMP → código y las filas que no se pudieron leer. Se
//        guarda con apiMaterialTerritorialGuardarAsignacion.

export type ExcelAsignacion = { file_id: string; filename: string; umps: number };

export type ProblemaDeFila = { fila: number; id_manzana: string; valor: string; motivo: string };

/** C7: Estado y fechas que campo declara por UMP (no es avance: el avance sale de Kobo). */
export type EstadoDeclarado = {
  id_manzana: string;
  estado_declarado: string;
  fecha_salida: string;
  fecha_entrega: string;
  /** P2: totales de la hoja de consolidados transcritos por campo, por código de resultado. */
  conteos: Record<string, number>;
};

export type ImportacionAsignacion = {
  propuesta: { id_manzana: string; codigo: string }[];
  estados: EstadoDeclarado[];
  /** UMP con un Estado distinto de «Pendiente». */
  estados_declarados: number;
  /** UMP con conteos por código transcritos (P2). */
  conteos_declarados: number;
  problemas: ProblemaDeFila[];
  titulares: number;
  titulares_con_encuestador: number;
  filas_sin_encuestador: number;
  /** UMP que hoy tienen encuestador y lo perderían al aplicar (aplicar reemplaza todo). */
  pierden_encuestador: number;
  por_encuestador: { codigo: string; nombre: string; umps: number }[];
  /** El archivo se generó con otra muestra enviada. */
  otra_muestra: boolean;
  nota: string;
};

export function normalizarImportacionAsignacion(valor: unknown): ImportacionAsignacion {
  if (!esRegistro(valor)) throw new Error("El backend devolvió una lectura del Excel inválida.");
  const resumen = esRegistro(valor.resumen) ? valor.resumen : {};
  const propuesta = lista(valor.propuesta)
    .filter(esRegistro)
    .map((p) => ({ id_manzana: texto(p.id_manzana), codigo: texto(p.codigo) }))
    .filter((p) => p.id_manzana && p.codigo);
  const problemas = lista(valor.problemas)
    .filter(esRegistro)
    .map((p) => ({ fila: entero(p.fila), id_manzana: texto(p.id_manzana), valor: texto(p.valor), motivo: texto(p.motivo) }));
  const por_encuestador = lista(valor.por_encuestador)
    .filter(esRegistro)
    .map((p) => ({ codigo: texto(p.codigo), nombre: texto(p.nombre), umps: entero(p.umps) }))
    .filter((p) => p.codigo);
  const estados = lista(valor.estados)
    .filter(esRegistro)
    .map((e) => ({
      id_manzana: texto(e.id_manzana),
      estado_declarado: texto(e.estado_declarado),
      fecha_salida: texto(e.fecha_salida),
      fecha_entrega: texto(e.fecha_entrega),
      conteos: esRegistro(e.conteos)
        ? Object.fromEntries(Object.entries(e.conteos).flatMap(([k, v]) => { const n = enteroONulo(v); return n === null || n < 0 ? [] : [[k, n]]; }))
        : {},
    }))
    .filter((e) => e.id_manzana);
  return {
    propuesta,
    estados,
    estados_declarados: entero(resumen.estados_declarados),
    conteos_declarados: entero(resumen.conteos_declarados),
    problemas,
    titulares: entero(resumen.titulares),
    titulares_con_encuestador: entero(resumen.titulares_con_encuestador),
    filas_sin_encuestador: entero(resumen.filas_sin_encuestador),
    pierden_encuestador: entero(resumen.pierden_encuestador),
    por_encuestador,
    otra_muestra: logico(valor.otra_muestra),
    nota: texto(valor.nota),
  };
}

export async function apiMaterialTerritorialExcelAsignacion(campaignId: string): Promise<ExcelAsignacion> {
  const r = await handle<unknown>(
    await apiFetch("/api/recopiladores/campaigns/territorial/asignacion/excel", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ id: campaignId }),
    }),
  );
  const o = esRegistro(r) ? r : {};
  const file_id = texto(o.file_id);
  if (!file_id) throw new Error("El backend no devolvió el Excel de asignación.");
  return { file_id, filename: texto(o.filename), umps: entero(o.umps) };
}

export async function apiMaterialTerritorialImportarAsignacion(campaignId: string, archivo: File): Promise<ImportacionAsignacion> {
  const fd = new FormData();
  fd.append("file", archivo, archivo.name);
  fd.append("id", campaignId);
  return normalizarImportacionAsignacion(
    await handle<unknown>(
      await apiFetch("/api/recopiladores/campaigns/territorial/asignacion/importar", { method: "POST", headers: headers(), body: fd }),
    ),
  );
}

// ---- códigos de resultado y hojas de campo (D1) ----------------------------------
//
//   GET/PUT campaigns/territorial/formatos   núcleo fijo 1/4/6/7/8, rótulos editables
//       2/3/5/99, uso del 99, columna del criterio y caras de la hoja de ruteo.
//   POST campaigns/territorial/papel         {id, pieza, unidad?, alcance} → PDF.

export type GrupoDeCodigo = "no_aplicada" | "efectiva" | "manzana";

export type CodigoDeResultado = { codigo: string; rotulo: string; grupo: GrupoDeCodigo; editable: boolean };

export type FormatosTerritoriales = {
  codigos: CodigoDeResultado[];
  editables: string[];
  /** Los rótulos de 2, 3, 5 y 99, también el del 99 cuando no se usa. */
  rotulos: Record<string, string>;
  con_99: boolean;
  columna_criterio: string;
  caras_ruteo: 1 | 2;
  revision: number;
};

export type CambioDeFormatos = Partial<{
  rotulos: Record<string, string>;
  con_99: boolean;
  columna_criterio: string;
  caras_ruteo: 1 | 2;
}>;

const GRUPOS: readonly GrupoDeCodigo[] = ["no_aplicada", "efectiva", "manzana"];

export function normalizarFormatosTerritoriales(valor: unknown): FormatosTerritoriales {
  const o = esRegistro(valor) ? valor : {};
  const codigos = lista(o.codigos).flatMap((c): CodigoDeResultado[] => {
    if (!esRegistro(c)) return [];
    const codigo = texto(c.codigo);
    const grupo = texto(c.grupo) as GrupoDeCodigo;
    return codigo ? [{ codigo, rotulo: texto(c.rotulo), grupo: GRUPOS.includes(grupo) ? grupo : "no_aplicada", editable: logico(c.editable) }] : [];
  });
  return {
    codigos,
    editables: lista(o.editables).map(texto).filter(Boolean),
    rotulos: esRegistro(o.rotulos) ? Object.fromEntries(Object.entries(o.rotulos).map(([k, v]) => [k, texto(v)])) : {},
    con_99: logico(o.con_99),
    columna_criterio: texto(o.columna_criterio),
    caras_ruteo: enteroONulo(o.caras_ruteo) === 1 ? 1 : 2,
    revision: entero(o.revision),
  };
}

export async function apiMaterialTerritorialFormatos(campaignId: string): Promise<FormatosTerritoriales> {
  const qs = new URLSearchParams({ id: campaignId });
  return normalizarFormatosTerritoriales(
    await handle<unknown>(await apiFetch(`/api/recopiladores/campaigns/territorial/formatos?${qs.toString()}`, { headers: headers() })),
  );
}

export async function apiMaterialTerritorialGuardarFormatos(
  campaignId: string,
  cambio: CambioDeFormatos,
  expectedRevision: number,
): Promise<FormatosTerritoriales> {
  return normalizarFormatosTerritoriales(
    await handle<unknown>(
      await apiFetch("/api/recopiladores/campaigns/territorial/formatos", {
        method: "PUT",
        headers: headers({ "Content-Type": "application/json" }),
        body: JSON.stringify({ id: campaignId, ...cambio, expected_revision: expectedRevision }),
      }),
    ),
  );
}

export type PiezaDePapel = "ruteo" | "consolidados";

export type HojaDePapel = { file_id: string; filename: string; umps: number; paginas: number };

export async function apiMaterialTerritorialPapel(
  campaignId: string,
  pieza: PiezaDePapel,
  opciones: { unidad?: string; alcance?: "titulares" | "todas" } = {},
): Promise<HojaDePapel> {
  const r = await handle<unknown>(
    await apiFetch("/api/recopiladores/campaigns/territorial/papel", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ id: campaignId, pieza, ...opciones }),
    }),
  );
  const o = esRegistro(r) ? r : {};
  const file_id = texto(o.file_id);
  if (!file_id) throw new Error("El backend no devolvió la hoja.");
  return { file_id, filename: texto(o.filename), umps: entero(o.umps), paginas: entero(o.paginas) };
}
