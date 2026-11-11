// analitica.ts — analítica (prep, codebook, ponderación, bases).
// Extraído de client.ts (split por dominio, 2026-07). Los consumidores
// importan del barrel ./client; este módulo no cambia el contrato.

import { normalizeRepeatGrain, type RepeatGrain } from "../lib/repeatIdentity";
import { apiFetch, handle, headers } from "./core";
import { camposDeEntregable, type CamposDeEntregable, type JobStart } from "./jobs";
import type { ProcessingSheetPayload, ProcessingSheetRequest } from "./xlsformEditor";

// ---------- Analítica ----------

// Config es opaca a nivel API — el frontend define el schema (store.ts) y
// el backend solo la persiste como kv. `unknown` acá evita duplicar la
// definición; los panes la tipan con `AnaliticaConfig` via import directo.
export async function apiAnaliticaConfigGet() {
  return handle<{ ok: true; config: unknown }>(
    await apiFetch("/api/analitica/config", { headers: headers() })
  );
}

export async function apiAnaliticaConfigPut(config: unknown) {
  return handle<{ ok: true; saved_at: string }>(
    await apiFetch("/api/analitica/config", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ config }),
    })
  );
}

export async function apiAnaliticaConfigExport() {
  return handle<{ ok: true; version: string; exported_at: string; config: unknown }>(
    await apiFetch("/api/analitica/config/export", { headers: headers() })
  );
}

export async function apiAnaliticaConfigImport(bundle: unknown) {
  return handle<{ ok: true; imported_at: string }>(
    await apiFetch("/api/analitica/config/import", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(bundle),
    })
  );
}

export async function apiAnaliticaPreparar() {
  return handle<{ ok: true; fuente: string; n_filas: number; n_columnas: number }>(
    await apiFetch("/api/analitica/preparar", { method: "POST", headers: headers() })
  );
}

export type SeccionDetectada = {
  id: string;
  nombre: string;
  variables: string[];
  oculto: boolean;
  orden: number;
};

export async function apiAnaliticaDetectSecciones() {
  return handle<{ ok: true; secciones: SeccionDetectada[] }>(
    await apiFetch("/api/analitica/detect-secciones", { method: "POST", headers: headers() })
  );
}

export type VariableInstrumento = {
  name: string;
  label: string;
  tipo: string;
  list_name: string;
  categorica?: boolean;
  numerica?: boolean;
  declarada_numerica?: boolean;
  analisis?: boolean;
  /**
   * Auto-detección de ordinalidad de la lista (`list_name`) calculada por el
   * backend. Mismo valor para todas las variables que comparten `list_name`.
   * Es la base de la resolución ordinal EFECTIVA (ver `esListaOrdinalEfectiva`
   * en `ordenCategoriasModel.ts`); el override explícito del analista vive en
   * `config.listas_ordinales`. Ausente = el backend no lo informó (→ false).
   */
  list_ordinal_auto?: boolean;
};

export type AnaliticaVariablesResult = {
  ok: true;
  variables: VariableInstrumento[];
  /**
   * Grano de la base activa (ADR 0030 Fase 3). Solo presente cuando la base
   * activa es una hija repeat; `null` en el resto. Normalizado a la baja para
   * blindar la lógica de identidad visual de payloads R inesperados.
   */
  grain: RepeatGrain | null;
};

export async function apiAnaliticaVariables(): Promise<AnaliticaVariablesResult> {
  const raw = await handle<{ ok: true; variables: VariableInstrumento[]; grain?: unknown }>(
    await apiFetch("/api/analitica/variables", { headers: headers() })
  );
  return {
    ok: true,
    variables: raw.variables ?? [],
    grain: normalizeRepeatGrain(raw.grain),
  };
}

export type DataReviewOption = {
  code: string;
  label: string;
  count: number;
};

export type DataReviewVariable = {
  name: string;
  tipo_xlsform: string;
  seccion: string;
  included: boolean;
  label_actual: string;
  label_original: string;
  n_non_missing: number;
  n_missing: number;
  opciones: DataReviewOption[];
  dummy_parent?: string | null;
  dummy_parent_label?: string | null;
  dummy_option_code?: string | null;
  dummy_option_label?: string | null;
};

export async function apiAnaliticaDataReview() {
  return handle<{ ok: true; variables: DataReviewVariable[] }>(
    await apiFetch("/api/analitica/data-review", { headers: headers() })
  );
}

export async function apiAnaliticaBaseSheet(opts: ProcessingSheetRequest = {}) {
  return handle<ProcessingSheetPayload>(
    await apiFetch("/api/analitica/base-sheet", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(opts),
    }),
  );
}

export type ValorColumna = { value: string; label: string };

export async function apiAnaliticaColumnValues(name: string) {
  return handle<{ ok: true; column: string; n_total: number; truncated: boolean; values: ValorColumna[] }>(
    await apiFetch(`/api/analitica/column-values?name=${encodeURIComponent(name)}`, { headers: headers() })
  );
}

// ---- Ponderación ----------------------------------------------------------
export type PonderMarginCompare = {
  categoria: string;
  objetivo: number;
  muestra: number;
  ponderado: number;
};
export type PonderDiagnostics = {
  n: number;
  n_eff: number;
  deff: number;
  cv: number;
  loss_pct: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  ratio_max_min: number;
};
export type PonderWarning = {
  level: "info" | "warn"; code: string; message: string;
  var?: string; casos?: number; categorias?: string[];
};
/** Deff de Kish, n efectivo y peso mayor / media, antes o después del recorte. */
export type PonderDiagCorto = { deff: number; n_eff: number; max_sobre_media: number };
export type PonderRecorte = {
  cap: number;
  modo: "recalibrar" | "renormalizar";
  ciclos: number;
  convergio: boolean;
  tol_margen: number;
  max_desvio_margen: number;
  antes: PonderDiagCorto;
  despues: PonderDiagCorto;
};
export type PonderImputacion = {
  semilla: number;
  umbral: number;
  metodo: string;
  variables: Record<string, { imputados: number; sin_donante: number; pct: number; colapsados: number }>;
};
export type PonderPreview = {
  ok: boolean;
  reason?: string;
  /** Con `ok: false` por un error declarado (E_*): el mensaje del backend, tal cual. */
  message?: string;
  escala?: "media1" | "expansion";
  total_poblacion?: number | null;
  peso_base?: string | null;
  recorte?: PonderRecorte | null;
  faltantes?: "excluir" | "imputar" | null;
  imputacion?: PonderImputacion | null;
  n?: number;
  enabled?: boolean;
  design_applied?: boolean;
  rake_applied?: boolean;
  converged?: boolean;
  iterations?: number;
  diagnostics?: PonderDiagnostics;
  margins?: Record<string, PonderMarginCompare[]>;
  warnings?: PonderWarning[];
};

/**
 * R serializa `NULL` como `{}`: sin recorte, sin imputación o sin N̂ el preview
 * trae `recorte: {}`, y leer `recorte.antes.n_eff` tumbaba el panel. Un objeto
 * vacío (o sin sus campos) es «no hay».
 */
export function normalizarPonderPreview(raw: PonderPreview): PonderPreview {
  const vacio = (x: unknown) => x == null || (typeof x === "object" && Object.keys(x as object).length === 0);
  const out: PonderPreview = { ...raw };
  const r = raw.recorte as Partial<PonderRecorte> | null | undefined;
  out.recorte = r && r.antes && r.despues && !vacio(r.antes) && !vacio(r.despues) ? (r as PonderRecorte) : null;
  const imp = raw.imputacion as Partial<PonderImputacion> | null | undefined;
  out.imputacion = imp && !vacio(imp) ? { ...(imp as PonderImputacion), variables: vacio(imp.variables) ? {} : imp.variables! } : null;
  const escalar = <T,>(x: T) => (vacio(x) ? null : Array.isArray(x) ? (x[0] as T) : x);
  out.total_poblacion = escalar(raw.total_poblacion) as number | null;
  out.peso_base = escalar(raw.peso_base) as string | null;
  out.faltantes = escalar(raw.faltantes) as PonderPreview["faltantes"];
  out.message = (escalar(raw.message) as string | null) ?? undefined;
  out.margins = vacio(raw.margins) ? {} : raw.margins;
  out.warnings = Array.isArray(raw.warnings) ? raw.warnings : [];
  return out;
}

export async function apiAnaliticaPonderacionPreview(ponderacion: unknown) {
  const raw = await handle<PonderPreview>(
    await apiFetch("/api/analitica/ponderacion/preview", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ ponderacion }),
    }),
  );
  return normalizarPonderPreview(raw);
}

// Respuesta de reporte multi-base (v0.2+):
//   - Single base (n_bases=1): `file_id` directo al archivo.
//   - Multi (n_bases>1): `zip` al zip agregador + `bases[]` con file_id
//     individual de cada archivo para descarga suelta.
// Los campos `file_id` / `size` legacy a nivel top se mantienen vacíos
// en multi — el frontend debe mirar `zip` y `bases`.
export type BasePerOutput = {
  nombre: string;
  file_id?: string;
  filename: string;
  size: number;
  // Para bases/sav con sps: puede no tener file_id si viene del worker
  // de sav (los archivos individuales solo se registran en el zip).
  sav?: string;
  sps?: string | null;
  // Para enumeradores: bases skipped por falta de col_enumerador.
  skipped?: boolean;
  reason?: string;
};

export type MultiBaseResult = {
  ok: true;
  n_bases: number;
  fuente?: string;
  // Single-base
  file_id?: string;
  filename?: string;
  size?: number;
  // Multi-base
  zip?: { file_id: string; filename: string; size: number };
  bases?: BasePerOutput[];
  xlsform?: MultiBaseResult;
  unified?: {
    alias_var: string;
    origin_id_var?: string;
    unique_id_var?: string;
    n_filas: number;
    n_columnas: number;
    n_variables_comunes: number;
    n_variables_no_comunes: number;
  };
};

export async function apiAnaliticaCodebook(opts?: { formato?: "xlsx" | "pdf" }) {
  const formato = opts?.formato ?? "xlsx";
  return handle<MultiBaseResult>(
    await apiFetch("/api/analitica/codebook", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ formato }),
    })
  );
}

export async function apiAnaliticaFrecuencias() {
  return handle<MultiBaseResult>(
    await apiFetch("/api/analitica/frecuencias", { method: "POST", headers: headers() })
  );
}

// ---------- Vista previa de Frecuencias ----------
// POST /api/analitica/frecuencias/preview (api/R/analitica_frecuencias_preview.R):
// las tablas que el archivo escribiría para la base activa con la config
// GUARDADA, calculadas con las mismas funciones que escriben el archivo. El
// frontend las pinta tal cual: no recalcula porcentajes, totales ni filas.

export type FrecuenciasPreviewEntrada = {
  /** Nombres de variable; sin ellos, todas las del archivo en su orden. */
  variables?: string[];
  /** Tope de tablas, de 1 a 500 (el servicio usa 50 por defecto). */
  limite?: number;
};

export type FrecuenciasPreviewFila = {
  /** Código del instrumento; `null` cuando el motor no lo pudo recuperar sin ambigüedad. */
  codigo: string | null;
  etiqueta: string;
  /** Suma de pesos de la fila; sin ponderación es un conteo. */
  n: number;
  /** Proporción de 0 a 1 sobre el total de la tabla, sin redondear. */
  pct: number | null;
  especial: boolean;
};

export type FrecuenciasPreviewDenominador = "respondieron" | "marcaron_alguna_opcion" | "casos_validos";

export type FrecuenciasPreviewTabla = {
  variable: string;
  variable_origen: string | null;
  etiqueta: string;
  tipo: "unica" | "multiple" | "numerica";
  seccion: { nombre: string; rotulo: string | null };
  orden: string | null;
  lista_ordinal: boolean;
  sin_datos: boolean;
  filas: FrecuenciasPreviewFila[];
  total: { n: number | null; pct: number | null };
  /**
   * La base, siempre en casos SIN PONDERAR (contrato v2, regla I1): `n` los que
   * forman el denominador, `de` los casos del universo con peso mayor que cero.
   * Lo ponderado son los porcentajes y los estadísticos.
   */
  base: { n: number | null; de: number | null; denominador: FrecuenciasPreviewDenominador | null };
  resumen: { estadistico: string; valor: number | null }[];
  notas: string[];
};

export type FrecuenciasPreviewSinTabla = {
  variable: string;
  motivo: "excluida" | "fuera_del_archivo" | "desconocida";
};

export type FrecuenciasPreviewAviso = { codigo: string; mensaje: string };

export type FrecuenciasPreview = {
  ok: true;
  base: { nombre: string; bases_del_archivo: string[]; n_bases: number; independientes: boolean };
  /** Valor interno de la fuente ("originales", "adaptados"): se rotula, no se muestra. */
  fuente: string | null;
  ponderado: boolean;
  ponderacion: {
    configurada: boolean;
    estado: string | null;
    modo: string | null;
    peso_columna: string | null;
    motivo: string | null;
    n_efectivo: number | null;
    deff: number | null;
    /** "normalizada", "expansion" o `null` sin ponderación aplicada. */
    escala: "normalizada" | "expansion" | null;
  };
  /** `con_peso`: filas con peso mayor que cero (igual a `base.de`). */
  casos: { cuentan: number | null; suma_pesos: number | null; con_peso: number | null };
  opciones: { orden: string | null; mostrar_todo: boolean; incluir_secciones: boolean; codigos_especiales: string[] };
  limite: number;
  total_variables: number;
  devueltas: number;
  recortado: boolean;
  tablas: FrecuenciasPreviewTabla[];
  sin_tabla: FrecuenciasPreviewSinTabla[];
  avisos: FrecuenciasPreviewAviso[];
};

/** La respuesta de la vista previa no tiene la forma del contrato. */
export class FrecuenciasPreviewInvalida extends Error {
  constructor(campo: string) {
    super(`La vista previa de Frecuencias llegó incompleta: falta o no se entiende "${campo}".`);
    this.name = "FrecuenciasPreviewInvalida";
  }
}

/**
 * Normalizador defensivo de la vista previa (patrón `normalizeGraficosShareInspect`).
 * R puede mandar un escalar como arreglo de un elemento, `null` donde va una
 * lista o una lista vacía como objeto `{}`. Lo opcional cae a su vacío; lo que
 * sostiene una cifra (las tablas, sus filas, el total de variables) falla con
 * un error que nombra el campo en vez de pintar un cero.
 */
export function normalizarFrecuenciasPreview(raw: unknown): FrecuenciasPreview {
  const desenvolver = (v: unknown): unknown => (Array.isArray(v) && v.length === 1 ? v[0] : v);
  const esObjeto = (v: unknown): v is Record<string, unknown> =>
    typeof v === "object" && v !== null && !Array.isArray(v);
  const objeto = (v: unknown): Record<string, unknown> => {
    const u = desenvolver(v);
    return esObjeto(u) ? u : {};
  };
  const lista = (v: unknown): unknown[] => {
    if (v == null) return [];
    if (Array.isArray(v)) return v;
    // `{}` es la lista vacía que serializa R.
    if (esObjeto(v) && Object.keys(v).length === 0) return [];
    return [v];
  };
  const texto = (v: unknown): string | null => {
    const u = desenvolver(v);
    if (typeof u === "string") return u === "NA" ? null : u;
    if (typeof u === "number" && Number.isFinite(u)) return String(u);
    return null;
  };
  const numero = (v: unknown): number | null => {
    const u = desenvolver(v);
    if (typeof u === "number") return Number.isFinite(u) ? u : null;
    if (typeof u === "string" && u.trim() !== "" && u !== "NA") {
      const n = Number(u);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  };
  const logico = (v: unknown): boolean => desenvolver(v) === true;
  const exigido = <T,>(valor: T | null, campo: string): T => {
    if (valor === null) throw new FrecuenciasPreviewInvalida(campo);
    return valor;
  };

  const r = objeto(raw);
  if (!esObjeto(desenvolver(raw))) throw new FrecuenciasPreviewInvalida("respuesta");
  // Los porcentajes se leen como proporción de 0 a 1: otra escala no se adivina.
  if (texto(r.escala_pct) !== "proporcion") throw new FrecuenciasPreviewInvalida("escala_pct");
  const base = objeto(r.base);
  const pond = objeto(r.ponderacion);
  const casos = objeto(r.casos);
  const opciones = objeto(r.opciones);
  const tipos = ["unica", "multiple", "numerica"] as const;
  const denominadores = ["respondieron", "marcaron_alguna_opcion", "casos_validos"] as const;
  const motivos = ["excluida", "fuera_del_archivo", "desconocida"] as const;
  const deLista = <T extends string>(valores: readonly T[], v: string | null): T | null =>
    v !== null && (valores as readonly string[]).includes(v) ? (v as T) : null;

  const tablas = lista(r.tablas).map((item, i): FrecuenciasPreviewTabla => {
    const t = objeto(item);
    const campo = (nombre: string) => `tablas[${i}].${nombre}`;
    const variable = exigido(texto(t.variable), campo("variable"));
    const tipo = exigido(deLista(tipos, texto(t.tipo)), campo("tipo"));
    const seccion = objeto(t.seccion);
    const total = objeto(t.total);
    const baseTabla = objeto(t.base);
    return {
      variable,
      variable_origen: texto(t.variable_origen),
      etiqueta: texto(t.etiqueta) ?? variable,
      tipo,
      seccion: { nombre: texto(seccion.nombre) ?? "", rotulo: texto(seccion.rotulo) },
      orden: texto(t.orden),
      lista_ordinal: logico(t.lista_ordinal),
      sin_datos: logico(t.sin_datos),
      filas: lista(t.filas).map((f, k): FrecuenciasPreviewFila => {
        const fila = objeto(f);
        return {
          codigo: texto(fila.codigo),
          etiqueta: exigido(texto(fila.etiqueta), `${campo("filas")}[${k}].etiqueta`),
          n: exigido(numero(fila.n), `${campo("filas")}[${k}].n`),
          pct: numero(fila.pct),
          especial: logico(fila.especial),
        };
      }),
      total: { n: numero(total.n), pct: numero(total.pct) },
      // `base.ponderado` lo retiró el contrato v2: si llega, se ignora.
      base: {
        n: numero(baseTabla.n),
        de: numero(baseTabla.de),
        denominador: deLista(denominadores, texto(baseTabla.denominador)),
      },
      resumen: lista(t.resumen).map((e, k) => {
        const est = objeto(e);
        return {
          estadistico: exigido(texto(est.estadistico), `${campo("resumen")}[${k}].estadistico`),
          valor: numero(est.valor),
        };
      }),
      notas: lista(t.notas).map((n) => texto(n)).filter((n): n is string => Boolean(n)),
    };
  });

  const sinTabla = lista(r.sin_tabla).flatMap((item): FrecuenciasPreviewSinTabla[] => {
    const s = objeto(item);
    const variable = texto(s.variable);
    const motivo = deLista(motivos, texto(s.motivo)) ?? "desconocida";
    return variable ? [{ variable, motivo }] : [];
  });

  const avisos = lista(r.avisos).flatMap((item): FrecuenciasPreviewAviso[] => {
    const a = objeto(item);
    const mensaje = texto(a.mensaje);
    return mensaje ? [{ codigo: texto(a.codigo) ?? "motor", mensaje }] : [];
  });

  return {
    ok: true,
    base: {
      nombre: texto(base.nombre) ?? "",
      bases_del_archivo: lista(base.bases_del_archivo).map((b) => texto(b)).filter((b): b is string => Boolean(b)),
      n_bases: numero(base.n_bases) ?? 1,
      independientes: logico(base.independientes),
    },
    fuente: texto(r.fuente),
    ponderado: logico(r.ponderado),
    ponderacion: {
      configurada: logico(pond.configurada),
      estado: texto(pond.estado),
      modo: texto(pond.modo),
      peso_columna: texto(pond.peso_columna),
      motivo: texto(pond.motivo),
      n_efectivo: numero(pond.n_efectivo),
      deff: numero(pond.deff),
      escala: deLista(["normalizada", "expansion"] as const, texto(pond.escala)),
    },
    casos: { cuentan: numero(casos.cuentan), suma_pesos: numero(casos.suma_pesos), con_peso: numero(casos.con_peso) },
    opciones: {
      orden: texto(opciones.orden),
      mostrar_todo: logico(opciones.mostrar_todo),
      incluir_secciones: logico(opciones.incluir_secciones),
      codigos_especiales: lista(opciones.codigos_especiales).map((c) => texto(c)).filter((c): c is string => Boolean(c)),
    },
    limite: numero(r.limite) ?? tablas.length,
    total_variables: exigido(numero(r.total_variables), "total_variables"),
    devueltas: numero(r.devueltas) ?? tablas.length,
    recortado: logico(r.recortado),
    tablas,
    sin_tabla: sinTabla,
    avisos,
  };
}

export async function apiAnaliticaFrecuenciasPreview(entrada: FrecuenciasPreviewEntrada = {}) {
  const raw = await handle<unknown>(
    await apiFetch("/api/analitica/frecuencias/preview", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(entrada),
    }),
  );
  return normalizarFrecuenciasPreview(raw);
}

export type AnaliticaMultibaseKey = {
  value: string;
  label: string;
  n: number;
};

export async function apiAnaliticaMultibaseInfo() {
  return handle<{
    ok: true;
    available: boolean;
    reason?: string;
    base_name?: string;
    origin_key_name?: string;
    keys?: AnaliticaMultibaseKey[];
    n_keys?: number;
    has_metadata?: boolean;
  }>(
    await apiFetch("/api/analitica/multibase/info", { headers: headers() })
  );
}

export async function apiAnaliticaMultibaseTablas() {
  return handle<JobStart>(
    await apiFetch("/api/analitica/multibase/tablas", { method: "POST", headers: headers() })
  );
}

export type AnaliticaFichaTecnicaField = {
  key: string;
  label: string;
  group: string;
  hint?: string;
  min_lines?: number;
  value?: string;
  suggested?: string;
  has_suggestion?: boolean;
};

export type AnaliticaFichaTecnicaKpi = {
  label: string;
  value: string;
  source: string;
  detail?: string;
};

export type AnaliticaFichaTecnicaSource = {
  key: string;
  label: string;
  available: boolean;
  detail?: string;
};

export type AnaliticaFichaTecnicaInfo = {
  ok: true;
  fields: AnaliticaFichaTecnicaField[];
  kpis: AnaliticaFichaTecnicaKpi[];
  sources: AnaliticaFichaTecnicaSource[];
  tables?: {
    subtables?: string[];
    appendices?: string[];
  };
  layout?: "pulso_oficial" | "template" | "simple" | string;
};

export async function apiAnaliticaFichaTecnicaInfo() {
  return handle<AnaliticaFichaTecnicaInfo>(
    await apiFetch("/api/analitica/ficha-tecnica/info", { headers: headers() })
  );
}

export async function apiAnaliticaFichaTecnicaExport(ficha_tecnica?: Record<string, unknown>) {
  return handle<MultiBaseResult>(
    await apiFetch("/api/analitica/ficha-tecnica/export", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ ficha_tecnica }),
    })
  );
}

export type AnaliticaPanelWaveConfig = {
  base: string;
  label?: string;
  suffix?: string;
  order?: number;
};

export type AnaliticaPanelConfig = {
  key?: string;
  waves?: AnaliticaPanelWaveConfig[];
  nse?: {
    enabled?: boolean;
    variables?: string[];
  };
  outputs?: {
    codebook?: boolean;
    frecuencias?: boolean;
    cruces?: boolean;
    auditoria?: boolean;
    cobertura_nse?: boolean;
  };
  formatos?: {
    sav?: BasesSavBody;
    csv?: BasesCsvBody;
    xlsx?: BasesXlsxBody;
  };
};

export type AnaliticaPanelCandidate = {
  name: string;
  normalized?: string;
  recommended?: boolean;
  present_bases: number;
  per_base?: Array<{
    base: string;
    present: boolean;
    n: number;
    non_missing: number;
    unique: number;
    duplicates: number;
  }>;
};

export type AnaliticaPanelWaveInfo = {
  base: string;
  label: string;
  suffix: string;
  order: number;
  n_filas: number;
  n_columnas?: number;
  n_llaves: number;
  n_llaves_duplicadas: number;
  n_llaves_vacias: number;
};

export type AnaliticaPanelSummary = {
  ok: boolean;
  available: boolean;
  key: string;
  n_bases: number;
  n_panel_keys: number;
  n_complete_keys: number;
  n_incomplete_keys: number;
  n_duplicate_keys: number;
  n_audit_rows: number;
  nse_detected: boolean;
  waves: AnaliticaPanelWaveInfo[];
};

export type AnaliticaPanelNseCoverage = {
  variable_nse: string;
  casos_con_nse: number;
  casos_sin_data: number;
  casos_vacios: number;
  cobertura: number;
  observacion: string;
};

export type AnaliticaPanelInfo = {
  ok: true;
  available: boolean;
  reason?: string;
  key?: string;
  candidates?: AnaliticaPanelCandidate[];
  waves?: AnaliticaPanelWaveInfo[];
  summary?: AnaliticaPanelSummary;
  n_bases?: number;
  fuente?: string;
};

export async function apiAnaliticaPanelInfo() {
  return handle<AnaliticaPanelInfo>(
    await apiFetch("/api/analitica/panel/info", { headers: headers() })
  );
}

export async function apiAnaliticaPanelPreview(config?: AnaliticaPanelConfig, rows = 25) {
  return handle<{
    ok: true;
    summary: AnaliticaPanelSummary;
    preview: Record<string, unknown>[];
    audit_preview: Record<string, unknown>[];
    cobertura_nse: AnaliticaPanelNseCoverage[];
    columns: string[];
  }>(
    await apiFetch("/api/analitica/panel/preview", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ config, rows }),
    })
  );
}

export type AnaliticaPanelExportOptions = {
  formato?: "paquete" | "xlsx" | "csv" | "sav" | "libro_codigos" | "libro_codigos_pdf" | "frecuencias" | "cruces" | "auditoria";
  valores?: "codigos" | "etiquetas" | "ambos";
  separador?: "," | ";";
  multi_select?: "codigos_crudos" | "etiquetas_unidas" | "dummy_01";
  incluir_sps?: boolean;
};

export async function apiAnaliticaPanelExport(
  config?: AnaliticaPanelConfig,
  options: AnaliticaPanelExportOptions = {},
) {
  return handle<JobStart>(
    await apiFetch("/api/analitica/panel/export", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ config, options }),
    })
  );
}

export async function apiAnaliticaPanelFichaTecnica(config?: AnaliticaPanelConfig) {
  return handle<MultiBaseResult>(
    await apiFetch("/api/analitica/panel/ficha-tecnica", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ config }),
    })
  );
}

// El backend lee `cruces_vars`, modo, show_sig, etc. del config autosaveado.
// `cruces` y `modo` quedan opcionales para backcompat con tests manuales.
export async function apiAnaliticaCruces(cruces?: string, modo?: "estandar" | "dimensiones") {
  return handle<JobStart>(
    await apiFetch("/api/analitica/cruces", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(cruces ? { cruces, modo: modo ?? "estandar" } : {}),
    })
  );
}

// /api/analitica/spss (alias legacy): zip con .sav + niveles_medida.sps. Hoy
// sincrónico, ya no devuelve JobStart. Los panes modernos deben usar los
// endpoints /bases/{sav,csv,xlsx} directos. Se mantiene solo para integraciones
// externas antiguas.
export async function apiAnaliticaSpss() {
  return handle<{ ok: true; file_id: string; size: number }>(
    await apiFetch("/api/analitica/spss", { method: "POST", headers: headers() })
  );
}

// ----- Bases (Analítica · Fase 4) -----
// Los 3 formatos corren sincrónicos (datasets de encuesta son pequeños;
// no merece la pena callr). Cada uno acepta un body JSON con su
// sub-config.

export type BasesSavBody = {
  incluir_sps?: boolean;
  multi_select?: "codigos_crudos" | "etiquetas_unidas" | "dummy_01";
};
export type BasesCsvBody = {
  valores?: "codigos" | "etiquetas";
  separador?: "," | ";";
  multi_select?: "codigos_crudos" | "etiquetas_unidas" | "dummy_01";
};
export type BasesXlsxBody = {
  valores?: "codigos" | "etiquetas" | "ambos";
  multi_select?: "codigos_crudos" | "etiquetas_unidas" | "dummy_01";
  omitir_identificadores_directos?: boolean;
  omitir_metadatos_operativos?: boolean;
  // Cuando es true, por cada select_multiple la base agrega una columna
  // madre legible (respuestas concatenadas) antes de su bloque de dummies.
  // Solo tiene efecto con multi_select = "dummy_01". Default backend: FALSE.
  incluir_madre_sm?: boolean;
};

export async function apiAnaliticaBasesData() {
  return handle<MultiBaseResult>(
    await apiFetch("/api/analitica/bases/data", { method: "POST", headers: headers() })
  );
}

export async function apiAnaliticaBasesInstrumento() {
  return handle<MultiBaseResult>(
    await apiFetch("/api/analitica/bases/instrumento", { method: "POST", headers: headers() })
  );
}

export async function apiAnaliticaBasesSav(body: BasesSavBody = {}) {
  return handle<MultiBaseResult>(
    await apiFetch("/api/analitica/bases/sav", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    })
  );
}

export async function apiAnaliticaBasesCsv(body: BasesCsvBody = {}) {
  return handle<MultiBaseResult>(
    await apiFetch("/api/analitica/bases/csv", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    })
  );
}

export async function apiAnaliticaBasesXlsx(body: BasesXlsxBody = {}) {
  return handle<MultiBaseResult>(
    await apiFetch("/api/analitica/bases/xlsx", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    })
  );
}

export async function apiAnaliticaBasesScriptR() {
  return handle<MultiBaseResult>(
    await apiFetch("/api/analitica/bases/script-r", { method: "POST", headers: headers() })
  );
}

export async function apiAnaliticaBasesXlsxUnificada(body: BasesXlsxBody = {}) {
  return handle<MultiBaseResult>(
    await apiFetch("/api/analitica/bases/xlsx-unificada", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    })
  );
}

// Metadatos SPSS inferidos por variable (para el editor de BasesPane).
// El backend devuelve la inferencia + los overrides ya aplicados en
// session. La UI usa ambos para el display: si hay override lo muestra
// con badge "editado", sino muestra la inferencia.
export type MeasureSpss = "nominal" | "ordinal" | "scale";

export type BasesMetadataVariable = {
  name: string;
  label: string;
  tipo_xlsform: string | null;
  inferred_measure: MeasureSpss;
  inferred_format_spss: string;  // "auto" significa que el escritor SAV lo infiere al exportar
  has_labels: boolean;
};

export type BasesMetadataOverride = {
  measure?: MeasureSpss;
  format_spss?: string;
};

export type BasesSavWriterInfo = {
  engine: "pyreadstat" | "haven";
  ok: boolean;
  python?: string | null;
  fallback?: boolean;
  message?: string;
};

export async function apiAnaliticaBasesMetadata() {
  return handle<{
    ok: true;
    variables: BasesMetadataVariable[];
    overrides: Record<string, BasesMetadataOverride>;
    sav_writer?: BasesSavWriterInfo;
  }>(
    await apiFetch("/api/analitica/bases/metadata", { headers: headers() })
  );
}

// ---- Comparativos armonizados (contrato E4-E7, R4) --------------------------
//
// La serie de mediciones armonizada en Carga › Equivalencias se tabula como un
// comparativo simple (frecuencias por período) o de cruces. Los dos endpoints
// devuelven un job: el resultado trae el XLSX, su manifest y un resumen que la
// pestaña Comparativos muestra tal cual (avisos y casos sin mapa por pregunta).

export type ComparativoTipo = "frecuencias" | "cruces";

/** Índice 0-based de la fila en la matriz, su id o su etiqueta estándar. */
export type ComparativoRefFila = number | string;

export type ComparativoBody = {
  filas?: ComparativoRefFila[];
  cruces?: ComparativoRefFila[];
  rotulos_periodos?: Record<string, string>;
  notas_pregunta?: Record<string, string>;
  notas_generales?: string[];
};

export type ComparativoPeriodo = { base: string; rotulo: string };

export type ComparativoInicio = JobStart & { periodos: ComparativoPeriodo[] };

export type ComparativoArtefacto = {
  file_id: string;
  filename: string;
  role: "deliverable" | "manifest" | "otro";
  size: number;
  sha256: string;
  mime: string;
};

export type ComparativoSinMapa = {
  base: string;
  n_sin_mapa: number;
  n_especial_sin_mapa: number;
  codigos_sin_mapa: string[];
  /** Códigos especiales (80-99) sin destino en la escala y sus etiquetas, en el mismo orden. */
  codigos_especiales: string[];
  etiquetas_especiales: string[];
};

/** Una casilla «n.a.»: el período y, en el de cruces, la categoría de cruce sin casos. */
export type ComparativoNa = { periodo: string; cruce?: string; categoria?: string };

export type ComparativoPregunta = {
  titulo: string;
  /**
   * Dónde la pregunta no es comparable. En el simple son nombres de base; en el
   * de cruces, las frases del pie («Sexo no es comparable en 2024»).
   */
  n_c: string[];
  /** Casillas sin casos. En el simple sólo traen el período. */
  n_a: ComparativoNa[];
  /** Columnas de cruce con base reducida (sólo el de cruces). */
  n_reducidas: number | null;
  sin_mapa: ComparativoSinMapa[];
  /** `base -> códigos de la escala que esa medición no ofrecía`. */
  no_ofrecidas: Record<string, string[]>;
  /**
   * `cruce -> base -> códigos` de las variables de cruce. `null` cuando el
   * backend no lo reporta: entonces no se puede afirmar que no haya.
   */
  no_ofrecidas_cruce: Record<string, Record<string, string[]>> | null;
  /**
   * Mediciones donde la pregunta no tiene variable (sale «n.c.»). En el simple
   * el backend manda bases; en el de cruces, `{base, fila}` donde `fila` es la
   * variable de cruce que falta.
   */
  sin_variable: { base: string; fila?: string }[];
  /**
   * Mediciones donde la variable declarada no está en los datos: `excluida`
   * en Analítica o `no_esta_en_la_base`. También sale «n.c.».
   */
  variable_ausente: ComparativoAusente[];
};

export type ComparativoAusente = { base: string; fila?: string; variable: string; motivo: string };

export type ComparativoAvisoTipo =
  | "ponderacion"
  | "suma_pesos"
  | "sin_mapa"
  | "nota_sin_pregunta"
  | "peso_ignorado"
  | "sin_variable"
  | "pregunta_omitida"
  | "cruce_omitido"
  | "variable_ausente"
  | "otro";

export type ComparativoAviso = {
  tipo: ComparativoAvisoTipo;
  tipoOriginal: string;
  base?: string;
  fila?: string;
  /** Sólo en `pregunta_omitida`: por qué quedó fuera (`sin_variable`, `mapa_roto`, `select_multiple`…). */
  motivo?: string;
  /** Códigos implicados, cuando el motor los nombra. */
  codigos?: string[];
  /** Sólo en `variable_ausente`: la variable que falta. */
  variable?: string;
  mensaje: string;
};

/**
 * Una fila que el motor dejó fuera del libro, y por qué. `tipo` dice si era una
 * pregunta o una variable de cruce. `motivo` es la clave del motor
 * (`mapa_roto`, `select_multiple`, `sin_variable`…); una que el cliente no
 * conoce se conserva tal cual.
 */
export type ComparativoOmitida = {
  fila: string;
  titulo: string;
  tipo: "pregunta" | "cruce";
  motivo: string;
  base: string;
  codigos: string[];
  detalle: string;
  /** Con motivo `variable_ausente`: qué variable falta en qué base y por qué. */
  ausentes: ComparativoAusente[];
};

/** Resultado del job de un comparativo. Lleva además el meta del registro de entregables (ADR 0133 §1) cuando el
 *  motor lo informa (`guardado_en`, `rotulo`…), para que el kit no lo descargue si ya quedó junto al proyecto. */
export type ComparativoResultado = CamposDeEntregable & {
  file_id: string;
  filename: string;
  size: number;
  sha256: string;
  artifacts: ComparativoArtefacto[];
  periodos: ComparativoPeriodo[];
  resumen: {
    hoja: string;
    n_preguntas: number;
    preguntas: ComparativoPregunta[];
    avisos: ComparativoAviso[];
    /** Lo que quedó fuera del libro. Vacío si no se omitió nada. */
    omitidas: ComparativoOmitida[];
    /** Estado de la ponderación por medición. Sólo se lee `peso_ignorado`. */
    ponderacion: Record<string, { peso_ignorado: boolean }>;
  };
};

function cmpObjeto(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function cmpTexto(x: unknown): string {
  if (Array.isArray(x)) return x.length ? cmpTexto(x[0]) : "";
  if (typeof x === "string") return x;
  if (typeof x === "number" && Number.isFinite(x)) return String(x);
  return "";
}

function cmpNumero(x: unknown): number {
  const v = Array.isArray(x) ? x[0] : x;
  const n = typeof v === "number" ? v : Number(cmpTexto(v));
  return Number.isFinite(n) ? n : 0;
}

/** R manda una lista vacía como `{}` y un vector de uno como escalar. */
function cmpLista(x: unknown): unknown[] {
  if (Array.isArray(x)) return x;
  if (x === null || x === undefined || cmpObjeto(x)) return [];
  return [x];
}

function cmpTextos(x: unknown): string[] {
  return cmpLista(x).map(cmpTexto).map((t) => t.trim()).filter(Boolean);
}

function cmpAusentes(x: unknown): ComparativoAusente[] {
  return cmpLista(x).flatMap((a): ComparativoAusente[] => {
    if (!cmpObjeto(a)) return [];
    const base = cmpTexto(a.base).trim();
    const variable = cmpTexto(a.variable).trim();
    if (!base && !variable) return [];
    const fila = cmpTexto(a.fila).trim();
    return [{ base, variable, motivo: cmpTexto(a.motivo).trim(), ...(fila ? { fila } : {}) }];
  });
}

function cmpPeriodos(x: unknown): ComparativoPeriodo[] {
  return cmpLista(x).flatMap((p) => {
    if (!cmpObjeto(p)) return [];
    const base = cmpTexto(p.base).trim();
    if (!base) return [];
    return [{ base, rotulo: cmpTexto(p.rotulo).trim() || base }];
  });
}

const AVISO_TIPOS: readonly ComparativoAvisoTipo[] = [
  "ponderacion",
  "suma_pesos",
  "sin_mapa",
  "nota_sin_pregunta",
  "peso_ignorado",
  "sin_variable",
  "pregunta_omitida",
  "cruce_omitido",
  "variable_ausente",
];

export function normalizarComparativoResultado(raw: unknown): ComparativoResultado {
  const r = cmpObjeto(raw) ? raw : {};
  const artifacts = cmpLista(r.artifacts).flatMap((a): ComparativoArtefacto[] => {
    if (!cmpObjeto(a)) return [];
    const file_id = cmpTexto(a.file_id).trim();
    if (!file_id) return [];
    const role = cmpTexto(a.role);
    return [{
      file_id,
      filename: cmpTexto(a.filename) || file_id,
      role: role === "deliverable" || role === "manifest" ? role : "otro",
      size: cmpNumero(a.size),
      sha256: cmpTexto(a.sha256),
      mime: cmpTexto(a.mime),
    }];
  });
  const resumen = cmpObjeto(r.resumen) ? r.resumen : {};
  const preguntas = cmpLista(resumen.preguntas).flatMap((p): ComparativoPregunta[] => {
    if (!cmpObjeto(p)) return [];
    const sin_mapa = cmpLista(p.sin_mapa).flatMap((s): ComparativoSinMapa[] => {
      if (!cmpObjeto(s)) return [];
      const base = cmpTexto(s.base).trim();
      if (!base) return [];
      return [{
        base,
        n_sin_mapa: cmpNumero(s.n_sin_mapa),
        n_especial_sin_mapa: cmpNumero(s.n_especial_sin_mapa),
        codigos_sin_mapa: cmpTextos(s.codigos_sin_mapa),
        codigos_especiales: cmpTextos(s.codigos_especiales),
        etiquetas_especiales: cmpLista(s.etiquetas_especiales).map((e) => cmpTexto(e).trim()),
      }];
    });
    const no_ofrecidas: Record<string, string[]> = {};
    if (cmpObjeto(p.no_ofrecidas)) {
      for (const [base, cods] of Object.entries(p.no_ofrecidas)) {
        const lista = cmpTextos(cods);
        if (base && lista.length) no_ofrecidas[base] = lista;
      }
    }
    const n_a = cmpLista(p.n_a).flatMap((item): ComparativoNa[] => {
      if (cmpObjeto(item)) {
        const periodo = cmpTexto(item.periodo).trim();
        if (!periodo) return [];
        const cruce = cmpTexto(item.cruce).trim();
        const categoria = cmpTexto(item.categoria).trim();
        return [{ periodo, ...(cruce ? { cruce } : {}), ...(categoria ? { categoria } : {}) }];
      }
      const periodo = cmpTexto(item).trim();
      return periodo ? [{ periodo }] : [];
    });
    let no_ofrecidas_cruce: Record<string, Record<string, string[]>> | null = null;
    if (p.no_ofrecidas_cruce !== undefined && p.no_ofrecidas_cruce !== null) {
      no_ofrecidas_cruce = {};
      if (cmpObjeto(p.no_ofrecidas_cruce)) {
        for (const [cruce, porBase] of Object.entries(p.no_ofrecidas_cruce)) {
          if (!cruce || !cmpObjeto(porBase)) continue;
          const bases: Record<string, string[]> = {};
          for (const [base, cods] of Object.entries(porBase)) {
            const lista = cmpTextos(cods);
            if (base && lista.length) bases[base] = lista;
          }
          if (Object.keys(bases).length) no_ofrecidas_cruce[cruce] = bases;
        }
      }
    }
    const sin_variable = cmpLista(p.sin_variable).flatMap((item): { base: string; fila?: string }[] => {
      if (cmpObjeto(item)) {
        const base = cmpTexto(item.base).trim();
        const fila = cmpTexto(item.fila).trim();
        return base ? [{ base, ...(fila ? { fila } : {}) }] : [];
      }
      const base = cmpTexto(item).trim();
      return base ? [{ base }] : [];
    });
    return [{
      titulo: cmpTexto(p.titulo).trim() || "Pregunta sin título",
      no_ofrecidas_cruce,
      sin_variable,
      variable_ausente: cmpAusentes(p.variable_ausente),
      n_c: cmpTextos(p.n_c),
      n_a,
      n_reducidas: p.n_reducidas === undefined || p.n_reducidas === null ? null : cmpNumero(p.n_reducidas),
      sin_mapa,
      no_ofrecidas,
    }];
  });
  const avisos = cmpLista(resumen.avisos).flatMap((a): ComparativoAviso[] => {
    if (!cmpObjeto(a)) return [];
    const mensaje = cmpTexto(a.mensaje).trim();
    if (!mensaje) return [];
    const tipoOriginal = cmpTexto(a.tipo).trim();
    const tipo = (AVISO_TIPOS as readonly string[]).includes(tipoOriginal)
      ? tipoOriginal as ComparativoAvisoTipo
      : "otro";
    const base = cmpTexto(a.base).trim();
    const fila = cmpTexto(a.fila).trim();
    const motivo = cmpTexto(a.motivo).trim();
    const codigos = cmpTextos(a.codigos);
    const variable = cmpTexto(a.variable).trim();
    return [{
      tipo,
      tipoOriginal,
      mensaje,
      ...(base ? { base } : {}),
      ...(fila ? { fila } : {}),
      ...(motivo ? { motivo } : {}),
      ...(codigos.length ? { codigos } : {}),
      ...(variable ? { variable } : {}),
    }];
  });
  const omitidas = cmpLista(resumen.omitidas).flatMap((o): ComparativoOmitida[] => {
    if (!cmpObjeto(o)) return [];
    const fila = cmpTexto(o.fila).trim();
    const titulo = cmpTexto(o.titulo).trim();
    if (!fila && !titulo) return [];
    return [{
      fila,
      titulo: titulo || fila,
      tipo: cmpTexto(o.tipo).trim() === "cruce" ? "cruce" : "pregunta",
      motivo: cmpTexto(o.motivo).trim(),
      base: cmpTexto(o.base).trim(),
      codigos: cmpTextos(o.codigos),
      detalle: cmpTexto(o.detalle).trim(),
      ausentes: cmpAusentes(o.ausentes),
    }];
  });
  const ponderacion: Record<string, { peso_ignorado: boolean }> = {};
  if (cmpObjeto(resumen.ponderacion)) {
    for (const [base, estado] of Object.entries(resumen.ponderacion)) {
      if (!base || !cmpObjeto(estado)) continue;
      const crudo = Array.isArray(estado.peso_ignorado) ? estado.peso_ignorado[0] : estado.peso_ignorado;
      ponderacion[base] = { peso_ignorado: crudo === true };
    }
  }
  const principal = artifacts.find((a) => a.role === "deliverable");
  return {
    ...camposDeEntregable(r),
    file_id: cmpTexto(r.file_id).trim() || principal?.file_id || "",
    filename: cmpTexto(r.filename).trim() || principal?.filename || "comparativo.xlsx",
    size: cmpNumero(r.size),
    sha256: cmpTexto(r.sha256),
    artifacts,
    periodos: cmpPeriodos(r.periodos),
    resumen: {
      hoja: cmpTexto(resumen.hoja),
      n_preguntas: cmpNumero(resumen.n_preguntas) || preguntas.length,
      preguntas,
      avisos,
      omitidas,
      ponderacion,
    },
  };
}

async function iniciarComparativo(tipo: ComparativoTipo, body: ComparativoBody): Promise<ComparativoInicio> {
  const out = await handle<Record<string, unknown>>(
    await apiFetch(`/api/analitica/armonizada/${tipo}`, {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    }),
  );
  return {
    ok: true,
    job_id: cmpTexto(out.job_id),
    kind: cmpTexto(out.kind),
    periodos: cmpPeriodos(out.periodos),
  };
}

export async function apiAnaliticaComparativoFrecuencias(body: ComparativoBody = {}) {
  return iniciarComparativo("frecuencias", body);
}

export async function apiAnaliticaComparativoCruces(body: ComparativoBody) {
  return iniciarComparativo("cruces", body);
}

/** Código que parece especial en las listas de respuestas del estudio (sugerencia, no regla). */
export type UsoCodigoEnBase = { base: string; n_preguntas: number; n_con_casos: number | null };
export type CodigoEspecialSugerido = {
  codigo: string;
  etiqueta: string;
  etiquetas: string[];
  n_listas: number;
  /** En cuántas preguntas de cada base se ofrece y en cuántas alguien lo eligió (sin data, `null`). */
  por_base?: UsoCodigoEnBase[];
};

export async function apiAnaliticaCodigosEspeciales(): Promise<CodigoEspecialSugerido[]> {
  const raw = await handle<{ ok: true; codigos?: unknown }>(
    await apiFetch("/api/analitica/codigos-especiales", { headers: headers() })
  );
  const lista = Array.isArray(raw.codigos) ? raw.codigos : [];
  return lista
    .map((c) => (c && typeof c === "object" ? (c as Record<string, unknown>) : {}))
    .map((c) => ({
      codigo: String(c.codigo ?? "").trim(),
      etiqueta: String(c.etiqueta ?? "").trim(),
      etiquetas: Array.isArray(c.etiquetas) ? c.etiquetas.map((e) => String(e)) : [],
      n_listas: Number(c.n_listas ?? 0) || 0,
      por_base: Array.isArray(c.por_base)
        ? c.por_base.map((u) => {
          const r = (u && typeof u === "object" ? u : {}) as Record<string, unknown>;
          const n = Number(r.n_con_casos);
          return { base: String(r.base ?? ""), n_preguntas: Number(r.n_preguntas ?? 0) || 0, n_con_casos: Number.isFinite(n) ? n : null };
        }).filter((u) => u.base)
        : undefined,
    }))
    .filter((c) => c.codigo !== "");
}

/** Cuántos casos cuentan en una base según «Qué caso cuenta» (Validación). */
export type UniversoDeBase = {
  base: string;
  declarado: boolean;
  aplicado: boolean;
  n_total: number;
  n_validos: number;
  motivo_no_aplicado: string;
  condiciones: { variable: string; operador: "==" | "!=" | "in" | "not_in"; valores: string[] }[];
};

function unoDe(x: unknown): unknown {
  return Array.isArray(x) ? x[0] : x;
}

export async function apiAnaliticaUniverso(): Promise<UniversoDeBase[]> {
  const raw = await handle<{ ok: true; bases?: unknown }>(
    await apiFetch("/api/analitica/universo", { headers: headers() }),
  );
  const bases = Array.isArray(raw.bases) ? raw.bases : [];
  return bases.map((b: Record<string, unknown>) => {
    const conds = Array.isArray(b.condiciones) ? b.condiciones : [];
    return {
      base: String(unoDe(b.base) ?? ""),
      declarado: unoDe(b.declarado) === true,
      aplicado: unoDe(b.aplicado) === true,
      n_total: Number(unoDe(b.n_total) ?? 0) || 0,
      n_validos: Number(unoDe(b.n_validos) ?? 0) || 0,
      motivo_no_aplicado: String(unoDe(b.motivo_no_aplicado) ?? ""),
      condiciones: conds.map((c: Record<string, unknown>) => {
        const o = String(unoDe(c.operador) ?? "==");
        return {
          variable: String(unoDe(c.variable) ?? ""),
          operador: (["==", "!=", "in", "not_in"].includes(o) ? o : "==") as "==" | "!=" | "in" | "not_in",
          valores: Array.isArray(c.valores) ? c.valores.map(String) : c.valores == null ? [] : [String(c.valores)],
        };
      }),
    };
  });
}
