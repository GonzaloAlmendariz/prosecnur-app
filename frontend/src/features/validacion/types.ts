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
  tipo?: "so" | "sm" | "num" | "fecha" | "texto" | "mixto";
  n_total?: number;
  n_validos?: number;
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
  | "nulos_pct"
  | "rango_num"
  | "rango_fecha"
  | "outliers"
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
// Panorama (tab de entrada)
// -----------------------------------------------------------------------------
export type PanoramaProgreso = {
  plan_construido: boolean;
  auditoria_corrida: boolean;
  n_reglas_custom: number;
};

export type PanoramaSummary = {
  ok: true;
  base_nombre: string | null;
  progreso: PanoramaProgreso;
  kpis: ViewDescriptor[];
  top_reglas: ViewDescriptor | null;
  top_variables: ViewDescriptor | null;
  actions: ViewAction[];
};

// -----------------------------------------------------------------------------
// Identificadores de pestañas (deep-links)
// -----------------------------------------------------------------------------
export type ValidacionTabId =
  | "panorama"
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
