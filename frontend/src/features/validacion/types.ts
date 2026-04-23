// =============================================================================
// Tipos compartidos de Fase 2 — Validación v2
// =============================================================================
// Contratos estables entre backend (R) y frontend (React). El backend arma
// `ViewDescriptor` JSON que el frontend renderiza con react-plotly.js.
// `ReglaCustom` es el formato persistido de reglas definidas desde la UI
// (se compila a una fila del plan al ejecutar).

/**
 * Tipo de visualización que el frontend sabe renderizar. Se mapea a una
 * configuración plotly concreta dentro de `plotly.data/layout` que el
 * backend ya deja lista.
 */
export type ViewKind =
  | "bar_stack"
  | "bar_h"
  | "half_donut"
  | "heatmap_semaforo"
  | "radar"
  | "chip_bars"
  | "kpi_card"
  | "scatterpolar"
  | "histogram"
  | "boxplot"
  | "table";

/**
 * Acción que el usuario puede disparar desde un chart (click en barra,
 * botón al pie, etc.). Las acciones pueden saltar a otra pestaña y
 * prefillear el store de esa pestaña con `payload`.
 */
export type ViewAction = {
  id: string;
  label: string;
  payload?: Record<string, unknown>;
  target_tab?: ValidacionTabId;
};

/**
 * Metadata útil para el header del chart (N válidos, N total, tipo de
 * variable detectado, empty_hint, etc.) — lo usa el wrapper `PlotlyView`
 * sin tocar el contenido del gráfico.
 */
export type ViewMeta = {
  var?: string;
  var_x?: string;
  var_y?: string;
  tipo?: "so" | "sm" | "num" | "fecha" | "texto" | "mixto";
  n_total?: number;
  n_validos?: number;
  eyebrow?: string;
  note?: string;
  severidad?: "neutral" | "success" | "warn" | "danger";
  n_secciones?: number;
  n_tipos?: number;
  total_con_casos?: number;
  empty_hint?: string;
  [k: string]: unknown;
};

/**
 * Descriptor único que viaja por la red. El backend produce, el frontend
 * renderiza. `plotly.data/layout` ya viene con todo lo necesario para
 * `<Plot data={...} layout={...} />` de react-plotly.js.
 */
export type ViewDescriptor = {
  version: 1;
  kind: ViewKind;
  title: string;
  subtitle?: string;
  meta?: ViewMeta;
  plotly: {
    data: unknown[]; // plotly traces (sin tipo estricto — opaque al front)
    layout: Record<string, unknown>;
    config?: Record<string, unknown>;
  };
  actions?: ViewAction[];
};

// -----------------------------------------------------------------------------
// Reglas custom
// -----------------------------------------------------------------------------
export type ReglaCustomTipo =
  | "no_nulo"
  | "rango_num"
  | "rango_fecha"
  | "outliers_iqr"
  | "outliers_z"
  | "duplicados"
  | "coherencia_2v"
  | "fuera_catalogo";

export type ReglaCustomSeveridad = "error" | "advertencia" | "info";

export type ReglaCustom = {
  id: string; // "RC_001"
  created_at: string; // ISO8601
  activa: boolean;
  nombre: string;
  tipo: ReglaCustomTipo;
  variables: string[]; // 1+ nombres de variables afectadas
  params: Record<string, unknown>;
  mensaje: string;
  severidad: ReglaCustomSeveridad;
};

// -----------------------------------------------------------------------------
// Limpieza y normalización (tab de cierre)
// -----------------------------------------------------------------------------
export type LimpiezaProgreso = {
  plan_construido: boolean;
  auditoria_corrida: boolean;
  n_reglas_custom: number;
};

export type LimpiezaDecisionActionType =
  | "ignore_rule"
  | "exclude_cases"
  | "replace_value"
  | "normalize_value"
  | "impute_value";

export type LimpiezaDecisionScope =
  | "rule"
  | "case_subset"
  | "variable"
  | "cell_subset";

export type LimpiezaDecision = {
  id: string;
  source_type: "instrument_rule" | "custom_rule";
  source_id: string;
  scope: LimpiezaDecisionScope;
  target_case_ids: string[];
  target_variable: string | null;
  action_type: LimpiezaDecisionActionType;
  action_params: Record<string, unknown>;
  rationale: string;
  status: "draft" | "ready";
  created_at: string;
  updated_at: string;
};

export type LimpiezaQueueItem = {
  source_type: "instrument_rule" | "custom_rule";
  source_id: string;
  origen: string;
  nombre_regla: string;
  seccion: string | null;
  categoria: string | null;
  tipo_observacion: string | null;
  severidad: string;
  variables: string[];
  n_casos: number;
  porcentaje: number | null;
  decision_count: number;
  current_action: string | null;
  pending: boolean;
  impact_expected: string;
};

export type LimpiezaDecisionSummary = {
  total_reglas_con_casos: number;
  total_reglas_automaticas: number;
  total_reglas_custom: number;
  total_casos_afectados: number;
  total_decisiones: number;
  decisiones_listas: number;
  pendientes: number;
  total_casos_excluidos: number;
  total_reemplazos: number;
  total_imputaciones: number;
  ready_to_finalize: boolean;
};

export type LimpiezaBeforeAfterPreview = {
  before: {
    total_inconsistencias: number;
    reglas_con_casos: number;
    reglas_total: number;
    filas_base: number;
  };
  after: {
    total_inconsistencias: number;
    reglas_con_casos: number;
    reglas_total: number;
    filas_base: number;
  };
  impact: {
    cases_excluded: number;
    cells_changed: number;
    replacements: number;
    normalizations: number;
    imputations: number;
    rules_resolved: number;
  };
  residual_final: Array<Record<string, unknown>>;
  decisions_ready: number;
};

export type LimpiezaModuleStats = {
  limpieza: { decisiones: number; casos_excluidos: number };
  reemplazo: { decisiones: number; celdas: number };
  imputacion: { decisiones: number; celdas: number };
  decision_maker: { pendientes: number; listas: number };
};

export type LimpiezaArtifact = {
  kind: string;
  label: string;
  file_id: string;
  original_name: string;
  generated_at: string;
};

export type LimpiezaArtifactsBundle = {
  finalized_at?: string;
  recommended_file_id?: string;
  files: LimpiezaArtifact[];
};

export type LimpiezaSummary = {
  ok: true;
  base_nombre: string | null;
  progreso: LimpiezaProgreso;
  summary: LimpiezaDecisionSummary;
  kpis: ViewDescriptor[];
  top_reglas: ViewDescriptor | null;
  top_variables: ViewDescriptor | null;
  decision_queue: LimpiezaQueueItem[];
  decision_draft: LimpiezaDecision[];
  module_stats: LimpiezaModuleStats;
  before_after_preview: LimpiezaBeforeAfterPreview | null;
  artifacts: LimpiezaArtifactsBundle | Record<string, never>;
  actions: ViewAction[];
};

// -----------------------------------------------------------------------------
// Identificadores de pestañas (deep-links)
// -----------------------------------------------------------------------------
export type ValidacionTabId =
  | "limpieza"
  | "instrumento"
  | "explorar"
  | "reglas_custom";

export type InstrumentoEstado = {
  ok: true;
  base_nombre: string | null;
  plan_construido: boolean;
  auditoria_corrida: boolean;
  n_reglas: number;
  views: ViewDescriptor[];
};

export type ExploradorVariable = {
  name: string;
  label: string;
  tipo: "so" | "sm" | "num" | "fecha" | "texto" | "mixto";
  n_validos: number;
  n_nulos: number;
};

export type ExploradorSeccion = {
  nombre: string;
  variables: ExploradorVariable[];
};

export type ExploradorVariablesList = {
  ok: true;
  base_nombre: string | null;
  secciones: ExploradorSeccion[];
  n_variables: number;
};

export type ReglasCustomList = {
  ok: true;
  base_nombre: string | null;
  reglas: ReglaCustom[];
};
