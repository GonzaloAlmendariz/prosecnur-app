// analitica.ts — analítica (prep, codebook, ponderación, bases).
// Extraído de client.ts (split por dominio, 2026-07). Los consumidores
// importan del barrel ./client; este módulo no cambia el contrato.

import { normalizeRepeatGrain, type RepeatGrain } from "../lib/repeatIdentity";
import { apiFetch, handle, headers } from "./core";
import type { JobStart } from "./jobs";
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
export type PonderWarning = { level: "info" | "warn"; code: string; message: string };
export type PonderPreview = {
  ok: boolean;
  reason?: string;
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

export async function apiAnaliticaPonderacionPreview(ponderacion: unknown) {
  return handle<PonderPreview>(
    await apiFetch("/api/analitica/ponderacion/preview", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ ponderacion }),
    }),
  );
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
};

export type ComparativoAvisoTipo =
  | "ponderacion"
  | "suma_pesos"
  | "sin_mapa"
  | "nota_sin_pregunta"
  | "peso_ignorado"
  | "otro";

export type ComparativoAviso = {
  tipo: ComparativoAvisoTipo;
  tipoOriginal: string;
  base?: string;
  fila?: string;
  mensaje: string;
};

export type ComparativoResultado = {
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
    return [{
      titulo: cmpTexto(p.titulo).trim() || "Pregunta sin título",
      no_ofrecidas_cruce,
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
    return [{ tipo, tipoOriginal, mensaje, ...(base ? { base } : {}), ...(fila ? { fila } : {}) }];
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
