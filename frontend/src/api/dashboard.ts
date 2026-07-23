// dashboard.ts — dashboard (tabs relaciones/base/dimensiones) y dimensiones de analítica.
// Extraído de client.ts (split por dominio, 2026-07). Los consumidores
// importan del barrel ./client; este módulo no cambia el contrato.

import { apiFetch, downloadFailedMessage, handle, headers } from "./core";

// ---- Dimensiones (tab Analítica → Dimensiones) ---------------------------

export type DimensionesChoice = {
  code: string;
  label: string;
};

export type DimensionesEscalaDetectada = {
  list_name: string;
  n: number;
  vars: string[];
  // Choices del list_name en orden tentativo (numérico cuando aplica,
  // si no alfabético). El usuario reordena en el wizard para fijar la
  // dirección ascendente 0→100.
  choices: DimensionesChoice[];
  // TRUE si esta lista coincide con el whitelist evaluativo estándar
  // (satisfaccion, acuerdo, si_no, …). El wizard usa este flag para
  // pre-marcar automáticamente solo las "típicas" y dejar el resto al
  // usuario.
  es_default_evaluativa: boolean;
};

export type DimensionesBaseExistente =
  | { detected: false }
  | {
      detected: true;
      n_r100: number;
      n_sub: number;
      n_idx: number;
      vars_r100: string[];
      vars_sub: string[];
      vars_idx: string[];
      has_config_attr: boolean;
      has_indices_meta: boolean;
    };

export async function apiAnaliticaDimensionesDetect() {
  return handle<{
    ok: true;
    escalas: DimensionesEscalaDetectada[];
    base_dimensionada: DimensionesBaseExistente;
    listas_objetivo_disponibles: string[];
  }>(await apiFetch("/api/analitica/dimensiones/detect", { headers: headers() }));
}

export async function apiAnaliticaDimensionesBuild() {
  return handle<{
    ok: true;
    n_filas: number;
    n_r100: number;
    n_sub: number;
    n_idx: number;
    vars_idx: string[];
    vars_sub: string[];
  }>(
    await apiFetch("/api/analitica/dimensiones/build", { method: "POST", headers: headers() }),
  );
}

export type DimensionesCobertura = {
  var: string;
  n: number;
  n_validos: number;
  pct_validos: number;
  media: number | null;
  sd: number | null;
};

export async function apiAnaliticaDimensionesPreview() {
  return handle<{
    ok: true;
    preview: {
      filas: Array<Record<string, number | null>>;
      cobertura: DimensionesCobertura[];
      columnas: string[];
    };
  }>(await apiFetch("/api/analitica/dimensiones/preview", { headers: headers() }));
}

export async function apiAnaliticaDimensionesStatus() {
  return handle<{
    ok: true;
    built: boolean;
    n_filas: number;
    n_idx: number;
    n_sub: number;
  }>(await apiFetch("/api/analitica/dimensiones/status", { headers: headers() }));
}

export type BloqueSugerido = {
  nombre: string;
  etiqueta: string;
  vars: string[];
};

export async function apiAnaliticaDimensionesSugerir() {
  return handle<{
    ok: true;
    bloques: BloqueSugerido[];
  }>(await apiFetch("/api/analitica/dimensiones/sugerir", { headers: headers() }));
}

export type ValidacionSubindice = {
  nombre: string;
  etiqueta: string;
  vars_solicitadas: string[];
  vars_ok: string[];
  vars_faltantes: string[];
  ok: boolean;
  n_solicitadas: number;
  n_ok: number;
};

export type ValidacionIndice = {
  nombre: string;
  etiqueta: string;
  subindices_solicitados: string[];
  subindices_ok: string[];
  subindices_faltantes: string[];
  ok: boolean;
};

export type ValidacionSubcriterio = {
  nombre: string;
  // Etiqueta humana del subcriterio (ej. "Diligencia"). Si el JSON no la
  // provee, el backend cae al `nombre` técnico para no devolver vacío.
  etiqueta: string;
  fuente: string[];
  ok: boolean;
  vars_fuente_faltantes: string[];
};

export type ValidacionReporte = {
  listas: { coincidentes: string[]; no_usadas: string[] };
  subindices: ValidacionSubindice[];
  indices: ValidacionIndice[];
  subcriterios: ValidacionSubcriterio[];
  resumen: {
    n_listas_ok: number;
    n_listas_no_usadas: number;
    n_vars_ok: number;
    n_vars_faltantes: number;
    n_subindices_completos: number;
    n_subindices_parciales: number;
    n_indices_completos: number;
    n_indices_parciales: number;
    n_subcriterios_resueltos: number;
    n_subcriterios_incompletos: number;
  };
};

export async function apiAnaliticaDimensionesValidarJson(jsonConfig: unknown) {
  return handle<{ ok: true; reporte: ValidacionReporte }>(
    await apiFetch("/api/analitica/dimensiones/validar-json", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(jsonConfig),
    }),
  );
}

// ---- Dashboard module ----------------------------------------------------
//
// El módulo Dashboard renderiza la estructura definida por el paquete
// legacy `prosecnur::reporte_interactivo()`: pestañas fijas (Resumen,
// Relaciones, Base de datos, Dimensiones opcional). El usuario solo
// twitchea estética (logo, paleta, título, subtítulo) — no toca
// estructura ni contenido. Endpoints en api/R/router_dashboard.R.

export type DashboardTabId = "resumen" | "relaciones" | "base_datos" | "dimensiones";

export type DashboardTabManifest = {
  id: DashboardTabId;
  label: string;
  available: boolean;
  reason: string | null;
};

export type DashboardThemeDefault = {
  color_primario: string;
  color_fondo_app: string;
  color_borde: string;
  color_texto: string;
  color_texto_suave: string;
  color_superficie: string;
  color_superficie_2: string;
  color_header_tabla: string;
};

export type DashboardManifest = {
  tabs: DashboardTabManifest[];
  estado: {
    tiene_data: boolean;
    tiene_dim: boolean;
    n_secciones: number;
    curacion_confirmed: boolean;
  };
};

export async function apiDashboardManifest() {
  return handle<{
    ok: true;
    manifest: DashboardManifest;
    theme_default: DashboardThemeDefault;
  }>(await apiFetch("/api/dashboard/manifest", { headers: headers() }));
}

export type DashboardVarTipo = "so" | "sm" | "otro";
export type DashboardVar = {
  name: string;
  label: string;
  tipo: DashboardVarTipo;
};
export type DashboardSeccion = {
  nombre: string;
  vars: DashboardVar[];
};

export async function apiDashboardSecciones() {
  return handle<{
    ok: true;
    secciones: DashboardSeccion[];
    kpi_vars: string[];
  }>(await apiFetch("/api/dashboard/secciones", { headers: headers() }));
}

export type DashboardCurationVar = {
  name: string;
  label: string;
  raw_type: string;
  tipo: DashboardVarTipo;
  n_unique: number | null;
  default_include: boolean;
  suggested_exclude: boolean;
  reason: string | null;
  excluded: boolean;
};

export type DashboardCurationSection = {
  nombre: string;
  n_vars: number;
  suggested_exclude: boolean;
  reason: string | null;
  excluded: boolean;
  vars: DashboardCurationVar[];
};

export type DashboardCurationPayload = {
  confirmed: boolean;
  exclude_sections: string[];
  exclude_vars: string[];
  secciones: DashboardCurationSection[];
};

export async function apiDashboardCurationGet() {
  return handle<{ ok: true; payload: DashboardCurationPayload }>(
    await apiFetch("/api/dashboard/curacion", { headers: headers() }),
  );
}

export async function apiDashboardCurationPut(payload: {
  exclude_sections: string[];
  exclude_vars: string[];
}) {
  return handle<{ ok: true; curacion: { confirmed: boolean; saved_at: string } }>(
    await apiFetch("/api/dashboard/curacion", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
}

export type DashboardFiltro = {
  var: string;
  valores: string[];
};

export type DashboardCategoriaValor = { value: string; label: string };

export async function apiDashboardCategoriasVar(varName: string) {
  return handle<{ ok: true; valores: DashboardCategoriaValor[] }>(
    await apiFetch("/api/dashboard/categorias-var", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ var: varName }),
    }),
  );
}

export type DashboardDistSO = {
  code: string;
  label: string;
  n: number;
  pct: number;
  color?: string | null;
};
export type DashboardDistSMOption = {
  code: string;
  label: string;
  col_dummy: string;
  n_yes: number;
  n_total: number;
  pct_yes: number;
  color?: string | null;
};
export type DashboardResumenRow =
  | {
      type: "so";
      var: string;
      label: string;
      list_name?: string | null;
      dist: DashboardDistSO[];
      options: never[];
    }
  | {
      type: "sm";
      var: string;
      label: string;
      list_name?: string | null;
      options: DashboardDistSMOption[];
    };

export type DashboardResumenPayload = {
  seccion: string;
  n_total: number;
  rows: DashboardResumenRow[];
};

export async function apiDashboardResumenSeccion(opts: {
  seccion: string;
  filtros?: DashboardFiltro[];
}) {
  return handle<{ ok: true; payload: DashboardResumenPayload }>(
    await apiFetch("/api/dashboard/resumen/seccion", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        seccion: opts.seccion,
        filtros: opts.filtros ?? [],
      }),
    }),
  );
}

export type DashboardKpi = {
  var: string;
  list_name?: string | null;
  label: string;
  dist: DashboardDistSO[];
};
export type DashboardKpisPayload = {
  n_total: number;
  kpis: DashboardKpi[];
};

export async function apiDashboardResumenKpis(opts?: {
  filtros?: DashboardFiltro[];
}) {
  return handle<{ ok: true; payload: DashboardKpisPayload }>(
    await apiFetch("/api/dashboard/resumen/kpis", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ filtros: opts?.filtros ?? [] }),
    }),
  );
}

export type DashboardConfig = {
  titulo: string;
  subtitulo: string;
  logo_data_uri: string | null;
  logo_alt: string;
  logo_height_px: number;
  paleta_id: string | null;
  paletas_listas: Record<string, Record<string, string>>;
  color_primario_override: string | null;
  notas: string;
  // Personalización visual avanzada (Dimensiones).
  semaforo_modo?: "cortes" | "gradiente";
  semaforo_red_color?: string;
  semaforo_amber_color?: string;
  semaforo_green_color?: string;
  semaforo_red_max?: number;
  semaforo_amber_max?: number;
  // Cortes/paradas adicionales para ajuste fino del color sin aparecer
  // en la leyenda. Cada entrada es un par {value: 0-100, color: "#hex"}.
  semaforo_stops_extra?: { value: number; color: string }[];
  radar_min?: number;
  radar_max?: number;
  radar_gridshape?: "linear" | "circular";
  radar_modo?: "uno" | "facet" | "alternante";
  radar_animado?: boolean;
  barras_orientacion?: "horizontal" | "vertical" | "facet";
  barras_x_min?: number;
  barras_x_max?: number;
  foda_iconos_enabled?: boolean;
  foda_icon_tint?: string;
  foda_icon_size?: number;
  foda_icon_legend?: boolean;
  foda_score_min?: number;
  foda_score_max?: number;
  foda_show_total?: boolean;
  foda_spacing?: number;
  foda_grid_intensity?: number;
  foda_vista?: string;
  foda_views?: DashboardFodaViewConfig[];
  foda_aliases?: Record<string, Record<string, string>>;
  foda_service_icons?: Record<string, string>;
  // Layout del desglose en la pestaña Dimensiones.
  //   "paginado" — un nivel a la vez con stepper prev/next (default)
  //   "apilado"  — todos los niveles uno debajo del otro
  dim_desglose_layout?: "paginado" | "apilado";
  // Matriz por unidad — variables que definen las filas. La de color
  // determina el color de fondo + ícono de la 1ª columna; la de nombre
  // (opcional) concatena texto adicional ("Lima · ULE Lurigancho").
  matriz_var_color?: string;
  matriz_var_nombre?: string;
  // Overrides de íconos por conductor (axis_label → data-uri base64).
  // Persiste en .pulso. Si está vacío, el backend cae a los íconos del
  // paquete prosecnur (defaults bonitos por dimensión).
  dim_axis_icons?: Record<string, string>;
  // Logos del header — hasta 3 slots. Cada uno opcional (data URI base64).
  // Si está vacío, el header se hidrata desde el legacy `logo_data_uri`.
  logos?: DashboardLogoConfig[];
  // Habilitar/deshabilitar pestañas individualmente. Las pestañas no
  // listadas se consideran habilitadas (default true). Permite que el
  // editor recorte el dashboard final sin tocar el manifest del backend.
  tabs_enabled?: Partial<Record<DashboardTabId, boolean>>;
  // Modo de presentación para cada variable que tenga recodificación.
  // Las variables ausentes del mapa NO tienen decisión y disparan el
  // gate `RecodGate` antes de renderizar el dashboard.
  dashboard_var_modes?: Record<string, DashboardVarMode>;
  // Overrides de presentación por variable: incluir/excluir y label
  // custom. Permite ocultar variables del dashboard sin tocar el XLSForm
  // y diferenciar variables que comparten label (ej. p10_ule vs p10_ciam).
  dashboard_var_overrides?: Record<string, DashboardVarOverride>;
  // Cantidad de decimales para los porcentajes mostrados en las barras
  // del Resumen (SO y SM). Rango 0–2. Default 0.
  bar_decimals?: number;
  // Orden de las opciones en barras de select_multiple (Resumen).
  //   "questionnaire" — orden original del XLSForm (default)
  //   "desc"          — de mayor a menor porcentaje
  sm_order?: "questionnaire" | "desc";
  // Última publicación a HF Space (set por `dashboard_publish_space`).
  // Permite mostrar "Última publicación: hace X" en el botón Deploy y
  // pre-llenar el modal con el space_name actual al re-publicar.
  last_deploy?: DashboardLastDeploy;
};

export type DashboardVarMode = {
  // Para variables que tienen tanto opciones del XLSForm original como
  // recodificación: cuál mostrar. NO se permite mostrar ambas — siempre
  // una sola versión por variable. Default "original" si no hay decisión.
  modo: "original" | "recod";
};

export type DashboardVarOverride = {
  // false = la variable se oculta de los resúmenes del dashboard.
  enabled: boolean;
  // Si no vacío, reemplaza el label del XLSForm en los resúmenes.
  // Útil cuando varias variables comparten label (p10_ule, p10_ciam…).
  label: string;
};

// Catálogo de variables disponibles del dataset, agrupadas por sección
// del XLSForm. Devuelto por `apiDashboardAllVars` para que el panel
// "Datos" liste qué se puede incluir/excluir/renombrar.
export type DashboardSeccionVars = {
  seccion: string;
  vars: Array<{ name: string; label: string }>;
};

// Variable del estudio que tiene grupos de recodificación creados desde
// el módulo Codificación. Devuelta por `apiDashboardRecodVars` para que
// el frontend liste qué variables requieren decisión del usuario.
export type DashboardRecodVar = {
  name: string;
  label: string;
  n_grupos: number;
  grupos: Array<{ codigo: string; etiqueta: string }>;
};

export type DashboardLogoConfig = {
  data_uri: string;
  alt: string;
};

export type DashboardFodaViewConfig = {
  id: string;
  label: string;
  variable: string;
  metric_var?: string;
  card_mode: "iconos" | "alias";
  aliases?: Record<string, string>;
  icons?: Record<string, string>;
};

// Lista de variables que tienen grupos de recodificación creados en el
// módulo Codificación. El gate `RecodGate` la usa para saber qué
// variables aún no tienen decisión en `dashboard_var_modes`.
export async function apiDashboardRecodVars() {
  return handle<{ ok: true; vars: DashboardRecodVar[] }>(
    await apiFetch("/api/dashboard/recod-vars", { headers: headers() }),
  );
}

// Catálogo completo de variables del dataset agrupadas por sección del
// XLSForm. Lo usa el panel "Datos" para listar qué incluir/excluir y
// para renombrar variables individualmente.
export async function apiDashboardAllVars() {
  return handle<{ ok: true; secciones: DashboardSeccionVars[] }>(
    await apiFetch("/api/dashboard/all-vars", { headers: headers() }),
  );
}

export type DashboardPublishRequest = {
  hf_username: string;
  hf_token: string;
  space_name: string;
  private?: boolean;
};

export type DashboardPublishFile = {
  path: string;
  size: number;
};

export type DashboardLastDeploy = {
  repo_id: string;
  space_name: string;
  hf_username?: string;
  url: string;
  app_url: string;
  published_at: string;
  private?: boolean;
};

export type DashboardPublishResponse = {
  ok: true;
  repo_id: string;
  space_name: string;
  url: string;
  app_url: string;
  published_at: string;
  files_uploaded: number;
  total_bytes: number;
  project_size: number;
  uploaded: DashboardPublishFile[];
};

export async function apiDashboardPublish(payload: DashboardPublishRequest) {
  return handle<DashboardPublishResponse>(
    await apiFetch("/api/dashboard/publish", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
}

export async function apiDashboardConfigGet() {
  return handle<{ ok: true; config: DashboardConfig }>(
    await apiFetch("/api/dashboard/config", { headers: headers() }),
  );
}

export async function apiDashboardConfigPut(config: DashboardConfig) {
  return handle<{ ok: true; saved_at: string }>(
    await apiFetch("/api/dashboard/config", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ config }),
    }),
  );
}

export type DashboardSourceFileCandidate = {
  id: string;
  origin: "project" | "session" | string;
  kind: "xlsform" | "data" | string;
  file_id: string | null;
  path: string | null;
  name: string;
  ext: string;
  size: number | null;
  modified_at: string | null;
  suggested: boolean;
};

export type DashboardSourceMeta = {
  ready: boolean;
  source_kind: string | null;
  xlsform_file_id?: string | null;
  data_file_id?: string | null;
  xlsform_name: string | null;
  data_name: string | null;
  data_ext?: string | null;
  n_filas: number | null;
  n_columnas: number | null;
  loaded_at: string | null;
};

export type DashboardSourcePayload = {
  has_source: boolean;
  source: DashboardSourceMeta;
  project_dir: string | null;
  candidates: {
    project: {
      xlsforms: DashboardSourceFileCandidate[];
      data: DashboardSourceFileCandidate[];
    };
    session: {
      xlsforms: DashboardSourceFileCandidate[];
      data: DashboardSourceFileCandidate[];
    };
  };
};

export async function apiDashboardSourceGet() {
  return handle<{ ok: true; payload: DashboardSourcePayload }>(
    await apiFetch("/api/dashboard/source", { headers: headers() }),
  );
}

export async function apiDashboardSourceImport(payload:
  | { xlsform_file_id: string; data_file_id: string }
  | { xlsform_path: string; data_path: string }
) {
  return handle<{ ok: true; source: DashboardSourceMeta; manifest: DashboardManifest }>(
    await apiFetch("/api/dashboard/source/import", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
}

export type DashboardChoiceList = {
  list_name: string;
  choices: Array<{ name: string; label: string }>;
};

export async function apiDashboardPaletasListas() {
  return handle<{ ok: true; listas: DashboardChoiceList[] }>(
    await apiFetch("/api/dashboard/paletas-listas", { headers: headers() }),
  );
}

// =============================================================================
// Dashboard — Tab Relaciones
// =============================================================================

export type DashboardRelacionFila = {
  code: string;
  label: string;
  n_total: number;
};

export type DashboardRelacionColumna = {
  code: string;
  label: string;
  n_total: number;
};

export type DashboardRelacionCelda = {
  n: number;
  pct_col: number;
  pct_row: number;
};

export type DashboardRelacionPlotTrace = {
  type: "bar";
  name: string;
  x: string[];
  y: number[];
  text: string[];
  hoverinfo?: string;
  marker?: { color: string };
};

export type DashboardRelacionCruce = {
  nivel: string | null;
  nivel_code?: string;
  n_total: number;
  filas: DashboardRelacionFila[];
  columnas: DashboardRelacionColumna[];
  celdas: DashboardRelacionCelda[][];
  plot_traces: DashboardRelacionPlotTrace[];
};

export type DashboardRelacionPayload = {
  n_total: number;
  iterado: boolean;
  iter_var?: string;
  iter_label?: string;
  cruces: DashboardRelacionCruce[];
};

export async function apiDashboardRelacionCross(opts: {
  var_principal: string;
  var_segmento: string;
  filtros?: DashboardFiltro[];
  iterar?: { var: string } | null;
}) {
  return handle<{ ok: true; payload: DashboardRelacionPayload }>(
    await apiFetch("/api/dashboard/relacion/cross", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(opts),
    }),
  );
}

export async function apiDashboardRelacionDescargar(opts: {
  var_principal: string;
  var_segmento: string;
  filtros?: DashboardFiltro[];
  iterar?: { var: string } | null;
}): Promise<Blob> {
  const res = await apiFetch("/api/dashboard/relacion/descargar", {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify(opts),
  });
  if (!res.ok) {
    throw new Error(downloadFailedMessage(res.status));
  }
  return await res.blob();
}

// =============================================================================
// Dashboard — Tab Base de datos
// =============================================================================

export type DashboardBaseDatosDummy = {
  name: string;
  label: string;
  opt_code: string;
  opt_label: string;
};

export type DashboardBaseDatosVariable = {
  name: string;
  label: string;
  tipo: DashboardVarTipo;
  dummies?: DashboardBaseDatosDummy[];
};

export type DashboardBaseDatosSeccion = {
  id: string;
  label: string;
  variables: DashboardBaseDatosVariable[];
};

export type DashboardBaseDatosEstructura = {
  secciones: DashboardBaseDatosSeccion[];
};

export async function apiDashboardBaseDatosEstructura() {
  return handle<{ ok: true; payload: DashboardBaseDatosEstructura }>(
    await apiFetch("/api/dashboard/base-datos", { headers: headers() }),
  );
}

export type DashboardBaseDatosColumna = { key: string; label: string };

export type DashboardBaseDatosData = {
  rows: Record<string, string>[];
  columnas: DashboardBaseDatosColumna[];
  total: number;
};

export async function apiDashboardBaseDatosData(opts: {
  modo: "codigos" | "etiquetas";
  variables: string[];
  page?: number;
  page_size?: number;
  search?: string;
  sort?: { col: string; desc: boolean } | null;
}) {
  return handle<{ ok: true; payload: DashboardBaseDatosData }>(
    await apiFetch("/api/dashboard/base-datos/data", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(opts),
    }),
  );
}

export async function apiDashboardBaseDatosDescargar(opts: {
  modo: "codigos" | "etiquetas";
  variables: string[];
  formato: "xlsx" | "csv";
}): Promise<Blob> {
  const res = await apiFetch("/api/dashboard/base-datos/descargar", {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify(opts),
  });
  if (!res.ok) {
    throw new Error(downloadFailedMessage(res.status));
  }
  return await res.blob();
}

export type DashboardBaseDatosOpcion = { codigo: string; etiqueta: string };

export type DashboardBaseDatosDiccionario = {
  variable: string;
  etiqueta: string;
  tipo: DashboardVarTipo | string;
  tipo_medicion: string;
  opciones: DashboardBaseDatosOpcion[];
};

export async function apiDashboardBaseDatosDiccionario(variable: string) {
  return handle<{ ok: true; payload: DashboardBaseDatosDiccionario }>(
    await apiFetch(
      `/api/dashboard/base-datos/diccionario?variable=${encodeURIComponent(variable)}`,
      { headers: headers() },
    ),
  );
}

// =============================================================================
// Dashboard — Tab Dimensiones
// =============================================================================

export type DashboardDimObjetivo = {
  id: string;
  label: string;
  n_axes: number;
};

export type DashboardDimCatalogo = {
  ready: boolean;
  general: DashboardDimObjetivo[];
  indicadores: DashboardDimObjetivo[];
};

export type DashboardDimSeccionVar = {
  nombre: string;
  vars: { name: string; label: string }[];
};

export type DashboardDimSeccionesPayload = {
  secciones: DashboardDimSeccionVar[];
};

export type DashboardDimScoreRow = {
  grupo: string;
  axis_label: string;
  score_raw: number | null;
  score_round: number | null;
  base: number | null;
  [key: string]: unknown;
};

export type DashboardDimPayload = {
  ready: boolean;
  error?: string;
  mode?: "general" | "indicadores";
  objective?: string;
  objective_id?: string;
  visual_mode?: "barras" | "radar";
  principal_var?: string | null;
  principal_label?: string | null;
  principal_hidden?: number;
  iter_active?: boolean;
  iter_var?: string | null;
  iter_var_label?: string | null;
  iter_level?: string | null;
  iter_level_label?: string | null;
  iter_hidden_levels?: number;
  axis_order_plot?: string[];
  axis_order_heat?: string[];
  score_plot?: DashboardDimScoreRow[];
  score_heat?: DashboardDimScoreRow[];
  group_colors?: Record<string, string>;
  // Mapa axis_label → data-uri PNG/SVG. Vacío si el objetivo no
  // declara iconos en su config.
  axis_icons?: Record<string, string>;
  semaforo?: {
    red_max: number;
    amber_max: number;
    red_color: string;
    amber_color: string;
    green_color: string;
    na_color: string;
  };
};

export type DashboardDimCategoria = { value: string; label: string; base: number };

export async function apiDashboardDimCatalogo() {
  return handle<{ ok: true; payload: DashboardDimCatalogo }>(
    await apiFetch("/api/dashboard/dimensiones/catalogo", { headers: headers() }),
  );
}

export async function apiDashboardDimSeccionesVars() {
  return handle<{ ok: true; payload: DashboardDimSeccionesPayload }>(
    await apiFetch("/api/dashboard/dimensiones/secciones-vars", { headers: headers() }),
  );
}

export async function apiDashboardDimPayload(opts: {
  modo: "general" | "indicadores";
  objetivo: string;
  cruce?: string;
  incluir_total?: boolean;
  iter?: { var: string; level?: string } | null;
  filtros?: DashboardFiltro[];
}) {
  return handle<{ ok: true; payload: DashboardDimPayload }>(
    await apiFetch("/api/dashboard/dimensiones/payload", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(opts),
    }),
  );
}

export async function apiDashboardDimCategoriasVar(varName: string) {
  return handle<{ ok: true; valores: DashboardDimCategoria[] }>(
    await apiFetch("/api/dashboard/dimensiones/categorias-var", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ var: varName }),
    }),
  );
}

export type DashboardDimFodaCuadrante =
  | "fortaleza"
  | "oportunidad"
  | "debilidad"
  | "amenaza";

export type DashboardDimFodaItem = {
  var: string;
  axis_label: string;
  card_label?: string;
  item_kind?: string;
  card_mode?: "iconos" | "alias";
  grupo?: string;
  grupo_key?: string;
  color?: string;
  score_mean: number;
  score_sd: number;
  n_valid: number;
  cuadrante: DashboardDimFodaCuadrante | null;
  icono_url?: string;
  is_total_global?: boolean;
};

export type DashboardDimFodaIconLegendItem = {
  var: string;
  label: string;
  icono_url: string;
};

export type DashboardDimFodaPayload = {
  ready: boolean;
  error?: string;
  objetivo?: string;
  objetivo_id?: string;
  modo?: "general" | "indicadores";
  item_kind?: string;
  item_label?: string;
  card_mode?: "iconos" | "alias";
  item_var?: string;
  item_var_label?: string;
  metric_var?: string;
  metric_label?: string;
  items?: DashboardDimFodaItem[];
  cortes?: { score: number; sd: number };
  counts?: Record<DashboardDimFodaCuadrante, number>;
  group_colors?: Record<string, string>;
  icon_legend?: DashboardDimFodaIconLegendItem[];
  semaforo?: DashboardDimPayload["semaforo"];
};

export type DashboardDimMatrizFila = {
  key: string;
  color_key: string;
  color_label: string;
  // nombre_* solo se llenan cuando la 2da variable es DISTINTA de la 1ª
  // (cruce real). Si las dos son iguales, vienen vacíos — la card no
  // concatena texto duplicado.
  nombre_key: string;
  nombre_label: string;
  // icono_key se usa para buscar en `icons`. Cuando la 2da var es igual
  // a la 1ª, icono_key == color_key. Cuando son distintas, icono_key
  // == nombre_key. Vacío si no se eligió 2da variable.
  icono_key: string;
  icono_label: string;
  n: number;
  indicador_general: number | null;
  // Mapa axis_label → score promedio para esta fila. Algunas claves
  // pueden faltar si la combinación no tuvo casos válidos para ese
  // conductor.
  scores: Record<string, number | null>;
};

export type DashboardDimMatrizIconLegendItem = {
  key: string;
  label: string;
  icono_url: string;
};

export type DashboardDimMatrizPayload = {
  ready: boolean;
  error?: string;
  objetivo?: string;
  objetivo_id?: string;
  modo?: "general" | "indicadores";
  var_color?: string;
  var_color_label?: string;
  var_nombre?: string;
  var_nombre_label?: string;
  // var_icono = la variable usada para mapear íconos (puede coincidir con
  // var_color cuando el usuario eligió la misma en ambos selects).
  var_icono?: string;
  var_icono_label?: string;
  conductores?: Array<{ var: string; label: string }>;
  filas?: DashboardDimMatrizFila[];
  group_colors?: Record<string, string>;
  // Mapa icono_key → data-uri.
  icons?: Record<string, string>;
  // Solo entradas con ícono real — listo para renderizar la leyenda.
  icon_legend?: DashboardDimMatrizIconLegendItem[];
  semaforo?: DashboardDimPayload["semaforo"];
};

export type DashboardDimIconosDefaultsConductor = {
  var: string;
  label: string;
  // data-uri base64 vacío "" si el paquete no expone icono para esta dim.
  icono_url: string;
};

export type DashboardDimIconosDefaultsPayload = {
  ready: boolean;
  error?: string;
  objetivo?: string;
  objetivo_id?: string;
  modo?: "general" | "indicadores";
  conductores?: DashboardDimIconosDefaultsConductor[];
};

export async function apiDashboardDimIconosDefaults(opts: {
  modo: "general" | "indicadores";
  objetivo: string;
}) {
  const params = new URLSearchParams({ modo: opts.modo, objetivo: opts.objetivo });
  return handle<{ ok: true; payload: DashboardDimIconosDefaultsPayload }>(
    await apiFetch(`/api/dashboard/dimensiones/iconos-defaults?${params.toString()}`, {
      headers: headers(),
    }),
  );
}

export async function apiDashboardDimMatriz(opts: {
  modo: "general" | "indicadores";
  objetivo: string;
  var_color: string;
  var_nombre?: string;
  filtros?: DashboardFiltro[];
}) {
  return handle<{ ok: true; payload: DashboardDimMatrizPayload }>(
    await apiFetch("/api/dashboard/dimensiones/matriz_unidades", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(opts),
    }),
  );
}

export async function apiDashboardDimFoda(opts: {
  modo: "general" | "indicadores";
  objetivo: string;
  cruce?: string;
  incluir_total?: boolean;
  iter?: { var: string; level?: string } | null;
  filtros?: DashboardFiltro[];
  foda_config?: Pick<DashboardConfig, "foda_iconos_enabled" | "foda_icon_tint" | "foda_icon_size" | "foda_icon_legend" | "foda_score_min" | "foda_score_max" | "foda_show_total" | "foda_spacing" | "foda_grid_intensity" | "foda_vista" | "foda_views" | "foda_aliases" | "foda_service_icons">;
}) {
  return handle<{ ok: true; payload: DashboardDimFodaPayload }>(
    await apiFetch("/api/dashboard/dimensiones/foda", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(opts),
    }),
  );
}

export type AplicarResult = {
  ok: true;
  data_adaptada: { file_id: string; size: number };
  instrumento_adaptado: { file_id: string; size: number };
};

export async function apiCodifAplicar() {
  return handle<{ ok: true; job_id: string; kind: string }>(
    await apiFetch("/api/codificacion/aplicar", { method: "POST", headers: headers() })
  );
}

// ---- Plan de adaptación (paso 3) ------------------------------------------

export type PlanCodigoItem = {
  codigo: string;
  etiqueta: string;
  n_respuestas: number;
};

export type PlanPregunta = {
  parent: string;
  parent_label: string;
  tipo: string;
  modo_so: string;
  text_col: string;
  nueva_variable: string;
  n_grupos: number;
  n_codigos_nuevos: number;
  n_codigos_reutilizados: number;
  n_respuestas_afectadas: number;
  codigos_nuevos: PlanCodigoItem[];
  codigos_reutilizados: PlanCodigoItem[];
  bridge_soportado: boolean;
};

export type PlanAdaptacion = {
  ok: true;
  preguntas: PlanPregunta[];
  totales: {
    n_preguntas: number;
    n_variables_nuevas: number;
    n_codigos_nuevos: number;
    n_codigos_reutilizados: number;
  };
};

export async function apiCodifPlanAdaptacion() {
  return handle<PlanAdaptacion>(
    await apiFetch("/api/codificacion/plan-adaptacion", { headers: headers() })
  );
}

// ---- Export / Import JSON de configuración --------------------------------
// Exporta configuración portable versionada. Importar siempre pasa por preview
// antes de aplicar cambios sobre el estado de codificación del .pulso.

export type CodifConfigStatus = "compatible" | "needs_confirmation" | "conflict" | "missing";
export type CodifConfigConfidence = "strong" | "medium" | "weak" | "none";
export type CodifConfigImportStrategy = "keep" | "merge_missing" | "replace" | "duplicate";

export type CodifConfigOption = {
  code: string;
  label: string;
};

export type CodifConfigCategory = {
  code: string;
  label: string;
  description?: string;
  origin?: string;
};

export type CodifConfigVariable = {
  id: string;
  role: string;
  base_id: string;
  base_label?: string;
  scope?: string;
  name: string;
  label: string;
  type: string;
  list_norm?: string;
  parent_col?: string;
  text_col?: string;
  mode_so?: string;
  fingerprint?: string;
  options_fingerprint?: string;
  options?: CodifConfigOption[];
  categories?: CodifConfigCategory[];
  rules?: unknown[];
  recodes?: unknown[];
  bins?: unknown[];
  configuration?: unknown;
};

export type CodifMatrixSummary = {
  source_sheet?: string;
  total?: {
    carrera?: string;
    filas?: number;
    puestos_categorizados?: number;
    puestos_revision?: number;
    funciones_categorizadas?: number;
    funciones_revision?: number;
    filas_revision?: number;
  } | null;
  by_career?: Array<{
    carrera?: string;
    filas?: number;
    puestos_categorizados?: number;
    puestos_revision?: number;
    funciones_categorizadas?: number;
    funciones_revision?: number;
    filas_revision?: number;
  }>;
};

export type CodifConfigBundle = {
  ok: true;
  schema_version: "prosecnur.coding_config.v1" | string;
  exported_at: string;
  app_version: string;
  project_label: string;
  mode: "unibase" | "multibase" | string;
  processing_mode?: string;
  suggested_filename?: string;
  variables: CodifConfigVariable[];
  metadata?: {
    source?: string;
    notes?: string;
    exported_bases?: string[];
    matrix_layouts?: string[];
    matrix_summary?: CodifMatrixSummary | null;
    normalization?: {
      adopted_text_duplicates?: Array<{
        base_id: string;
        parent: string;
        text_col: string;
        mode_so: string;
        child: string;
        parent_groups_before: number;
        child_groups: number;
        parent_groups_after: number;
        action: string;
      }>;
    };
    contains_case_rows?: boolean;
    contains_response_match_values?: boolean;
    warnings?: string[];
  };
};

export type CodifImportPreviewItem = {
  match_id: string;
  source: {
    id: string;
    base_id: string;
    name: string;
    label: string;
    type: string;
    mode_so?: string;
    text_col?: string;
  };
  target: {
    base_id: string;
    name: string;
    label: string;
    type: string;
    fingerprint?: string;
  };
  status: CodifConfigStatus;
  confidence: CodifConfigConfidence;
  existing_state: boolean;
  reason: string;
  changes: {
    categories_new: number;
    categories_overwrite: number;
    rules_add: number;
    recodes_add: number;
  };
  matrix_layout?: "case_code_matrix" | "paired_category_matrix" | string;
  matrix_diagnostics?: {
    rows?: number;
    unique_cases?: number;
    unique_texts?: number;
    duplicate_case_rows?: number;
    matched_cases?: number;
    unmatched_cases?: number;
    review_rows?: number;
    categorized?: number;
    blocking?: boolean;
    code_label_conflicts?: string[];
  };
  default_strategy: CodifConfigImportStrategy;
  can_apply: boolean;
};

export type CodifImportPreview = {
  ok: true;
  schema_version: string;
  file_name?: string;
  source: {
    project_label?: string;
    exported_at?: string;
    mode?: string;
    variables: number;
    variables_after_normalization?: number;
    variables_effective_after_normalization?: number;
    normalization?: {
      adopted_text_duplicates?: Array<{
        base_id: string;
        parent: string;
        text_col: string;
        mode_so: string;
        child: string;
        parent_groups_before: number;
        child_groups: number;
        parent_groups_after: number;
        action: string;
      }>;
    };
  };
  target: {
    project_label?: string;
    mode?: string;
    bases: string[];
  };
  items: CodifImportPreviewItem[];
  summary: {
    compatible: string[];
    needs_confirmation: string[];
    missing: string[];
    conflicts: string[];
    n_compatible: number;
    n_needs_confirmation: number;
    n_missing: number;
    n_conflicts: number;
  };
  matrix_summary?: CodifMatrixSummary | null;
  requires_confirmation: boolean;
};

export type CodifImportSelection = {
  match_id: string;
  strategy?: CodifConfigImportStrategy;
  note?: string;
};

export type CodifImportApplyResult = {
  ok: true;
  imported: CodifImportPreviewItem[];
  versioned: CodifImportPreviewItem[];
  skipped: string[];
  audit: {
    event: "coding_config_import";
    imported_at: string;
    file_name: string;
    schema_version: string;
    variables_imported: number;
    variables_versioned: number;
    variables_skipped: number;
    conflicts: number;
  };
  summary: {
    variables_imported: number;
    variables_versioned: number;
    variables_skipped: number;
    conflicts: number;
  };
};

export type CodifExcelCategorizationPreview = {
  ok: true;
  source_format: "categorization_excel" | "matrix_excel";
  bundle: CodifConfigBundle;
  preview: CodifImportPreview;
};

export type CodifMatrixMap = {
  ok: true;
  bases: Array<{
    base: string;
    variables: Array<{
      variable: string;
      variable_label?: string;
      variable_kind?: string;
      variable_kind_label?: string;
      n_categorias?: number;
      n_casos?: number;
      n_asignaciones?: number;
      n_observaciones?: number;
      categories: Array<{
        codigo: string;
        etiqueta: string;
        category_role?: "regular" | "otro" | "no_contesta" | string;
        category_role_label?: string;
        n_respuestas: number;
        n_casos: number;
        n_asignaciones?: number;
        n_observaciones?: number;
        cases?: Array<{
          id_caso: string;
          respuesta: string;
          codigo: string;
          etiqueta: string;
          obs?: string;
        }>;
      }>;
    }>;
  }>;
};

export type CodifMatrixExportResult = {
  ok: true;
  file_id: string;
  size: number;
  visibility: "work" | "internal" | "client" | string;
};

export async function apiCodifExportJson() {
  return handle<CodifConfigBundle>(
    await apiFetch("/api/codificacion/export-json", { headers: headers() })
  );
}

export async function apiCodifImportJsonPreview(bundle: unknown, fileName?: string) {
  return handle<CodifImportPreview>(
    await apiFetch("/api/codificacion/import-json/preview", {
      method: "POST",
      headers: { ...headers(), "Content-Type": "application/json" },
      body: JSON.stringify({ bundle, file_name: fileName ?? "" }),
    })
  );
}

export async function apiCodifImportJsonApply(bundle: unknown, selections: CodifImportSelection[], fileName?: string) {
  return handle<CodifImportApplyResult>(
    await apiFetch("/api/codificacion/import-json/apply", {
      method: "POST",
      headers: { ...headers(), "Content-Type": "application/json" },
      body: JSON.stringify({ bundle, selections, file_name: fileName ?? "" }),
    })
  );
}

export async function apiCodifImportExcelCategorizationPreview(fileId: string, fileName?: string) {
  return handle<CodifExcelCategorizationPreview>(
    await apiFetch("/api/codificacion/import-categorias-excel/preview", {
      method: "POST",
      headers: { ...headers(), "Content-Type": "application/json" },
      body: JSON.stringify({ file_id: fileId, file_name: fileName ?? "" }),
    })
  );
}

export async function apiCodifMatricesPreview(fileId: string, fileName?: string) {
  return handle<CodifExcelCategorizationPreview>(
    await apiFetch("/api/codificacion/matrices/preview", {
      method: "POST",
      headers: { ...headers(), "Content-Type": "application/json" },
      body: JSON.stringify({ file_id: fileId, file_name: fileName ?? "" }),
    })
  );
}

export async function apiCodifMatricesApply(bundle: unknown, selections: CodifImportSelection[], fileName?: string) {
  return handle<CodifImportApplyResult>(
    await apiFetch("/api/codificacion/matrices/apply", {
      method: "POST",
      headers: { ...headers(), "Content-Type": "application/json" },
      body: JSON.stringify({ bundle, selections, file_name: fileName ?? "" }),
    })
  );
}

export async function apiCodifMatricesMap(base?: string) {
  const query = base ? `?base=${encodeURIComponent(base)}` : "";
  return handle<CodifMatrixMap>(
    await apiFetch(`/api/codificacion/matrices/mapa${query}`, { headers: headers() })
  );
}

export async function apiCodifMatricesCasePatch(payload: {
  base: string;
  variable: string;
  id_caso: string;
  from_codigo?: string;
  codigo: string;
  etiqueta: string;
}) {
  return handle<{ ok: true; map: CodifMatrixMap }>(
    await apiFetch("/api/codificacion/matrices/caso", {
      method: "POST",
      headers: { ...headers(), "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
  );
}

export async function apiCodifMatricesExport(
  visibility: "work" | "internal" | "client",
  variables?: string[],
  base?: string,
) {
  return handle<CodifMatrixExportResult>(
    await apiFetch("/api/codificacion/matrices/export", {
      method: "POST",
      headers: { ...headers(), "Content-Type": "application/json" },
      body: JSON.stringify({ visibility, variables: variables ?? [], base: base ?? "" }),
    })
  );
}

export async function apiCodifImportJson(bundle: unknown) {
  return handle<CodifImportPreview>(
    await apiFetch("/api/codificacion/import-json", {
      method: "POST",
      headers: { ...headers(), "Content-Type": "application/json" },
      body: JSON.stringify(bundle),
    })
  );
}
