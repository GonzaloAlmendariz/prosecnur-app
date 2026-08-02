// calcMuestra.ts — calculador de muestra (módulo calc-muestra + legacy aulas).
// Extraído de client.ts (split por dominio, 2026-07). Los consumidores
// importan del barrel ./client; este módulo no cambia el contrato.

import { apiFetch, apiPath, downloadFailedMessage, handle, headers, SESSION_KEY } from "./core";
import type { MonitoreoRow } from "./monitoreo";
import type { CalcMuestraAulasCriteriosRadiografia } from "./calcMuestraCriteriosRadiografia";

export * from "./calcMuestraCriteriosRadiografia";

// ============================================================================
// [DEPRECATED] Cálculo de muestra por aulas universitarias
// Reemplazado por `Calculador de Muestra` (calc-muestra). Las funciones
// `apiMuestraAulas*` apuntan a endpoints que ya no existen en el backend;
// ningún componente UI las consume. Se mantienen temporalmente sólo porque
// otros tipos exportados (MuestraAulasReporteMeta) podrían ser referenciados
// hasta el siguiente cleanup. Tree-shaking las elimina del bundle.
// ============================================================================

export type MuestraAulasFacultadRow = {
  facultad: string;
  N_total: number;
  N_hombres: number;
  N_mujeres: number;
  avg_matriculados_aula: number;
  tau: number;
};

export type MuestraAulasRedondeo = "arriba" | "cuadratura";
export type MuestraAulasTipoEstudio =
  | "universitario_aulas"
  | "universitario_online"
  | "universitario_mixto"
  | "acreditacion_egresados"
  | "territorial_hogares";

export type MuestraAulasGlobales = {
  z: number;
  p: number;
  tipo_estudio: MuestraAulasTipoEstudio;
  titulo_estudio: string;
  fecha_aplicacion: string;
  redondeo: MuestraAulasRedondeo;
};

export type MuestraAulasParamsA = {
  e: number;
  deff: number;
  oversample_pct: number;
};

export type MuestraAulasParamsB = {
  e: number;
  deff: number;
  cap_pct: number;
  oversample_pct: number;
};

export type MuestraAulasConfig = {
  version: 1;
  globales: MuestraAulasGlobales;
  escenario_A: MuestraAulasParamsA;
  escenario_B: MuestraAulasParamsB;
};

export type MuestraAulasDistribucionRow = {
  facultad: string;
  sexo: "Hombres" | "Mujeres";
  N: number;
  n: number;
};

export type MuestraAulasAulaRow = {
  facultad: string;
  cuota_total: number;
  aulas_base: number;
  aulas_reemplazo: number;
  aulas_total: number;
  tipo_aula: string;
};

export type MuestraAulasResultadoA = {
  n_bruto: number;
  n_ajustado_deff: number;
  n_redondeado: number;
  n_con_sobremuestra: number;
  precision_universidad: number;
  distribucion: MuestraAulasDistribucionRow[];
  aulas: MuestraAulasAulaRow[];
  N_universo: number;
};

export type MuestraAulasFacultadResB = {
  facultad: string;
  N_facultad: number;
  n_objetivo: number;
  n_final: number;
  cap_activo: boolean;
  precision_e: number;
  aulas_base: number;
  aulas_reemplazo: number;
  aulas_total: number;
  tipo_aula: string;
};

export type MuestraAulasResultadoB = {
  por_facultad: MuestraAulasFacultadResB[];
  distribucion: MuestraAulasDistribucionRow[];
  n_total: number;
  n_total_objetivo: number;
  n_con_sobremuestra: number;
  facultades_cap: string[];
  cap_pct: number;
};

export type MuestraAulasDecisionEntry = {
  nombre?: string;
  decision?: string;
  paso?: string;
  valor?: string;
  resultado?: string | number;
  justificacion?: string;
  nota?: string;
  z?: number;
};

export type MuestraAulasDecisionLog = {
  parametros: MuestraAulasDecisionEntry[];
  metodologicas: MuestraAulasDecisionEntry[];
  ajustes: MuestraAulasDecisionEntry[];
};

export type MuestraAulasReporteMeta = {
  disponible: boolean;
  generated_at?: string | null;
  formato?: "html" | "pdf" | null;
  hash_config?: string | null;
  job_id?: string | null;
};

export type MuestraAulasState = {
  config: MuestraAulasConfig;
  universo: MuestraAulasFacultadRow[];
  universo_n: number;
  resultados: {
    A?: MuestraAulasResultadoA | null;
    B?: MuestraAulasResultadoB | null;
  } | null;
  decision_log: MuestraAulasDecisionLog | null;
  computado_at: string | null;
  reporte: MuestraAulasReporteMeta;
  sample_disponible: boolean;
};

export const DEFAULT_MUESTRA_AULAS_CONFIG: MuestraAulasConfig = {
  version: 1,
  globales: {
    z: 1.96,
    p: 0.5,
    tipo_estudio: "universitario_aulas",
    titulo_estudio: "Estudio sin título",
    fecha_aplicacion: "",
    redondeo: "cuadratura",
  },
  escenario_A: { e: 0.025, deff: 2.0, oversample_pct: 0.10 },
  escenario_B: { e: 0.05, deff: 1.5, cap_pct: 0.50, oversample_pct: 0.10 },
};

export async function apiMuestraAulasState() {
  return handle<MuestraAulasState>(
    await apiFetch("/api/muestra-aulas/state", { headers: headers() }),
  );
}

export async function apiMuestraAulasConfigPut(config: MuestraAulasConfig) {
  return handle<{ ok: true; config: MuestraAulasConfig }>(
    await apiFetch("/api/muestra-aulas/config", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ config }),
    }),
  );
}

export async function apiMuestraAulasUniversoPut(rows: MuestraAulasFacultadRow[]) {
  return handle<{
    ok: true;
    universo: MuestraAulasFacultadRow[];
    warnings: string[];
  }>(
    await apiFetch("/api/muestra-aulas/universo", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ universo: rows }),
    }),
  );
}

export async function apiMuestraAulasUniversoUpload(fileId: string) {
  return handle<{
    ok: true;
    universo: MuestraAulasFacultadRow[];
    warnings: string[];
  }>(
    await apiFetch("/api/muestra-aulas/universo/upload", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ file_id: fileId }),
    }),
  );
}

export function muestraAulasPlantillaUrl(): string {
  const sid = localStorage.getItem(SESSION_KEY);
  const qs = sid ? `?sid=${encodeURIComponent(sid)}` : "";
  return apiPath(`/api/muestra-aulas/plantilla${qs}`);
}

export async function apiMuestraAulasCalcular(
  escenario: "A" | "B" | "ambos" = "ambos",
) {
  return handle<{
    ok: true;
    resultados: { A?: MuestraAulasResultadoA; B?: MuestraAulasResultadoB };
    decision_log: MuestraAulasDecisionLog;
    computado_at: string;
  }>(
    await apiFetch("/api/muestra-aulas/calcular", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ escenario }),
    }),
  );
}

export async function apiMuestraAulasReporteIniciar(
  formato: "html" | "pdf" = "html",
) {
  return handle<{ ok: true; job_id: string; formato: "html" | "pdf" }>(
    await apiFetch("/api/muestra-aulas/reporte", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ formato }),
    }),
  );
}

export function muestraAulasReporteDescargarUrl(opts: { inline?: boolean } = {}): string {
  const sid = localStorage.getItem(SESSION_KEY);
  const params = new URLSearchParams();
  if (sid) params.set("sid", sid);
  if (opts.inline) params.set("inline", "1");
  const qs = params.toString();
  return apiPath(`/api/muestra-aulas/reporte/descargar${qs ? `?${qs}` : ""}`);
}

// ============================================================================
// Calculador de Muestra (nuevo módulo `calc-muestra`)
// ============================================================================
//
// Reemplazo de muestra-aulas y diseno-muestra. Multi-componente, basado en el
// blueprint canónico de PULSO PUCP (outputs/fuentes_metodologicas).
//
// Cobertura Fase 1: 4 metodologías (conglomerados, intención censal, cuotas,
// listado externo) con plantilla ACREDITACION PUCP multi-actor.

export type CalcMuestraTecnica =
  | "prob_aleatorio_simple"
  | "prob_estratificado"
  | "prob_estratificado_independiente"
  | "prob_conglomerado_multietapico"
  | "sistematico"
  | "medicion_recurrente"
  | "barrido"
  | "intencion_censal"
  | "listado_externo_meta_fija"
  | "no_prob_conveniencia"
  | "no_prob_cuotas";

export type CalcMuestraNaturaleza = "prob" | "operativo" | "no_prob";

export type CalcMuestraOrigenTamano =
  | "formula"
  | "meta_contractual"
  | "cobertura_esperada"
  | "matriz_perfiles_cualitativa";

// Modos de trabajo del calculador (alcance: PROPUESTA).
// El seguimiento de campo y el cierre con brechas viven en el módulo
// de Monitoreo, no acá.
export type CalcMuestraModoTrabajo =
  | "estimacion_preliminar"
  | "diseno_validado";

export type CalcMuestraMacroFamilia =
  | "acreditacion"
  | "encuesta_estudiantes"
  | "hsvg_universitario"
  | "territorial"
  | "listado_telefonico"
  | "linea_base_servicios"
  | "estudio_propio";

export type CalcMuestraNivelRespaldo =
  | "representatividad_estadistica"
  | "representatividad_operacional"
  | "representatividad_teorica_controlada"
  | "cobertura_balanceada"
  | "evidencia_descriptiva";

export type CalcMuestraEstadoMarco =
  | "no_definido"
  | "bruto"
  | "validado"
  | "contactable"
  | "listado_externo"
  | "operativo";

export type CalcMuestraEstrato = {
  id: string;
  label: string;
  N: number;
  N_a: number;
  N_b: number;
  sub_a_label: string;
  sub_b_label: string;
  e_facultad?: number;
  p_facultad?: number;
  confianza_facultad?: number;
  z_facultad?: number;
  cuota_fija?: number;
  sobremuestra_fija?: number;
  aulas_base_fijas?: number;
  aulas_extra_operativas?: number;
  promedio_conglomerado: number;
  tau: number;
};

export type CalcMuestraMatrizOperativaCelda = {
  id: string;
  territorio: string;
  servicio: string;
  N: number;
  notas: string;
};

export type CalcMuestraMarco = {
  universo_bruto: number;
  marco_validado: number;
  marco_contactable: number;
  estado: CalcMuestraEstadoMarco;
  notas: string;
  estratos?: CalcMuestraEstrato[];
  matriz_operativa?: CalcMuestraMatrizOperativaCelda[];
};

export type CalcMuestraParametros = {
  z: number;
  p: number;
  e: number;
  deff: number;
  tau: number;
  oversample_pct: number;
  tasa_contacto: number;
  tasa_elegibilidad: number;
  tasa_respuesta: number;
  cobertura_objetivo: number;
  promedio_conglomerado: number;
  n_minimo_estrato: number;
  tope_operativo: number;
  /** Estadístico con que el motor R deriva estudiantes-por-aula del marco
   *  (reunión Ramiro 2026-07-15). Espejo del `resumenEstAula` del Recorrido;
   *  default del backend: "media". */
  estadistico_conglomerado?: "media" | "mediana" | "min_media_mediana";
};

export type CalcMuestraMeta = {
  tipo: "objetivo" | "cuota" | "cobertura" | "contractual";
  valor: number;
  variable_control: string;
  sub_cuotas: Record<string, number>;
};

export type CalcMuestraDistribucionEstrato = {
  estrato: string;
  N: number;
  n: number;
  p_e?: number;
  z_e?: number;
  confianza_e?: number;
  precision_e: number | null;
  regla?: string;
};

export type CalcMuestraDistribucionSub = {
  estrato: string;
  sub: string;
  N: number;
  n: number;
};

export type CalcMuestraAulasEstrato = {
  estrato: string;
  N: number;
  cuota: number;
  avg_conglomerado: number;
  tau: number;
  aulas_base: number;
  aulas_reemplazo: number;
  aulas_extra_operativas?: number;
  aulas_total: number;
  tipo_aula: string;
  precision_e: number | null;
};

export type CalcMuestraCuotaMatriz = {
  territorio: string;
  servicio: string;
  N: number;
  n: number;
  regla?: string;
};

export type CalcMuestraResultado = {
  n_bruto?: number;
  n_teorico: number | null;
  n_objetivo: number;
  n_operativo: number;
  unidades_operativas?: number | null;
  precision_alcanzada?: number | null;
  sobremuestra?: number;
  cobertura_objetivo?: number;
  tasa_respuesta_esperada?: number;
  universo_a_contactar?: number;
  variable_control?: string;
  sub_cuotas?: Record<string, number>;
  tasa_contacto?: number;
  tasa_elegibilidad?: number;
  tasa_respuesta?: number;
  registros_a_contactar?: number;
  origen_tamano: CalcMuestraOrigenTamano;
  advertencia?: string;
  tecnica: CalcMuestraTecnica;
  computado_at: string;
  inferencia: {
    permitido: boolean;
    motivos: string | null;
  };
  // Solo presente cuando el componente es conglomerados con marco estratificado.
  distribucion_estratos?: CalcMuestraDistribucionEstrato[];
  distribucion_sub?: CalcMuestraDistribucionSub[];
  aulas_por_estrato?: CalcMuestraAulasEstrato[];
  aulas_total?: number;
  aulas_base_total?: number;
  aulas_extra_total?: number;
  cuotas_matriz?: CalcMuestraCuotaMatriz[];
};

export type CalcMuestraActorCategoria =
  | "estudiantes"
  | "docentes"
  | "administrativos"
  | "egresados"
  | "empleadores"
  | "comite_consultivo"
  | "otros";

export type CalcMuestraCanalRecojo =
  | "aula_qr"
  | "telefonico"
  | "online_email"
  | "presencial"
  | "mixto"
  | "sin_definir";

export type CalcMuestraInferenciaAcreditacion = {
  tecnica: CalcMuestraTecnica | null;
  regla: string;
  justificacion: string;
  minimo_cobertura?: number;
  minimo_cuota?: number;
  minimo_n?: number;
  piso_n_minimo?: number;
  tope_operativo?: number;
  variable_control?: string;
  aulas_referencia?: number;
  params_canonicos?: Partial<CalcMuestraParametros>;
};

export type CalcMuestraComponente = {
  id: string;
  actor: string;
  actor_id: string;
  actor_categoria: CalcMuestraActorCategoria;
  canal_recojo: CalcMuestraCanalRecojo;
  tecnica: CalcMuestraTecnica;
  naturaleza: CalcMuestraNaturaleza;
  origen_tamano: CalcMuestraOrigenTamano;
  nivel_respaldo: CalcMuestraNivelRespaldo;
  marco: CalcMuestraMarco;
  parametros: CalcMuestraParametros;
  meta: CalcMuestraMeta;
  inferencia_acreditacion?: CalcMuestraInferenciaAcreditacion;
  resultado?: CalcMuestraResultado | null;
};

export type CalcMuestraDecisionLog = {
  estudio: {
    titulo: string;
    macro_familia: CalcMuestraMacroFamilia;
    modo_trabajo: CalcMuestraModoTrabajo;
    modo_sensible: boolean;
  };
  componentes: Array<{
    actor: string;
    tecnica: CalcMuestraTecnica;
    naturaleza: CalcMuestraNaturaleza;
    origen_tamano: CalcMuestraOrigenTamano;
    nivel_respaldo: CalcMuestraNivelRespaldo;
    marco: CalcMuestraMarco;
    decisiones: Array<{ decision: string; valor: string; justificacion: string }>;
  }>;
};

export type CalcMuestraWorkspaceFrameMode =
  | "sin_definir"
  | "acreditacion"
  | "opinion_universitaria"
  | "marco_disponible"
  | "territorial_handoff"
  | "legacy";

export type CalcMuestraWorkspaceProducto =
  | "muestra_probabilistica"
  | "cobertura_marco"
  | "matriz_cuotas"
  | "componentes_mixtos";

export type CalcMuestraWorkspaceVariableControl = {
  id: string;
  label: string;
  tipo: "estrato" | "cuota" | "filtro" | "segmento" | "otro";
  disponible: boolean;
  notas?: string;
};

export type CalcMuestraWorkspaceEscenario = {
  id: string;
  label: string;
  descripcion: string;
  activo: boolean;
  tecnica: CalcMuestraTecnica;
  producto: CalcMuestraWorkspaceProducto;
  component_id?: string;
  incluir_reporte?: boolean;
  redondeo_multiplo?: number;
  parametros: Partial<CalcMuestraParametros>;
};

export type CalcMuestraWorkspaceAulasModalidad =
  | "presencial_aula"
  | "mixto_aula"
  | "online_controlado";

export type CalcMuestraWorkspaceAulasSelector =
  | "pps_balanceado"
  | "cube_balanceado"
  | "local_pivotal_balanceado"
  | "pool_controlado"
  | "sistematico_pps"
  | "estratificado_aleatorio"
  | "manual_auditable";

export type CalcMuestraWorkspaceAulasSizeGroup = {
  id: string;
  label: string;
  min: number;
  max: number | null;
  descripcion: string;
};

export type CalcMuestraAulasObjectiveVariable = {
  dimension: string;
  label: string;
  aula_col: string;
  student_col?: string;
  weight: number;
  tolerance: number;
  source_preference?: "student" | "aula" | string;
};

export type CalcMuestraAulasObjectiveConfig = {
  schema: "calc_muestra_aulas_representativity_objective_v1" | string;
  primary_unit?: string;
  variables: CalcMuestraAulasObjectiveVariable[] | MonitoreoRow[];
  component_weights?: Record<string, number>;
  duplicate_loss_tolerance?: number;
  dispersion_tolerance?: number;
  weight_cv_warn?: number;
  weight_cv_critical?: number;
  reserve_depth_target?: number;
  missing_policy?: string;
};

export type CalcMuestraWorkspaceAulasConfig = {
  schema: "calc_muestra_workspace_aulas_v1" | string;
  modalidad: CalcMuestraWorkspaceAulasModalidad;
  selector: CalcMuestraWorkspaceAulasSelector;
  /** Cursos-horario titulares calculados por R para el escenario elegido. */
  n_aulas?: number;
  selector_engine?: CalcMuestraWorkspaceAulasSelector | string;
  method_family?: string;
  min_elegibles_aula: number;
  accepted_conditions?: string[];
  require_undergraduate?: boolean;
  require_adult?: boolean;
  min_age?: number;
  require_in_person?: boolean;
  /** Patrones de exclusión (espejo de los filtros del motor R). */
  exclude_session_patterns?: string[];
  exclude_modality_patterns?: string[];
  exclude_level_patterns?: string[];
  /** Criterios del marco (espejo calc_muestra_aulas_config_v1); todos nacen apagados. */
  require_stable_teacher?: boolean;
  accepted_teacher_type_patterns?: string[];
  /** H7 · patrones aceptados sobre la columna de formación real (pregrado por defecto); solo opera con require_undergraduate y columna con señal. */
  accepted_formation_patterns?: string[];
  /**
   * Orden de jerarquía de tipos de docente (ADR 0035): claves canónicas de
   * categoría de teacher_type (las MISMAS que emite `criterios_catalogo`), de
   * rango ALTO→BAJO. El motor cataloga cada curso-horario por su docente de mayor
   * jerarquía (`teacher_type_top`). Opcional; vacío ⇒ el motor usa su orden por
   * defecto. No afecta la inclusión ("al menos uno" sigue mandando). */
  teacher_type_orden?: string[];
  /** H9 · excepciones de tipo de sesión por unidad: unidad -> patrones aceptados pese a exclude_session_patterns (p.ej. taller solo en Arte y Diseño). */
  session_type_excepciones?: Record<string, string[]>;
  /**
   * Selección de criterios POR CATEGORÍA (contrato calc_muestra_criterios_*):
   * reemplaza los patrones por substring por sets de categorías normalizadas
   * con excepciones por facultad. Aditivo y retro-compat: si no viene, el marco
   * sale del path legacy de patrones bit a bit idéntico. Lo puebla la suite de
   * criterios del marco a partir de `frame.criterios_catalogo`. */
  criterios_seleccion?: CriteriosSeleccionMarco;
  /** Clave = NOMBRE de la unidad tal como aparece en la base; el motor matchea por slug interno. */
  nivel_por_unidad?: Record<string, Array<{ min: number; max: number }>>;
  accepted_campuses?: string[];
  /** LEGACY referencial: prevalencia de elegibles sobre la matrícula del
   *  curso-horario. NO es el criterio 8 — se muestra como métrica referencial. */
  require_min_prevalence?: boolean;
  min_prevalence_pct?: number;
  /** Criterio 8 · paso 1 (reunión Ramiro 2026-07-15): ≥ pct de los matriculados
   *  pertenecen a la MISMA FACULTAD del curso. Se evalúa ANTES que el paso 2. */
  require_faculty_prevalence?: boolean;
  min_faculty_prevalence_pct?: number;
  /** Criterio 8 · paso 2: ≥ pct cursan el MISMO NIVEL del curso (el backend
   *  redefine la referencia al nivel del curso, no al ciclo del estudiante). */
  require_cycle_homogeneity?: boolean;
  min_cycle_homogeneity_pct?: number;
  usar_grupos_tamano: boolean;
  grupos_tamano: CalcMuestraWorkspaceAulasSizeGroup[];
  estratos_selector: string[];
  balance_vars?: string[];
  spread_vars?: string[];
  candidate_pool_size?: number;
  simulation_runs?: number;
  mos_strategy?: string;
  coordination_mode?: string;
  replacement_depth_strategy?: "max_complete_chains_by_cell" | string;
  min_replacements_per_titular?: number;
  max_replacements_per_titular?: number;
  extra_pool_policy?: "leftover_after_chains" | "none" | string;
  replacement_equivalence_vars?: string[];
  replacement_score_weights?: Record<string, number>;
  bolsas_reemplazo: number;
  aulas_extra_operativas_default: number;
  penalizacion_repetidos: number;
  /** Descuento secuencial de repetidos (reunión Ramiro §10): al elegir un
   *  aula, sus alumnos se descuentan de las candidatas restantes (un aula
   *  grande ya cubierta deja de pesar como grande). Engine y frontend lo
   *  encienden por defecto; FALSE explícito conserva corridas históricas. */
  sequential_discount?: boolean;
  pps_weight: number;
  coverage_weight: number;
  monte_carlo_n: number;
  semilla: number;
  objective?: CalcMuestraAulasObjectiveConfig;
  notas_metodologicas?: string;
  /**
   * Decisiones MANUALES sobre las particularidades detectadas del marco
   * (reunión del diseño muestral 2026-07-15: los casos se detectan y muestran;
   * la decisión es del usuario, documentada). Clave = id del curso-horario del
   * bloque `frame.particularidades`. "excluir" saca el aula del marco al
   * RECONSTRUIR (paso "Particularidades (decisión manual)" del embudo);
   * "incluir"/"revisado" solo documentan. Retrocompatible: puede no venir.
   */
  particularidades_decisiones?: Record<string, CalcMuestraParticularidadDecision>;
};

/** Decisión manual documentada sobre una particularidad del marco. */
export type CalcMuestraParticularidadDecision = {
  decision: "incluir" | "excluir" | "revisado";
  nota?: string;
};

export type CalcMuestraWorkspaceSourceMode =
  | "base_madre"
  | "dos_bases"
  | "seleccion_existente";

export type CalcMuestraWorkspaceSourceBinding = {
  id: string;
  role: "base_madre" | "estudiantes" | "catalogo_curso_horario" | "inscripciones" | "muestra_previa" | "agenda" | string;
  label: string;
  status?: "pendiente" | "declarada" | "cargada" | "validada" | "revisar" | string;
  file_id?: string;
  file_name?: string;
  spreadsheet_id?: string;
  sheet_name?: string;
  available_sheets?: string[];
  suggested_sheet?: string;
  detected_role?: string;
  compatibility_status?: string;
  sheet_diagnostics?: CalcMuestraAulasSheetInspectionSheet[];
  range?: string;
  rows?: number;
  columns?: number;
  notes?: string;
};

export type CalcMuestraAulasSheetInspectionSheet = {
  name: string;
  rows_preview?: number;
  columns?: number;
  columns_sample?: string[];
  role?: string;
  role_label?: string;
  confidence?: number;
};

export type CalcMuestraAulasFileInspection = {
  type?: "workbook" | "table" | string;
  sheets: CalcMuestraAulasSheetInspectionSheet[];
  suggested_sheet?: string;
  suggested_role?: string;
  has_base_madre?: boolean;
  sheet_names?: string[];
};

export type CalcMuestraWorkspaceVariableMapping = {
  role: string;
  label: string;
  required?: boolean;
  source_role?: string;
  column?: string;
  description?: string;
};

export type CalcMuestraWorkspaceCategoryValueMapping = {
  raw: string;
  label: string;
  include?: boolean;
  notes?: string;
};

export type CalcMuestraWorkspaceCategoryMapping = {
  role: string;
  label?: string;
  source_role?: string;
  column?: string;
  values: CalcMuestraWorkspaceCategoryValueMapping[];
};

export type CalcMuestraWorkspacePublicationConfig = {
  google_sheets_enabled?: boolean;
  spreadsheet_id?: string;
  spreadsheet_url?: string;
  publication_mode?: "single_spreadsheet_multi_sheet" | "separate_outputs" | string;
  internal_sheet_name?: string;
  client_sheet_name?: string;
  frame_sheet_name?: string;
  sample_calculation_sheet_name?: string;
  classroom_selection_sheet_name?: string;
  replacement_sheet_name?: string;
  operational_routes_sheet_name?: string;
  agenda_sheet_name?: string;
  monitoring_handoff_sheet_name?: string;
  methodology_sheet_name?: string;
  include_workbook?: boolean;
  include_methodology?: boolean;
  include_frame_audit?: boolean;
  include_sample_calculation?: boolean;
  include_classroom_selection?: boolean;
  include_replacements?: boolean;
  pii_policy?: "sin_pii_cliente" | "interno_trazabilidad" | string;
};

/** Una corrida registrada del desk (cálculo de muestra o selección de aulas).
 *  Vive en workspace.run_history (cap 12, FIFO) para comparar dos diseños. */
export type CalcMuestraCorridaTipo = "calculo" | "seleccion";

export type CalcMuestraCorrida = {
  id: string;
  /** ISO-8601 del momento en que terminó la corrida. */
  timestamp: string;
  tipo: CalcMuestraCorridaTipo;
  /** Técnica del cálculo o método selector de aulas, según el tipo. */
  metodo?: string;
  semilla?: number;
  n_objetivo?: number;
  /** Parámetros clave: cálculo (z/e/p/deff/sobremuestra) o selección (waves / objetivo de aulas). */
  parametros?: {
    confianza?: number;
    z?: number;
    e?: number;
    p?: number;
    deff?: number;
    sobremuestra?: number;
    waves?: number;
    aulas_objetivo?: number;
  };
  /** Resumen de resultados para comparar corridas lado a lado. */
  resumen?: {
    n?: number;
    titulares?: number;
    reservas?: number;
    esperados?: number;
    representatividad?: number;
  };
};

/** Estado persistido del Motor/Recorrido muestral. Passthrough para el backend:
 *  la semántica de perfil/decisiones vive en la capa dominio del frontend.
 *  Retrocompatible: proyectos viejos no lo traen. */
export type CalcMuestraWorkspaceMotorRecorrido = {
  schema: "calc_muestra_workspace_motor_v1" | string;
  fuente: "proyecto" | "manual" | string;
  perfil: Record<string, unknown> | null;      // PerfilInstitucional serializado
  decisiones: Record<string, unknown> | null;  // DecisionesRecorrido serializado
  tocado: boolean;
  actualizado_at?: string;
};

export type CalcMuestraWorkspace = {
  version: 2;
  frame_mode: CalcMuestraWorkspaceFrameMode;
  marco_disponible: string;
  fuente_marco: string;
  unidad_observacion: string;
  unidad_muestreo: string;
  variables_control: CalcMuestraWorkspaceVariableControl[];
  escenarios: CalcMuestraWorkspaceEscenario[];
  notas_diseno: string;
  aulas_config?: CalcMuestraWorkspaceAulasConfig;
  source_mode?: CalcMuestraWorkspaceSourceMode;
  source_bindings?: CalcMuestraWorkspaceSourceBinding[];
  variable_mappings?: CalcMuestraWorkspaceVariableMapping[];
  category_mappings?: CalcMuestraWorkspaceCategoryMapping[];
  publication_config?: CalcMuestraWorkspacePublicationConfig;
  /** Mini-historial de corridas (cálculo/selección), últimas 12 en orden cronológico.
   *  Campo retrocompatible: proyectos viejos no lo traen (leer con fallback []). */
  run_history?: CalcMuestraCorrida[];
  /** Estado del Motor/Recorrido muestral (retrocompatible: puede no venir). */
  motor_recorrido?: CalcMuestraWorkspaceMotorRecorrido | null;
  /** Etapa del estudio: "propuesta" (data del semestre anterior, para diseñar y
   *  presupuestar) o "campo" (base de DTI del semestre de aplicación). Distinción
   *  canónica del método HSyVBG. Retrocompatible: default "propuesta". */
  etapa?: "propuesta" | "campo";
};

export type CalcMuestraEstudio = {
  version: number;
  id: string;
  titulo: string;
  fecha_creacion: string;
  modo_trabajo: CalcMuestraModoTrabajo;
  macro_familia: CalcMuestraMacroFamilia;
  modo_sensible: boolean;
  contexto: {
    cliente: string;
    tipo_cliente: string;
    descripcion_libre: string;
  };
  componentes: CalcMuestraComponente[];
  workspace?: CalcMuestraWorkspace | null;
  decision_log?: CalcMuestraDecisionLog;
  computado_at?: string;
};

export type CalcMuestraReporteMeta = {
  disponible: boolean;
  generated_at?: string | null;
  formato?: "html" | "pdf" | null;
  job_id?: string | null;
  /** true cuando el estudio cambió (componentes/parámetros) después de generar
   *  el reporte: sigue descargable pero quedó desactualizado. Retrocompatible:
   *  backends viejos no lo emiten. */
  stale?: boolean;
};

/** Paso de un embudo agregado del perfil (alumno o aula): conteo restante y excluidos del paso. */
export type CalcMuestraAulasPerfilEmbudoPaso = {
  id: string;
  label: string;
  conteo: number;
  excluidos: number;
};

/** Agregados por unidad académica del perfil (facultad/escuela) sobre el marco depurado. */
export type CalcMuestraAulasPerfilFacultad = {
  id: string;
  nombre: string;
  /** Población objetivo (elegibles) de la unidad. */
  n: number;
  /** Conteos de los dos valores de sexo más frecuentes (orden de sexo_labels). */
  sexo_1_n: number;
  sexo_2_n: number;
  /** Mediana/media de ELEGIBLES por aula en el marco depurado (null si no computable). */
  est_aula_mediana: number | null;
  est_aula_media: number | null;
  /** Elegibles alcanzables por el cruce alumno × aula. */
  alcanzables: number;
  /** Aulas del marco depurado que pertenecen a la unidad. */
  aulas_marco: number;
};

/** Impacto medido de un criterio opcional del marco (c7 prevalencia / c8 homogeneidad). */
export type CalcMuestraAulasPerfilOpcional = {
  id: string;
  aplicado: boolean;
  /** Umbral en proporción 0..1 (0.8 = 80%). */
  umbral: number;
  /** Aulas que quedarían en el marco con el criterio activo. */
  aulas: number;
  /** Cobertura resultante del cruce (proporción 0..1). */
  cobertura_pct: number;
  /** Unidades académicas cuya cuota se rompe con el criterio activo. */
  unidades_rotas: string[];
};

/** Perfil institucional agregado que el backend adjunta al frame de aulas
 *  (schema "calc_muestra_aulas_perfil_v1"). Alimenta el Recorrido muestral:
 *  la conversión a PerfilInstitucional vive en calcMuestra/dominio/adaptador.ts.
 *  Retrocompatible: frames viejos persistidos no lo traen. */
export type CalcMuestraAulasPerfil = {
  schema: "calc_muestra_aulas_perfil_v1" | string;
  /** Estudiantes únicos en la base leída. */
  universo: number;
  /** Estudiantes únicos elegibles (población objetivo N). */
  poblacion_n: number;
  /** Curso-horario únicos de la base. */
  aulas_totales: number;
  /** Aulas del marco depurado (included). */
  marco_aulas: number;
  /** 0..2 valores de sexo más frecuentes, en orden de frecuencia descendente. */
  sexo_labels: string[];
  /** Ids posibles: "universo", "pregrado", "regular", "mayor-edad" (pasos no aplicables se omiten). */
  embudo_alumno: CalcMuestraAulasPerfilEmbudoPaso[];
  /** Ids posibles, en orden: "total", "presencial", "tipo", "sede", "elegibles",
   *  "docente", "nivel", "c7", "c8" (pasos no aplicables se omiten);
   *  el último conteo == marco_aulas. */
  embudo_aula: CalcMuestraAulasPerfilEmbudoPaso[];
  facultades: CalcMuestraAulasPerfilFacultad[];
  /** Cobertura global del cruce alumno × aula (pct en proporción 0..1, null si no computable). */
  cobertura: { elegibles: number; alcanzables: number; pct: number | null };
  /** Aulas del marco con SOLO reglas base (sin opcionales). Retrocompatible: frames viejos no lo traen. */
  marco_base_aulas?: number;
  /** Impacto medido de los opcionales; SIEMPRE presente en frames nuevos, ausente en los viejos. */
  opcionales?: {
    c7?: CalcMuestraAulasPerfilOpcional;
    c8?: CalcMuestraAulasPerfilOpcional;
  } | null;
};

// ---------------------------------------------------------------------------
// Suite de criterios de inclusión/exclusión POR CATEGORÍA del marco de aulas.
// Contrato compartido con el motor R (calc_muestra_criterios_*): el catálogo lo
// EMITE el motor (categorías reales enumeradas + conteo por aula); la selección
// la MANDA la UI (reemplaza los patrones por substring de aulas_config).
// ---------------------------------------------------------------------------

/** Scope del criterio: define la POBLACIÓN (alumno) o el MARCO de aulas (aula). */
export type CriterioScope = "alumno" | "aula";

/**
 * Forma de selección de una variable de criterio:
 *  - flat: categorías planas (checkboxes).
 *  - hierarchical: grupos por prefijo con hijos (tipo de docente).
 *  - range: rango [min,max] por facultad (nivel de curso).
 *  - numeric: umbral (>=/<=) o rango entre valores (edad).
 *  - ordinal: valores ordenados; set o "desde N en adelante" (ciclo).
 */
export type CriterioKind = "flat" | "hierarchical" | "range" | "numeric" | "ordinal";

/**
 * Capa donde se aplica un criterio de ALUMNO:
 *  - marco: filtra la población que entra al cálculo (afecta N y cuotas).
 *  - instrumento: NO reduce el marco; se valida en el cuestionario (filtro).
 *  - procesamiento: se aplica post-campo.
 */
export type CriterioLayer = "marco" | "instrumento" | "procesamiento";

/** CH de una categoría dentro de una facultad (distribución por facultad). */
export type CriterioCategoriaFacultadCh = {
  /** Nombre de la facultad tal como lo emite el motor (join defensivo por label). */
  facultad: string;
  /** Cursos-horario de la categoría en esa facultad (deduplicados). */
  ch: number;
};

/** Una categoría enumerada de una variable, con su conteo por aula única. */
export type CriterioCategoria = {
  /** Categoría NORMALIZADA (clave de match, autoritativa). */
  key: string;
  /** Etiqueta legible para la UI. */
  label: string;
  /** Conteo por aula única (cuántas aulas caen en esta categoría). */
  aulas: number;
  /** Variantes crudas plegadas en esta categoría (informativo). */
  variants?: string[];
  /**
   * Distribución de la categoría por facultad (ordenada ch desc; la suma
   * iguala `aulas`). Retrocompatible: catálogos viejos no la traen y la vista
   * por facultad degrada a filas sin barras.
   */
  por_facultad?: CriterioCategoriaFacultadCh[];
};

/** Un grupo jerárquico (prefijo) de categorías, p. ej. DOCENTE ORDINARIO. */
export type CriterioGrupo = {
  key: string;
  label: string;
  /** Conteo por aula del grupo (unión de sus hijos, "al menos uno"). */
  aulas: number;
  children: CriterioCategoria[];
};

/** Rango numérico observado (edad): valores extremos presentes en la base. */
export type CriterioNumericRange = { min: number; max: number };

/** Una variable del catálogo de criterios, según su scope y forma de selección. */
export type CriterioVariable = {
  /** "formation" | "condition" | "age" | "faculty" | "level" | "modality" | "session_type" | "teacher_type" | "course_level" | ... */
  id: string;
  /** alumno (población N) o aula (marco). */
  scope: CriterioScope;
  label: string;
  kind: CriterioKind;
  /** Columna del Excel mapeada al rol; null si la variable no está mapeada. */
  mappedColumn?: string | null;
  /** flat: categorías planas seleccionables. */
  categories?: CriterioCategoria[];
  /** hierarchical: grupos por prefijo con hijos. */
  groups?: CriterioGrupo[];
  /** range/ordinal: valores disponibles (0..N). */
  values?: number[];
  /** numeric: rango observado en la base. */
  numericRange?: CriterioNumericRange;
  /** alumno: capa por defecto del preset (marco/instrumento/procesamiento). */
  defaultLayer?: CriterioLayer;
  /** faculty: además de filtrar, estratifica (no excluye a nadie por sí solo). */
  estratifica?: boolean;
};

/** Catálogo completo emitido por el motor para poblar la suite (ambos scopes). */
export type CriteriosCatalogo = {
  schema?: "calc_muestra_criterios_catalogo_v1" | string;
  variables: CriterioVariable[];
};

/** Umbral/rango numérico de una selección (edad). */
export type CriterioThreshold = { op: ">=" | "<=" | "between"; min?: number; max?: number };

/** Selección de una variable (reemplaza patrones; aditivo y retro-compat). */
export type CriterioSeleccion = {
  /** Semántica del set (default include). */
  mode: "include" | "exclude";
  /** Claves normalizadas seleccionadas (flat/hierarchical). */
  categories?: string[];
  /** Multi-valor por aula: "any" (docente) o "all". */
  match?: "any" | "all";
  /** Facultad (clave normalizada) -> override del set. */
  exceptions?: Record<string, { categories: string[]; op?: "add" | "replace" }>;
  /** numeric: umbral o rango (edad). */
  threshold?: CriterioThreshold;
  /** ordinal: valores incluidos explícitos (ciclos). */
  includeValues?: number[];
  /** ordinal: "desde N en adelante" (mutuamente exclusivo con includeValues). */
  fromValue?: number;
  /** alumno: capa donde se aplica el criterio (default = variable.defaultLayer). */
  layer?: CriterioLayer;
};

/** Selección completa de criterios del marco que la UI manda al motor. */
export type CriteriosSeleccionMarco = {
  /** modality, session_type, teacher_type, ... */
  byVariable: Record<string, CriterioSeleccion>;
  /** facultad -> rangos [min,max] admitidos del nivel del curso. */
  courseLevelRanges?: Record<string, Array<[number, number]>>;
  /** Umbral de elegibles por aula (flexeable por facultad). `attendance_rate`
   *  es la tasa de asistencia esperada (proporción 0–1): informativa, alimenta
   *  la SUGERENCIA de mínimos (ceil(mínimo/tasa)) pero NO altera el umbral
   *  efectivo — se persiste para trazabilidad del diseño. */
  minEligible?: { threshold: number; byFaculty?: Record<string, number>; attendance_rate?: number };
  /** Cursos-horario apagados a mano (por `classroom_id`): el criterio más
   *  granular del marco. Sale del marco al reconstruir; nunca incluye, solo
   *  excluye. Se compara por text_key en el motor. */
  manualExcludedClassrooms?: string[];
};

/**
 * Normalizador defensivo del catálogo de criterios (patrón
 * normalizeGraficosShareInspect): Plumber serializa escalares como arrays de 1
 * y los conteos pueden llegar como strings; todo se coacciona antes de usarse.
 * Un payload ausente o corrupto degrada a { variables: [] } sin romper la UI.
 */
export function normalizeCriteriosCatalogo(raw: unknown): CriteriosCatalogo {
  const unwrap = (v: unknown): unknown => (Array.isArray(v) ? (v.length > 0 ? v[0] : null) : v);
  const asText = (v: unknown): string => {
    const u = unwrap(v);
    if (typeof u === "string") return u;
    if (typeof u === "number" && Number.isFinite(u)) return String(u);
    return "";
  };
  const asNum = (v: unknown): number => {
    const u = unwrap(v);
    if (typeof u === "number") return Number.isFinite(u) ? u : 0;
    if (typeof u === "string") {
      const n = Number(u.trim());
      return Number.isFinite(n) ? n : 0;
    }
    return 0;
  };
  const asList = (v: unknown): unknown[] => {
    if (v == null) return [];
    return Array.isArray(v) ? v : [v];
  };
  const asRecord = (v: unknown): Record<string, unknown> => {
    const u = unwrap(v);
    return typeof u === "object" && u !== null && !Array.isArray(u) ? (u as Record<string, unknown>) : {};
  };
  const categoria = (v: unknown): CriterioCategoria | null => {
    const r = asRecord(v);
    const key = asText(r.key) || asText(r.category) || asText(r.raw);
    if (!key) return null;
    const variants = asList(r.variants).map(asText).filter(Boolean);
    // Distribución por facultad (contrato «Tipo de sesión por facultad»):
    // lista {facultad, ch} ordenada ch desc. Defensivo: filas sin facultad se
    // descartan y facultades repetidas se pliegan a la primera aparición.
    const facSeen = new Set<string>();
    const por_facultad = asList(r.por_facultad)
      .map((rawFac): CriterioCategoriaFacultadCh | null => {
        const f = asRecord(rawFac);
        const facultad = asText(f.facultad);
        if (!facultad) return null;
        return { facultad, ch: Math.max(0, Math.round(asNum(f.ch ?? f.aulas ?? f.count))) };
      })
      .filter((f): f is CriterioCategoriaFacultadCh => {
        if (!f) return false;
        const marker = f.facultad.trim().toLowerCase();
        if (facSeen.has(marker)) return false;
        facSeen.add(marker);
        return true;
      });
    return {
      key,
      label: asText(r.label) || key,
      aulas: asNum(r.aulas ?? r.count ?? r.n),
      ...(variants.length ? { variants } : {}),
      ...(por_facultad.length ? { por_facultad } : {}),
    };
  };
  const asLayer = (v: unknown): CriterioLayer | undefined => {
    const t = asText(v);
    return t === "marco" || t === "instrumento" || t === "procesamiento" ? t : undefined;
  };
  const raw2 = asRecord(raw);
  const variables = asList(raw2.variables)
    .map((rawVar): CriterioVariable | null => {
      const r = asRecord(rawVar);
      const id = asText(r.id);
      if (!id) return null;
      const kindText = asText(r.kind);
      const kind: CriterioKind =
        kindText === "hierarchical" || kindText === "range" || kindText === "numeric" || kindText === "ordinal"
          ? kindText
          : "flat";
      const scope: CriterioScope = asText(r.scope) === "alumno" ? "alumno" : "aula";
      const categories = asList(r.categories)
        .map(categoria)
        .filter((c): c is CriterioCategoria => c != null);
      const groups = asList(r.groups)
        .map((rawGroup): CriterioGrupo | null => {
          const g = asRecord(rawGroup);
          const key = asText(g.key);
          if (!key) return null;
          const children = asList(g.children)
            .map(categoria)
            .filter((c): c is CriterioCategoria => c != null);
          return {
            key,
            label: asText(g.label) || key,
            aulas: asNum(g.aulas ?? g.count ?? g.n),
            children,
          };
        })
        .filter((g): g is CriterioGrupo => g != null);
      const values = asList(r.values)
        .map(asNum)
        .filter((n) => Number.isFinite(n));
      const rangeRaw = asRecord(r.numericRange ?? r.numeric_range);
      const numericRange =
        Object.keys(rangeRaw).length > 0
          ? { min: asNum(rangeRaw.min), max: asNum(rangeRaw.max) }
          : undefined;
      const mappedColumnText = asText(r.mappedColumn ?? r.mapped_column ?? r.column);
      const defaultLayer = asLayer(r.defaultLayer ?? r.default_layer);
      const estratifica = unwrap(r.estratifica) === true;
      return {
        id,
        scope,
        label: asText(r.label) || id,
        kind,
        mappedColumn: mappedColumnText ? mappedColumnText : null,
        ...(categories.length ? { categories } : {}),
        ...(groups.length ? { groups } : {}),
        ...(values.length ? { values } : {}),
        ...(numericRange ? { numericRange } : {}),
        ...(defaultLayer ? { defaultLayer } : {}),
        ...(estratifica ? { estratifica } : {}),
      };
    })
    .filter((v): v is CriterioVariable => v != null);
  return {
    ...(asText(raw2.schema) ? { schema: asText(raw2.schema) } : {}),
    variables,
  };
}

export type CalcMuestraAulasRelationAuditIssue = {
  code?: string;
  severity?: string;
  title?: string;
  detail?: string;
  [key: string]: unknown;
};

/**
 * Auditoría de la relación base principal ↔ catálogo calculada por R.
 * Todos los campos son opcionales para conservar la lectura de frames previos;
 * `status` queda abierto porque el frontend debe fallar cerrado ante valores
 * nuevos, no impedir que el payload se cargue.
 */
export type CalcMuestraAulasRelationAudit = {
  used?: boolean;
  status?: string;
  base_rows?: number;
  catalog_rows?: number;
  base_rows_with_key?: number;
  base_classrooms?: number;
  catalog_classrooms?: number;
  matched_rows?: number;
  matched_classrooms?: number;
  unmatched_base_classrooms?: number;
  catalog_only_classrooms?: number;
  duplicate_catalog_keys?: number;
  match_rate_rows?: number;
  match_rate_classrooms?: number;
  unmatched_base_preview?: string[];
  catalog_only_preview?: string[];
  duplicate_catalog_preview?: string[];
  issues?: CalcMuestraAulasRelationAuditIssue[] | Record<string, unknown>;
  [key: string]: unknown;
};

export type CalcMuestraAulasFrame = {
  schema: "calc_muestra_aulas_frame_v1" | string;
  generated_at: string;
  input_mode: "base_madre" | "dos_bases" | string;
  config: Record<string, unknown>;
  frame_hash: string;
  population?: MonitoreoRow[];
  /**
   * Universo de estudiantes SIN filtrar por elegibilidad, con atributos crudos
   * por estudiante (student_id/faculty/level/age/formation/condition). Lo usa el
   * conteo EN VIVO de criterios de alumno (criteriosImpacto): `population` ya
   * viene recortada por edad/condición/formación y no permite recomputarlos.
   */
  population_pool?: MonitoreoRow[];
  aula_frame: MonitoreoRow[];
  exclusions?: MonitoreoRow[];
  category_profiles?: MonitoreoRow[];
  audit: MonitoreoRow[];
  catalog_audit?: Record<string, unknown>;
  relation_audit?: CalcMuestraAulasRelationAudit;
  warnings: string[];
  methodology?: Record<string, unknown>;
  /** Perfil agregado para el Recorrido muestral (retrocompatible: puede no venir). */
  perfil?: CalcMuestraAulasPerfil | null;
  /**
   * Catálogo de criterios por categoría (categorías reales enumeradas de la
   * base + conteo por aula). Retrocompatible: frames viejos no lo traen. El
   * consumidor debe pasarlo por `normalizeCriteriosCatalogo` (payload crítico).
   */
  criterios_catalogo?: CriteriosCatalogo | null;
  /** Selección de criterios con la que se construyó este marco (para detectar
   *  "marco desactualizado" comparándola con la selección confirmada actual). */
  criterios_seleccion?: CriteriosSeleccionMarco | null;
  /** Eco de los filtros normalizados con que el backend construyó el marco
   *  (criterio 8 · composición del aula + prevalencia referencial c7). Sirve
   *  para la señal de frescura del marco. Retrocompatible: marcos viejos no
   *  lo traen y NUNCA se marcan desactualizados por esta vía. */
  filters_echo?: CalcMuestraAulasFrameFiltersEcho | null;
  /**
   * Particularidades DETECTADAS del marco (schema
   * calc_muestra_aulas_particularidades_v1): señales para revisión manual, no
   * decisiones. Retrocompatible: marcos viejos no lo traen. El consumidor debe
   * pasarlo por `normalizeCalcMuestraAulasParticularidades` (payload crítico).
   */
  particularidades?: CalcMuestraAulasParticularidades | null;
  /**
   * Radiografía del marco por facultad (contrato congelado
   * calc_muestra_aulas_exploracion_v1): dónde están los alumnos elegibles por
   * tipo de sesión y nivel, cursos en locales externos y multi-facultad.
   * Retrocompatible: marcos viejos no lo traen — la pestaña Explorador muestra
   * su estado vacío honesto. El consumidor debe pasarlo por
   * `normalizeCalcMuestraAulasExploracion` (payload crítico).
   */
  exploracion?: CalcMuestraAulasExploracion | null;
  /**
   * Radiografía estadística por criterio × facultad × categoría, calculada
   * íntegramente por el engine R (schema
   * calc_muestra_aulas_criterios_radiografia_v1). Es sibling de `exploracion`:
   * esta última conserva el resumen legacy; el consumidor debe normalizar este
   * payload crítico antes de acreditar cuantiles, medias o deltas marginales.
   */
  criterios_radiografia?: CalcMuestraAulasCriteriosRadiografia | null;
  /**
   * Impacto de los tipos de sesión EXCLUIDOS del set global, por facultad
   * (contrato congelado cm_session_type_impacto_v1): qué facultades pierden CH
   * y elegibles por cada tipo excluido, y dónde ya está exceptuado.
   * Retrocompatible: marcos viejos no lo traen — sin el campo la tarjeta se
   * comporta como hoy (sin aviso). El consumidor debe pasarlo por
   * `normalizeCalcMuestraSessionTypeImpacto` (payload crítico).
   */
  session_type_impacto?: CalcMuestraSessionTypeImpacto | null;
};

// ----------------------------------------------------------------------------
// Particularidades del marco de aulas (contrato congelado
// calc_muestra_aulas_particularidades_v1, reunión del diseño muestral
// 2026-07-15). La app las DETECTA y MUESTRA; la decisión es del usuario y vive
// en aulas_config.particularidades_decisiones.
// ----------------------------------------------------------------------------

/** Señal de tipo de curso agrupado: una sola categoría domina el catálogo. */
export type CalcMuestraAulasParticularidadSessionType = {
  categoria: string;
  /** Proporción 0..1 de cursos-horario en la categoría dominante. */
  share: number;
  total_categorias: number;
};

/** Curso-horario que sirve a dos o más facultades (estudios generales/electivo compartido). */
export type CalcMuestraAulasParticularidadMultiFacultad = {
  id: string;
  curso: string;
  facultades: string[];
  n_facultades: number;
};

/** Curso-horario con código Z (se dicta en un local externo). */
export type CalcMuestraAulasParticularidadCodigoZ = {
  id: string;
  curso: string;
  codigo: string;
};

/** Curso-horario cuyo nombre sugiere tesis/trabajo de grado. */
export type CalcMuestraAulasParticularidadNombreTesis = {
  id: string;
  curso: string;
  nivel: string;
};

export type CalcMuestraAulasParticularidades = {
  schema?: "calc_muestra_aulas_particularidades_v1" | string;
  session_type_dominante: CalcMuestraAulasParticularidadSessionType | null;
  /** Cap 200 filas en el backend; `counts` conserva los totales reales. */
  multi_facultad: CalcMuestraAulasParticularidadMultiFacultad[];
  codigo_z: CalcMuestraAulasParticularidadCodigoZ[];
  nombre_tesis: CalcMuestraAulasParticularidadNombreTesis[];
  counts: { multi_facultad: number; codigo_z: number; nombre_tesis: number };
};

/**
 * Normalizador defensivo de `frame.particularidades` (patrón
 * normalizeGraficosShareInspect): jsonlite desempaca arrays de 1 a escalares,
 * los números pueden llegar como strings y los NA como "NA". Payload ausente o
 * sin forma reconocible ⇒ null (la UI se comporta como hoy: sin panel).
 */
export function normalizeCalcMuestraAulasParticularidades(
  raw: unknown,
): CalcMuestraAulasParticularidades | null {
  if (raw == null || typeof raw !== "object") return null;
  const unwrap = (v: unknown): unknown => (Array.isArray(v) ? (v.length > 0 ? v[0] : null) : v);
  const asText = (v: unknown): string => {
    const u = unwrap(v);
    if (typeof u === "string") return u === "NA" ? "" : u;
    if (typeof u === "number" && Number.isFinite(u)) return String(u);
    return "";
  };
  const asNum = (v: unknown): number => {
    const u = unwrap(v);
    if (typeof u === "number") return Number.isFinite(u) ? u : 0;
    if (typeof u === "string") {
      const n = Number(u.trim());
      return Number.isFinite(n) ? n : 0;
    }
    return 0;
  };
  const asList = (v: unknown): unknown[] => {
    if (v == null) return [];
    return Array.isArray(v) ? v : [v];
  };
  const asRecord = (v: unknown): Record<string, unknown> => {
    const u = unwrap(v);
    return typeof u === "object" && u !== null && !Array.isArray(u) ? (u as Record<string, unknown>) : {};
  };
  const asTextList = (v: unknown): string[] =>
    asList(v).map((item) => asText(item)).filter(Boolean);

  const r = raw as Record<string, unknown>;

  const domRec = asRecord(r.session_type_dominante);
  const domCategoria = asText(domRec.categoria);
  const session_type_dominante: CalcMuestraAulasParticularidadSessionType | null = domCategoria
    ? {
        categoria: domCategoria,
        share: Math.min(1, Math.max(0, asNum(domRec.share))),
        total_categorias: Math.max(0, Math.round(asNum(domRec.total_categorias))),
      }
    : null;

  const multi_facultad = asList(r.multi_facultad)
    .map((item): CalcMuestraAulasParticularidadMultiFacultad | null => {
      const row = asRecord(item);
      const id = asText(row.id);
      if (!id) return null;
      const facultades = asTextList(row.facultades);
      return {
        id,
        curso: asText(row.curso),
        facultades,
        n_facultades: Math.max(facultades.length, Math.round(asNum(row.n_facultades))),
      };
    })
    .filter((row): row is CalcMuestraAulasParticularidadMultiFacultad => row != null);

  const codigo_z = asList(r.codigo_z)
    .map((item): CalcMuestraAulasParticularidadCodigoZ | null => {
      const row = asRecord(item);
      const id = asText(row.id);
      if (!id) return null;
      return { id, curso: asText(row.curso), codigo: asText(row.codigo) };
    })
    .filter((row): row is CalcMuestraAulasParticularidadCodigoZ => row != null);

  const nombre_tesis = asList(r.nombre_tesis)
    .map((item): CalcMuestraAulasParticularidadNombreTesis | null => {
      const row = asRecord(item);
      const id = asText(row.id);
      if (!id) return null;
      return { id, curso: asText(row.curso), nivel: asText(row.nivel) };
    })
    .filter((row): row is CalcMuestraAulasParticularidadNombreTesis => row != null);

  const countsRec = asRecord(r.counts);
  const counts = {
    multi_facultad: Math.max(multi_facultad.length, Math.round(asNum(countsRec.multi_facultad))),
    codigo_z: Math.max(codigo_z.length, Math.round(asNum(countsRec.codigo_z))),
    nombre_tesis: Math.max(nombre_tesis.length, Math.round(asNum(countsRec.nombre_tesis))),
  };

  // Sin NINGUNA señal ni schema reconocible, el payload no aporta nada: null
  // honesto (estado vacío del panel) en vez de un objeto todo-ceros ambiguo.
  const schema = asText(r.schema);
  const haySenales = Boolean(
    session_type_dominante ||
    counts.multi_facultad > 0 ||
    counts.codigo_z > 0 ||
    counts.nombre_tesis > 0,
  );
  if (!haySenales && !schema) return null;

  return {
    ...(schema ? { schema } : {}),
    session_type_dominante,
    multi_facultad,
    codigo_z,
    nombre_tesis,
    counts,
  };
}

// ----------------------------------------------------------------------------
// Exploración del marco de aulas (contrato congelado
// calc_muestra_aulas_exploracion_v1, reunión del diseño muestral 2026-07-15):
// radiografía por facultad para elegir aulas con conocimiento del terreno.
// Datos transparentes — nunca un score compuesto de caja negra.
// ----------------------------------------------------------------------------

/** Distribución de una facultad por tipo de sesión (dónde están sus alumnos). */
export type CalcMuestraAulasExploracionTipoSesion = {
  tipo: string;
  ch: number;
  ch_elegibles: number;
  elegibles: number;
  /** Media de elegibles de los CH incluidos de este tipo. Se expone aparte de
   *  la mediana para VER la distorsión de las aulas gigantes (reunión Ramiro
   *  §9): media > mediana señala aulas de ~100 que jalan el promedio. `null`
   *  sin CH incluidos con dato. */
  media_elegibles: number | null;
  /** Resumen de 5 números de elegibles por aula sobre los CH INCLUIDOS de este
   *  tipo (min · Q1 · mediana · Q3 · max), para dibujar un boxplot robusto por
   *  tipo. Mismo subset y NA honesto que `mediana_elegibles`: `null` cuando no
   *  hay cifra defendible (un 0 mentiría que el aula típica está vacía). */
  elegibles_min: number | null;
  elegibles_q1: number | null;
  /** Mediana (Q2) de elegibles del aula típica INCLUIDA de este tipo (la cifra
   *  que dice si esas aulas cubren la cuota). */
  mediana_elegibles: number | null;
  elegibles_q3: number | null;
  elegibles_max: number | null;
};

/** Distribución de una facultad por nivel del curso. */
export type CalcMuestraAulasExploracionNivel = {
  nivel: string;
  ch: number;
  elegibles: number;
  /** Mediana de elegibles del aula típica incluida en este nivel; `null` sin
   *  cifra defendible (misma semántica que en la distribución por tipo). */
  mediana_elegibles: number | null;
};

/** Distribución de una facultad por condición del curso (obligatorio/electivo/
 *  sin dato/otro). Junto al tipo define cuántas aulas sobreviven a todos los
 *  criterios (reunión Ramiro §8.2). Los CH excluidos cuentan en `ch` pero no
 *  en `ch_elegibles`/`elegibles`. */
export type CalcMuestraAulasExploracionCondicion = {
  condicion: string;
  ch: number;
  ch_elegibles: number;
  elegibles: number;
};

/** Curso-horario del top por elegibles de una facultad. */
export type CalcMuestraAulasExploracionCurso = {
  id: string;
  curso: string;
  nivel: string;
  tipo: string;
  elegibles: number;
  /** Proporción 0..1 de elegibles del aula que pertenecen a la facultad.
   *  `null` cuando el marco no pudo calcularla (NA del motor). */
  faculty_match_share: number | null;
  local_externo: boolean;
  multi_facultad: boolean;
};

export type CalcMuestraAulasExploracionFacultad = {
  facultad: string;
  ch_total: number;
  ch_elegibles: number;
  elegibles_total: number;
  est_aula_mediana: number | null;
  est_aula_media: number | null;
  por_tipo_sesion: CalcMuestraAulasExploracionTipoSesion[];
  por_nivel: CalcMuestraAulasExploracionNivel[];
  por_condicion: CalcMuestraAulasExploracionCondicion[];
  n_multi_facultad: number;
  n_local_externo: number;
  n_sin_condicion: number;
  /** Top de cursos por elegibles (cap 15 en el backend). */
  top_cursos: CalcMuestraAulasExploracionCurso[];
};

export type CalcMuestraAulasExploracionTotales = {
  facultades: number;
  ch_total: number;
  ch_elegibles: number;
  elegibles_total: number;
  n_local_externo: number;
  n_multi_facultad: number;
};

export type CalcMuestraAulasExploracion = {
  schema: "calc_muestra_aulas_exploracion_v1" | string;
  totales: CalcMuestraAulasExploracionTotales;
  por_facultad: CalcMuestraAulasExploracionFacultad[];
};

/**
 * Normalizador defensivo de `frame.exploracion` (patrón
 * normalizeGraficosShareInspect): jsonlite desempaca arrays de 1 a escalares,
 * los números pueden llegar como strings y los NA como "NA". Payload ausente o
 * sin forma reconocible ⇒ null (la pestaña Explorador muestra su estado vacío
 * honesto: «Reconstruye el marco para generar la radiografía»).
 */
export function normalizeCalcMuestraAulasExploracion(
  raw: unknown,
): CalcMuestraAulasExploracion | null {
  if (raw == null || typeof raw !== "object") return null;
  const unwrap = (v: unknown): unknown => (Array.isArray(v) ? (v.length > 0 ? v[0] : null) : v);
  const asText = (v: unknown): string => {
    const u = unwrap(v);
    if (typeof u === "string") return u === "NA" ? "" : u;
    if (typeof u === "number" && Number.isFinite(u)) return String(u);
    return "";
  };
  const asNum = (v: unknown): number => {
    const u = unwrap(v);
    if (typeof u === "number") return Number.isFinite(u) ? u : 0;
    if (typeof u === "string") {
      const n = Number(u.trim());
      return Number.isFinite(n) ? n : 0;
    }
    return 0;
  };
  /** Número que distingue "no vino / NA" (null) de un cero real. */
  const asNumOrNull = (v: unknown): number | null => {
    const u = unwrap(v);
    if (typeof u === "number") return Number.isFinite(u) ? u : null;
    if (typeof u === "string") {
      const trimmed = u.trim();
      if (!trimmed || trimmed === "NA") return null;
      const n = Number(trimmed);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  };
  const asBool = (v: unknown): boolean => {
    const u = unwrap(v);
    if (typeof u === "boolean") return u;
    if (typeof u === "number") return u === 1;
    if (typeof u === "string") {
      const t = u.trim().toLowerCase();
      return t === "true" || t === "1";
    }
    return false;
  };
  const asList = (v: unknown): unknown[] => {
    if (v == null) return [];
    return Array.isArray(v) ? v : [v];
  };
  const asRecord = (v: unknown): Record<string, unknown> => {
    const u = unwrap(v);
    return typeof u === "object" && u !== null && !Array.isArray(u) ? (u as Record<string, unknown>) : {};
  };
  const asCount = (v: unknown): number => Math.max(0, Math.round(asNum(v)));

  const r = raw as Record<string, unknown>;

  const por_facultad = asList(r.por_facultad)
    .map((item): CalcMuestraAulasExploracionFacultad | null => {
      const row = asRecord(item);
      const facultad = asText(row.facultad);
      if (!facultad) return null;
      const por_tipo_sesion = asList(row.por_tipo_sesion)
        .map((tipoItem): CalcMuestraAulasExploracionTipoSesion | null => {
          const tipoRow = asRecord(tipoItem);
          const tipo = asText(tipoRow.tipo);
          if (!tipo) return null;
          return {
            tipo,
            ch: asCount(tipoRow.ch),
            ch_elegibles: asCount(tipoRow.ch_elegibles),
            elegibles: asCount(tipoRow.elegibles),
            media_elegibles: asNumOrNull(tipoRow.media_elegibles),
            elegibles_min: asNumOrNull(tipoRow.elegibles_min),
            elegibles_q1: asNumOrNull(tipoRow.elegibles_q1),
            mediana_elegibles: asNumOrNull(tipoRow.mediana_elegibles),
            elegibles_q3: asNumOrNull(tipoRow.elegibles_q3),
            elegibles_max: asNumOrNull(tipoRow.elegibles_max),
          };
        })
        .filter((tipoRow): tipoRow is CalcMuestraAulasExploracionTipoSesion => tipoRow != null);
      const por_nivel = asList(row.por_nivel)
        .map((nivelItem): CalcMuestraAulasExploracionNivel | null => {
          const nivelRow = asRecord(nivelItem);
          const nivel = asText(nivelRow.nivel);
          if (!nivel) return null;
          return {
            nivel,
            ch: asCount(nivelRow.ch),
            elegibles: asCount(nivelRow.elegibles),
            mediana_elegibles: asNumOrNull(nivelRow.mediana_elegibles),
          };
        })
        .filter((nivelRow): nivelRow is CalcMuestraAulasExploracionNivel => nivelRow != null);
      const por_condicion = asList(row.por_condicion)
        .map((condItem): CalcMuestraAulasExploracionCondicion | null => {
          const condRow = asRecord(condItem);
          const condicion = asText(condRow.condicion);
          if (!condicion) return null;
          return {
            condicion,
            ch: asCount(condRow.ch),
            ch_elegibles: asCount(condRow.ch_elegibles),
            elegibles: asCount(condRow.elegibles),
          };
        })
        .filter((condRow): condRow is CalcMuestraAulasExploracionCondicion => condRow != null);
      const top_cursos = asList(row.top_cursos)
        .map((cursoItem): CalcMuestraAulasExploracionCurso | null => {
          const cursoRow = asRecord(cursoItem);
          const id = asText(cursoRow.id);
          const curso = asText(cursoRow.curso);
          if (!id && !curso) return null;
          const shareRaw = asNumOrNull(cursoRow.faculty_match_share);
          return {
            id: id || curso,
            curso: curso || id,
            nivel: asText(cursoRow.nivel),
            tipo: asText(cursoRow.tipo),
            elegibles: asCount(cursoRow.elegibles),
            faculty_match_share: shareRaw == null ? null : Math.min(1, Math.max(0, shareRaw)),
            local_externo: asBool(cursoRow.local_externo),
            multi_facultad: asBool(cursoRow.multi_facultad),
          };
        })
        .filter((cursoRow): cursoRow is CalcMuestraAulasExploracionCurso => cursoRow != null);
      return {
        facultad,
        ch_total: asCount(row.ch_total),
        ch_elegibles: asCount(row.ch_elegibles),
        elegibles_total: asCount(row.elegibles_total),
        est_aula_mediana: asNumOrNull(row.est_aula_mediana),
        est_aula_media: asNumOrNull(row.est_aula_media),
        por_tipo_sesion,
        por_nivel,
        por_condicion,
        n_multi_facultad: asCount(row.n_multi_facultad),
        n_local_externo: asCount(row.n_local_externo),
        n_sin_condicion: asCount(row.n_sin_condicion),
        top_cursos,
      };
    })
    .filter((row): row is CalcMuestraAulasExploracionFacultad => row != null);

  const totalesRec = asRecord(r.totales);
  const totales: CalcMuestraAulasExploracionTotales = {
    facultades: Math.max(por_facultad.length, asCount(totalesRec.facultades)),
    ch_total: asCount(totalesRec.ch_total),
    ch_elegibles: asCount(totalesRec.ch_elegibles),
    elegibles_total: asCount(totalesRec.elegibles_total),
    n_local_externo: asCount(totalesRec.n_local_externo),
    n_multi_facultad: asCount(totalesRec.n_multi_facultad),
  };

  // Sin facultades ni schema reconocible, el payload no aporta nada: null
  // honesto (estado vacío de la pestaña) en vez de un objeto todo-ceros.
  const schema = asText(r.schema);
  if (!por_facultad.length && !schema) return null;

  return { schema: schema || "calc_muestra_aulas_exploracion_v1", totales, por_facultad };
}

// ----------------------------------------------------------------------------
// Impacto de tipos de sesión excluidos por facultad (contrato congelado
// cm_session_type_impacto_v1, «Tipo de sesión por facultad»). La app lo
// MUESTRA como aviso («¿es intencional?»); la decisión de exceptuar es del
// usuario y compila a `criterios_seleccion.byVariable.session_type.exceptions`.
// ----------------------------------------------------------------------------

/** Facultad afectada por un tipo de sesión excluido: CH y elegibles en juego. */
export type CalcMuestraSessionTypeImpactoFacultad = {
  facultad: string;
  ch: number;
  elegibles: number;
};

/** Un tipo de sesión excluido del set global y su impacto por facultad. */
export type CalcMuestraSessionTypeImpactoTipo = {
  /** Tipo tal como lo emite el motor (match defensivo por label contra el catálogo). */
  tipo: string;
  /** Dónde existe el tipo (todas las facultades con CH de ese tipo). */
  facultades: CalcMuestraSessionTypeImpactoFacultad[];
  /** Facultades donde el tipo YA está exceptuado (no lo pierden). */
  exceptuado_en: string[];
  /** Facultades que PIERDEN CH/elegibles porque el tipo sigue excluido ahí. */
  perdido_en: CalcMuestraSessionTypeImpactoFacultad[];
};

export type CalcMuestraSessionTypeImpacto = {
  schema: "cm_session_type_impacto_v1" | string;
  tipos_excluidos: CalcMuestraSessionTypeImpactoTipo[];
};

/**
 * Normalizador defensivo de `frame.session_type_impacto` (patrón
 * normalizeGraficosShareInspect): jsonlite desempaca arrays de 1 a escalares,
 * los números pueden llegar como strings y los NA como "NA". Payload ausente o
 * sin forma reconocible ⇒ null (la tarjeta se comporta como hoy: sin aviso).
 */
export function normalizeCalcMuestraSessionTypeImpacto(
  raw: unknown,
): CalcMuestraSessionTypeImpacto | null {
  if (raw == null || typeof raw !== "object") return null;
  const unwrap = (v: unknown): unknown => (Array.isArray(v) ? (v.length > 0 ? v[0] : null) : v);
  const asText = (v: unknown): string => {
    const u = unwrap(v);
    if (typeof u === "string") return u === "NA" ? "" : u;
    if (typeof u === "number" && Number.isFinite(u)) return String(u);
    return "";
  };
  const asNum = (v: unknown): number => {
    const u = unwrap(v);
    if (typeof u === "number") return Number.isFinite(u) ? u : 0;
    if (typeof u === "string") {
      const n = Number(u.trim());
      return Number.isFinite(n) ? n : 0;
    }
    return 0;
  };
  const asList = (v: unknown): unknown[] => {
    if (v == null) return [];
    return Array.isArray(v) ? v : [v];
  };
  const asRecord = (v: unknown): Record<string, unknown> => {
    const u = unwrap(v);
    return typeof u === "object" && u !== null && !Array.isArray(u) ? (u as Record<string, unknown>) : {};
  };
  const asCount = (v: unknown): number => Math.max(0, Math.round(asNum(v)));
  const facultadImpacto = (v: unknown): CalcMuestraSessionTypeImpactoFacultad | null => {
    const row = asRecord(v);
    const facultad = asText(row.facultad);
    if (!facultad) return null;
    return { facultad, ch: asCount(row.ch), elegibles: asCount(row.elegibles) };
  };

  const r = raw as Record<string, unknown>;
  const tipos_excluidos = asList(r.tipos_excluidos)
    .map((item): CalcMuestraSessionTypeImpactoTipo | null => {
      const row = asRecord(item);
      const tipo = asText(row.tipo);
      if (!tipo) return null;
      return {
        tipo,
        facultades: asList(row.facultades)
          .map(facultadImpacto)
          .filter((f): f is CalcMuestraSessionTypeImpactoFacultad => f != null),
        exceptuado_en: asList(row.exceptuado_en).map(asText).filter(Boolean),
        perdido_en: asList(row.perdido_en)
          .map(facultadImpacto)
          .filter((f): f is CalcMuestraSessionTypeImpactoFacultad => f != null),
      };
    })
    .filter((t): t is CalcMuestraSessionTypeImpactoTipo => t != null);

  // Sin tipos excluidos ni schema reconocible, el payload no aporta nada:
  // null honesto (sin aviso) en vez de un objeto vacío ambiguo.
  const schema = asText(r.schema);
  if (!tipos_excluidos.length && !schema) return null;

  return { schema: schema || "cm_session_type_impacto_v1", tipos_excluidos };
}

/** Eco normalizado de los filtros del build del marco (frescura del criterio 8). */
export type CalcMuestraAulasFrameFiltersEcho = {
  require_min_prevalence?: boolean;
  min_prevalence_pct?: number;
  require_faculty_prevalence?: boolean;
  min_faculty_prevalence_pct?: number;
  require_cycle_homogeneity?: boolean;
  min_cycle_homogeneity_pct?: number;
};

export type CalcMuestraAulasSelection = {
  schema: "calc_muestra_aulas_selection_v1" | string;
  selection_run_id: string;
  generated_at: string;
  frame_hash: string;
  seed: number;
  selector: Record<string, unknown>;
  selector_engine?: string;
  selector_engine_used?: string;
  method_family?: string;
  method_source?: string;
  official_reference?: string;
  academic_reference?: string;
  implementation_reference?: string;
  probability_source?: string;
  weight_source?: string;
  nonresponse_policy?: string;
  replacement_policy?: string;
  methodological_warning?: string[];
  methodological_sources?: MonitoreoRow[];
  objective_config?: CalcMuestraAulasObjectiveConfig;
  representativity?: CalcMuestraAulasRepresentativityResult;
  representativity_score?: number;
  representativity_distance?: number;
  /** Filas por aula seleccionada. Con `sequential_discount` APLICADO (flag ON
   *  del config y marco con ids parseables) cada fila trae además las columnas
   *  OPCIONALES `eligible_n_bruto`, `eligible_n_neto`, `aporte_neto`,
   *  `ya_cubiertos` y `discount_step` (contrato calc_muestra_aulas_descuento_v1;
   *  corridas viejas o con flag OFF no las traen). */
  selection: MonitoreoRow[];
  quotas: MonitoreoRow[];
  summary: MonitoreoRow[];
  /** Bloque del descuento secuencial de repetidos emitido por el engine
   *  (contrato Oleada III). Retrocompatible: corridas viejas no lo traen y la
   *  UI se comporta como hoy (lectura defensiva en descuentoRepetidosModel). */
  sequential_discount?: CalcMuestraAulasSelectionDescuento | null;
  diagnostics?: Record<string, MonitoreoRow[] | undefined>;
  methodology?: Record<string, unknown>;
  method_comparison?: CalcMuestraAulasMethodComparison;
  replacement_simulation?: CalcMuestraAulasReplacementSimulation;
};

/** Resumen por estrato del descuento secuencial (bloque `sequential_discount`). */
export type CalcMuestraAulasSelectionDescuentoEstrato = {
  stratum: string;
  aulas_seleccionadas?: number;
  eligible_bruto_total?: number;
  eligible_neto_total?: number;
  ya_cubiertos_total?: number;
};

/** Bloque del resultado de seleccionar con el descuento secuencial de
 *  repetidos (schema calc_muestra_aulas_descuento_v1, claves congeladas).
 *  `requested` = flag pedido en el config; `applied` = si el engine pudo
 *  aplicarlo; `mode` = "off" | "sequential" | "post_hoc" (auditoría
 *  post-selección en engines balanceados); `warning_code` =
 *  "descuento_sin_ids" cuando el marco no tiene ids de estudiante parseables
 *  y se seleccionó SIN descuento. */
export type CalcMuestraAulasSelectionDescuento = {
  schema: "calc_muestra_aulas_descuento_v1" | string;
  requested?: boolean;
  applied?: boolean;
  mode?: "off" | "sequential" | "post_hoc" | string;
  warning_code?: "" | "descuento_sin_ids" | string;
  warnings?: string[];
  por_estrato?: CalcMuestraAulasSelectionDescuentoEstrato[] | MonitoreoRow[];
};

export type CalcMuestraAulasProfileDistribution = {
  dimension: string;
  variable?: string;
  label?: string;
  category: string;
  source?: string;
  frame_n?: number;
  selected_n?: number;
  frame_prop?: number;
  selected_prop?: number;
  error_balance?: number;
  abs_error?: number;
  tolerance?: number;
  within_tolerance?: boolean;
  method_id?: string;
};

export type CalcMuestraAulasRepresentativityMetric = {
  metric_id: string;
  metric_group: string;
  label: string;
  base_weight?: number;
  normalized_weight?: number;
  active?: boolean;
  score?: number;
  distance?: number;
  avg_abs_error?: number;
  max_abs_error?: number;
  tolerance?: number;
  detail?: string;
  method_id?: string;
};

export type CalcMuestraAulasSimulationSummary = {
  method_id: string;
  requested_runs?: number;
  executed_runs?: number;
  score_mean?: number;
  score_sd?: number;
  score_p10?: number;
  score_p90?: number;
  coverage_mean?: number;
  duplicate_loss_mean?: number;
  note?: string;
};

export type CalcMuestraAulasRepresentativityResult = {
  schema: "calc_muestra_aulas_representativity_objective_v1" | string;
  generated_at?: string;
  objective_config?: CalcMuestraAulasObjectiveConfig;
  overall_score?: number;
  representativity_score?: number;
  weighted_distance?: number;
  profile_distributions?: CalcMuestraAulasProfileDistribution[] | MonitoreoRow[];
  metrics?: CalcMuestraAulasRepresentativityMetric[] | MonitoreoRow[];
  coverage_overlap?: MonitoreoRow[];
  weight_stability?: MonitoreoRow[];
  reserve_depth?: MonitoreoRow[];
  warnings?: string[];
};

export type CalcMuestraAulasRiskFlag = {
  code: string;
  severity: "ok" | "baja" | "media" | "alta" | string;
  title: string;
  detail: string;
  method?: string;
};

export type CalcMuestraAulasMethodSummary = {
  method_id: CalcMuestraWorkspaceAulasSelector | string;
  method_label: string;
  engine_used?: string;
  probability_source?: string;
  balance_score?: number;
  repeated_students?: number;
  duplicate_loss?: number;
  repetition_score?: number;
  unique_students_covered?: number;
  coverage_unique_pct?: number;
  coverage_score?: number;
  schedule_concentration_delta?: number;
  concentration_score?: number;
  reserve_depth_ratio?: number;
  reserve_score?: number;
  weight_cv?: number;
  n_eff_ratio?: number;
  representativity_score?: number;
  representativity_distance?: number;
  overall_score?: number;
  warnings?: string;
  operational_reason?: string;
  methodological_reason?: string;
};

export type CalcMuestraAulasMethodComparison = {
  schema: "calc_muestra_aulas_method_comparison_v1" | string;
  generated_at: string;
  frame_hash: string;
  /** Snapshot completo del selector que produjo la comparación; acredita frescura. */
  selector?: Record<string, unknown>;
  methods: CalcMuestraAulasMethodSummary[];
  recommendation?: {
    method_id?: string;
    method_label?: string;
    operational_reason?: string;
    methodological_reason?: string;
    overall_score?: number;
    representativity_score?: number;
    representativity_distance?: number;
  };
  objective_config?: CalcMuestraAulasObjectiveConfig;
  frame_profiles?: CalcMuestraAulasProfileDistribution[] | MonitoreoRow[];
  method_profiles?: CalcMuestraAulasProfileDistribution[] | MonitoreoRow[];
  representativity_metrics?: CalcMuestraAulasRepresentativityMetric[] | MonitoreoRow[];
  simulation_summary?: CalcMuestraAulasSimulationSummary[] | MonitoreoRow[];
  balance?: MonitoreoRow[];
  reserve_depth?: MonitoreoRow[];
  risk_flags?: CalcMuestraAulasRiskFlag[];
  simulation_runs?: number;
  notes?: string[];
};

export type CalcMuestraAulasReplacementSuggestion = {
  selection_slot_id?: string;
  titular_operational_code?: string;
  titular_classroom_id: string;
  titular_label?: string;
  reserve_operational_code?: string;
  replacement_chain_code?: string;
  reserve_classroom_id: string;
  reserve_label?: string;
  rank: number;
  wave: string;
  replacement_order?: number;
  match_level: "misma_celda" | "celda_equivalente" | "celda_cercana" | string;
  score: number;
  before_score?: number;
  after_score?: number;
  score_delta?: number;
  overlap_delta?: number;
  eligible_delta?: number;
  reason?: string;
  warning?: string;
};

export type CalcMuestraAulasReplacementImpact = {
  selection_slot_id?: string;
  titular_operational_code?: string;
  titular_classroom_id: string;
  replacement_operational_code?: string;
  suggested_replacement_id: string;
  before_score?: number;
  after_score?: number;
  score_delta?: number;
  before_faculty?: string;
  after_faculty?: string;
  before_program?: string;
  after_program?: string;
  eligible_delta?: number;
  overlap_delta?: number;
  balance_effect?: string;
  warning?: string;
};

export type CalcMuestraAulasReplacementSimulation = {
  schema: "calc_muestra_aulas_replacement_simulation_v1" | string;
  generated_at: string;
  selection_run_id: string;
  frame_hash: string;
  objective_config?: CalcMuestraAulasObjectiveConfig;
  planned_representativity?: CalcMuestraAulasRepresentativityResult;
  suggestions: CalcMuestraAulasReplacementSuggestion[];
  impact: CalcMuestraAulasReplacementImpact[] | MonitoreoRow[];
  summary?: MonitoreoRow[];
};

export type CalcMuestraAulasState = {
  config?: Record<string, unknown>;
  frame?: CalcMuestraAulasFrame | null;
  selection?: CalcMuestraAulasSelection | null;
  method_comparison?: CalcMuestraAulasMethodComparison | null;
  replacement_simulation?: CalcMuestraAulasReplacementSimulation | null;
  export?: { ok?: true; file_id: string; filename: string; size: number } | null;
  /** Resultado de un job que llegó con un frame_hash que ya no corresponde al
   *  marco vigente (guard del backend): se conserva aparte en vez de pisar el
   *  estado bueno. Retrocompatible: puede no venir. */
  stale_job_result?: Record<string, unknown> | null;
};

export const CALC_MUESTRA_REFERENCIA_ASISTENCIA_SCHEMA =
  "calc_muestra_referencia_asistencia_v1" as const;

export type CalcMuestraReferenciaAsistenciaMetodoIc =
  | "bootstrap_percentil"
  | "no_aplica";

export type CalcMuestraReferenciaAsistenciaSuficiencia =
  | "vacia"
  | "insuficiente"
  | "delgada"
  | "solida";

export type CalcMuestraReferenciaAsistenciaFuentePublicada =
  | "celda"
  | "global"
  | "sin_publicacion";

export type CalcMuestraReferenciaAsistenciaEstudio = {
  id: string;
  label: string;
  periodo: string;
  fuente: string;
};

export type CalcMuestraReferenciaAsistenciaCobertura = {
  agendados: number;
  aplicados: number;
  observados: number;
};

export type CalcMuestraReferenciaAsistenciaIdentidad = {
  regla: "A = E + no_respondieron";
  verificada: boolean;
  verificables: number;
  inconsistentes: number;
};

export type CalcMuestraReferenciaAsistenciaUmbrales = {
  insuficiente_max: 11;
  delgada_min: 12;
  solida_min: 30;
  bootstrap_n: number;
  nivel_ic: 0.95;
  quantile_type: 7;
};

export type CalcMuestraReferenciaAsistenciaTramoKey =
  | "asistencia"
  | "completitud"
  | "validez"
  | "producto";

export type CalcMuestraReferenciaAsistenciaTramo = {
  key: CalcMuestraReferenciaAsistenciaTramoKey;
  label: string;
  k: number;
  numerador: number | null;
  denominador: number | null;
  tasa: number | null;
  ic_low: number | null;
  ic_high: number | null;
  metodo_ic: CalcMuestraReferenciaAsistenciaMetodoIc;
};

export type CalcMuestraReferenciaAsistenciaCadena = {
  asistencia: CalcMuestraReferenciaAsistenciaTramo;
  completitud: CalcMuestraReferenciaAsistenciaTramo;
  validez: CalcMuestraReferenciaAsistenciaTramo;
  producto: CalcMuestraReferenciaAsistenciaTramo;
};

export type CalcMuestraReferenciaAsistenciaGlobal = {
  k: number;
  matriculados: number | null;
  asistentes: number | null;
  enviadas: number | null;
  validas: number | null;
  no_respondieron: number | null;
  tasa: number | null;
  media_ch: number | null;
  sd_ch: number | null;
  ic_low: number | null;
  ic_high: number | null;
  metodo_ic: CalcMuestraReferenciaAsistenciaMetodoIc;
};

export type CalcMuestraReferenciaAsistenciaCelda = {
  celda_key: string;
  celda_label: string;
  orden: number;
  k: number;
  matriculados: number | null;
  asistentes: number | null;
  tasa: number | null;
  estimador: "razon_agregada";
  media_ch: number | null;
  sd_ch: number | null;
  ic_low: number | null;
  ic_high: number | null;
  metodo_ic: CalcMuestraReferenciaAsistenciaMetodoIc;
  suficiencia: CalcMuestraReferenciaAsistenciaSuficiencia;
  tasa_publicada: number | null;
  k_publicada: number | null;
  fuente_publicada: CalcMuestraReferenciaAsistenciaFuentePublicada;
};

export type CalcMuestraReferenciaAsistenciaDimensionKey =
  | "tamano"
  | "rango_horario"
  | "facultad"
  | "tipo_sesion";

export type CalcMuestraReferenciaAsistenciaDimension = {
  dimension_key: CalcMuestraReferenciaAsistenciaDimensionKey;
  dimension_label: string;
  orden: number;
  filas: CalcMuestraReferenciaAsistenciaCelda[];
};

/**
 * Agregado post hoc transferible por celda. Sus cuatro dimensiones son
 * marginales independientes: el frontend puede formatearlas, nunca combinarlas
 * ni recalcular tasas, intervalos o degradaciones.
 */
export type CalcMuestraReferenciaAsistencia = {
  schema: typeof CALC_MUESTRA_REFERENCIA_ASISTENCIA_SCHEMA;
  owner: "estudio_historico_externo";
  momento: "post_hoc_estudio_previo";
  transferible: "modelo_por_celda";
  modelo: "marginales_independientes";
  combinable: false;
  unidad: "curso_horario_aplicado";
  denominador: "matriculados_totales";
  estudio: CalcMuestraReferenciaAsistenciaEstudio;
  cobertura: CalcMuestraReferenciaAsistenciaCobertura;
  identidad: CalcMuestraReferenciaAsistenciaIdentidad;
  umbrales: CalcMuestraReferenciaAsistenciaUmbrales;
  cadena: CalcMuestraReferenciaAsistenciaCadena;
  global: CalcMuestraReferenciaAsistenciaGlobal;
  dimensiones: CalcMuestraReferenciaAsistenciaDimension[];
  advertencias: string[];
};

/**
 * Valida atómicamente el contrato de referencia de asistencia. jsonlite puede
 * envolver escalares en arrays de longitud uno; solo `null` y el texto `NA`
 * representan ausencia numérica. Un cero válido permanece cero.
 */
export function normalizeCalcMuestraReferenciaAsistencia(
  raw: unknown,
): CalcMuestraReferenciaAsistencia | null {
  if (raw == null || typeof raw !== "object") return null;

  const unwrap = (value: unknown): unknown =>
    Array.isArray(value) && value.length === 1 ? value[0] : value;
  const asRecord = (value: unknown): Record<string, unknown> | null => {
    const unwrapped = unwrap(value);
    return typeof unwrapped === "object" && unwrapped !== null && !Array.isArray(unwrapped)
      ? (unwrapped as Record<string, unknown>)
      : null;
  };
  const asList = (value: unknown): unknown[] => {
    if (value == null) return [];
    return Array.isArray(value) ? value : [value];
  };
  const asText = (value: unknown, allowEmpty = false): string | null => {
    const unwrapped = unwrap(value);
    if (typeof unwrapped !== "string") return null;
    const text = unwrapped.trim();
    if (text.toUpperCase() === "NA") return null;
    return text || allowEmpty ? text : null;
  };
  const INVALID_NUMBER = Symbol("invalid-reference-number");
  type ParsedNullableNumber = number | null | typeof INVALID_NUMBER;
  const asFiniteOrNull = (value: unknown): ParsedNullableNumber => {
    const unwrapped = unwrap(value);
    if (unwrapped === null) return null;
    if (typeof unwrapped === "number") {
      return Number.isFinite(unwrapped) ? unwrapped : INVALID_NUMBER;
    }
    if (typeof unwrapped === "string") {
      const text = unwrapped.trim();
      if (text.toUpperCase() === "NA") return null;
      if (!text) return INVALID_NUMBER;
      const parsed = Number(text);
      return Number.isFinite(parsed) ? parsed : INVALID_NUMBER;
    }
    return INVALID_NUMBER;
  };
  const asNonNegativeInteger = (value: unknown): number | typeof INVALID_NUMBER => {
    const parsed = asFiniteOrNull(value);
    return parsed !== INVALID_NUMBER && parsed !== null && Number.isInteger(parsed) && parsed >= 0
      ? parsed
      : INVALID_NUMBER;
  };
  const asPositiveInteger = (value: unknown): number | typeof INVALID_NUMBER => {
    const parsed = asNonNegativeInteger(value);
    return parsed !== INVALID_NUMBER && parsed > 0 ? parsed : INVALID_NUMBER;
  };
  const asNullableNonNegativeInteger = (value: unknown): ParsedNullableNumber => {
    const parsed = asFiniteOrNull(value);
    return parsed !== INVALID_NUMBER &&
      (parsed === null || (Number.isInteger(parsed) && parsed >= 0))
      ? parsed
      : INVALID_NUMBER;
  };
  const asMetodoIc = (value: unknown): CalcMuestraReferenciaAsistenciaMetodoIc | null => {
    const text = asText(value);
    return text === "bootstrap_percentil" || text === "no_aplica" ? text : null;
  };

  const root = asRecord(raw);
  if (!root) return null;
  if (
    asText(root.schema) !== CALC_MUESTRA_REFERENCIA_ASISTENCIA_SCHEMA ||
    asText(root.owner) !== "estudio_historico_externo" ||
    asText(root.momento) !== "post_hoc_estudio_previo" ||
    asText(root.transferible) !== "modelo_por_celda" ||
    asText(root.modelo) !== "marginales_independientes" ||
    unwrap(root.combinable) !== false ||
    asText(root.unidad) !== "curso_horario_aplicado" ||
    asText(root.denominador) !== "matriculados_totales"
  ) return null;

  const studyRecord = asRecord(root.estudio);
  if (!studyRecord) return null;
  const studyId = asText(studyRecord.id);
  const studyLabel = asText(studyRecord.label);
  const studyPeriod = asText(studyRecord.periodo, true);
  const studySource = asText(studyRecord.fuente);
  if (!studyId || !studyLabel || studyPeriod === null || !studySource) return null;
  const estudio: CalcMuestraReferenciaAsistenciaEstudio = {
    id: studyId,
    label: studyLabel,
    periodo: studyPeriod,
    fuente: studySource,
  };

  const coverageRecord = asRecord(root.cobertura);
  if (!coverageRecord) return null;
  const agendados = asNonNegativeInteger(coverageRecord.agendados);
  const aplicados = asNonNegativeInteger(coverageRecord.aplicados);
  const observados = asNonNegativeInteger(coverageRecord.observados);
  if (
    agendados === INVALID_NUMBER ||
    aplicados === INVALID_NUMBER ||
    observados === INVALID_NUMBER ||
    aplicados > agendados ||
    observados > aplicados
  ) return null;
  const cobertura: CalcMuestraReferenciaAsistenciaCobertura = {
    agendados,
    aplicados,
    observados,
  };

  const identityRecord = asRecord(root.identidad);
  if (!identityRecord) return null;
  const identityRule = asText(identityRecord.regla);
  const identityVerified = unwrap(identityRecord.verificada);
  const verificables = asNonNegativeInteger(identityRecord.verificables);
  const inconsistentes = asNonNegativeInteger(identityRecord.inconsistentes);
  if (
    identityRule !== "A = E + no_respondieron" ||
    typeof identityVerified !== "boolean" ||
    verificables === INVALID_NUMBER ||
    inconsistentes === INVALID_NUMBER ||
    inconsistentes > verificables ||
    (identityVerified && (verificables === 0 || inconsistentes !== 0))
  ) return null;
  const identidad: CalcMuestraReferenciaAsistenciaIdentidad = {
    regla: "A = E + no_respondieron",
    verificada: identityVerified,
    verificables,
    inconsistentes,
  };

  const thresholdsRecord = asRecord(root.umbrales);
  if (!thresholdsRecord) return null;
  const insuficienteMax = asNonNegativeInteger(thresholdsRecord.insuficiente_max);
  const delgadaMin = asPositiveInteger(thresholdsRecord.delgada_min);
  const solidaMin = asPositiveInteger(thresholdsRecord.solida_min);
  const bootstrapN = asPositiveInteger(thresholdsRecord.bootstrap_n);
  const nivelIc = asFiniteOrNull(thresholdsRecord.nivel_ic);
  const quantileType = asPositiveInteger(thresholdsRecord.quantile_type);
  if (
    insuficienteMax !== 11 ||
    delgadaMin !== 12 ||
    solidaMin !== 30 ||
    bootstrapN === INVALID_NUMBER ||
    nivelIc !== 0.95 ||
    quantileType !== 7
  ) return null;
  const umbrales: CalcMuestraReferenciaAsistenciaUmbrales = {
    insuficiente_max: 11,
    delgada_min: 12,
    solida_min: 30,
    bootstrap_n: bootstrapN,
    nivel_ic: 0.95,
    quantile_type: 7,
  };

  const advertencias: string[] = [];
  for (const item of asList(root.advertencias)) {
    const warning = asText(item);
    if (!warning) return null;
    advertencias.push(warning);
  }
  if (!advertencias.length) return null;
  const hasCountWarning = (key: string) => advertencias.some((warning) =>
    new RegExp(`^${key}:[1-9]\\d*$`).test(warning),
  );
  const hasInvalidAttendanceRateWarning = hasCountWarning(
    "asistentes_mayor_matriculados",
  );
  const isProbability = (value: number | null): value is number =>
    value !== null && value >= 0 && value <= 1;
  const isAllowedDiagnosticRate = (value: number | null) =>
    value === null || isProbability(value) ||
    (value > 1 && hasInvalidAttendanceRateWarning);
  const sameSerializedRate = (left: number, right: number) =>
    Math.abs(left - right) <= 5e-4 * Math.max(1, Math.abs(left), Math.abs(right));
  const isNonNegativeCountOrNull = (value: number | null) =>
    value === null || (Number.isInteger(value) && value >= 0);
  const ratioMatchesCounts = (
    numerator: number | null,
    denominator: number | null,
    rate: number | null,
  ) => {
    if (numerator === null || denominator === null || denominator <= 0) {
      return rate === null;
    }
    return rate !== null && sameSerializedRate(rate, numerator / denominator);
  };
  const intervalMatchesMethod = (
    k: number,
    rate: number | null,
    low: number | null,
    high: number | null,
    method: CalcMuestraReferenciaAsistenciaMetodoIc,
    allowsDiagnostic: (value: number | null) => boolean,
  ) => {
    if (method === "no_aplica") {
      return low === null && high === null && (k < 12 || rate === null);
    }
    return k >= 12 &&
      rate !== null &&
      low !== null &&
      high !== null &&
      low <= high &&
      allowsDiagnostic(low) &&
      allowsDiagnostic(high);
  };
  const warningForTramo = (key: CalcMuestraReferenciaAsistenciaTramoKey) => {
    if (key === "asistencia") return hasInvalidAttendanceRateWarning;
    if (key === "completitud") return hasCountWarning("enviadas_mayor_asistentes");
    if (key === "validez") return hasCountWarning("validas_mayor_enviadas");
    return hasInvalidAttendanceRateWarning ||
      hasCountWarning("enviadas_mayor_asistentes") ||
      hasCountWarning("validas_mayor_enviadas");
  };

  const parseTramo = (
    value: unknown,
    expectedKey: CalcMuestraReferenciaAsistenciaTramoKey,
  ): CalcMuestraReferenciaAsistenciaTramo | null => {
    const record = asRecord(value);
    if (!record || asText(record.key) !== expectedKey) return null;
    const label = asText(record.label);
    const k = asNonNegativeInteger(record.k);
    const numerador = asFiniteOrNull(record.numerador);
    const denominadorTramo = asFiniteOrNull(record.denominador);
    const tasa = asFiniteOrNull(record.tasa);
    const icLow = asFiniteOrNull(record.ic_low);
    const icHigh = asFiniteOrNull(record.ic_high);
    const metodoIc = asMetodoIc(record.metodo_ic);
    if (
      !label ||
      k === INVALID_NUMBER ||
      numerador === INVALID_NUMBER ||
      denominadorTramo === INVALID_NUMBER ||
      tasa === INVALID_NUMBER ||
      icLow === INVALID_NUMBER ||
      icHigh === INVALID_NUMBER ||
      !metodoIc ||
      !isNonNegativeCountOrNull(numerador) ||
      !isNonNegativeCountOrNull(denominadorTramo)
    ) return null;
    const allowsDiagnostic = (candidate: number | null) =>
      candidate === null || isProbability(candidate) ||
      (candidate > 1 && warningForTramo(expectedKey));
    if (
      !allowsDiagnostic(tasa) ||
      !ratioMatchesCounts(numerador, denominadorTramo, tasa) ||
      !intervalMatchesMethod(k, tasa, icLow, icHigh, metodoIc, allowsDiagnostic)
    ) return null;
    return {
      key: expectedKey,
      label,
      k,
      numerador,
      denominador: denominadorTramo,
      tasa,
      ic_low: icLow,
      ic_high: icHigh,
      metodo_ic: metodoIc,
    };
  };
  const chainRecord = asRecord(root.cadena);
  if (!chainRecord) return null;
  const asistencia = parseTramo(chainRecord.asistencia, "asistencia");
  const completitud = parseTramo(chainRecord.completitud, "completitud");
  const validez = parseTramo(chainRecord.validez, "validez");
  const producto = parseTramo(chainRecord.producto, "producto");
  if (!asistencia || !completitud || !validez || !producto) return null;
  if (
    asistencia.k !== completitud.k ||
    asistencia.k !== validez.k ||
    asistencia.k !== producto.k ||
    asistencia.numerador !== completitud.denominador ||
    completitud.numerador !== validez.denominador ||
    validez.numerador !== producto.numerador ||
    asistencia.denominador !== producto.denominador ||
    (asistencia.tasa !== null &&
      completitud.tasa !== null &&
      validez.tasa !== null &&
      producto.tasa !== null &&
      !sameSerializedRate(
        producto.tasa,
        asistencia.tasa * completitud.tasa * validez.tasa,
      ))
  ) return null;
  const cadena: CalcMuestraReferenciaAsistenciaCadena = {
    asistencia,
    completitud,
    validez,
    producto,
  };

  const globalRecord = asRecord(root.global);
  if (!globalRecord) return null;
  const globalK = asNonNegativeInteger(globalRecord.k);
  const globalMatriculados = asFiniteOrNull(globalRecord.matriculados);
  const globalAsistentes = asFiniteOrNull(globalRecord.asistentes);
  const globalEnviadas = asFiniteOrNull(globalRecord.enviadas);
  const globalValidas = asFiniteOrNull(globalRecord.validas);
  const globalNoRespondieron = asFiniteOrNull(globalRecord.no_respondieron);
  const globalTasa = asFiniteOrNull(globalRecord.tasa);
  const globalMedia = asFiniteOrNull(globalRecord.media_ch);
  const globalSd = asFiniteOrNull(globalRecord.sd_ch);
  const globalIcLow = asFiniteOrNull(globalRecord.ic_low);
  const globalIcHigh = asFiniteOrNull(globalRecord.ic_high);
  const globalMetodoIc = asMetodoIc(globalRecord.metodo_ic);
  if (
    globalK === INVALID_NUMBER ||
    globalMatriculados === INVALID_NUMBER ||
    globalAsistentes === INVALID_NUMBER ||
    globalEnviadas === INVALID_NUMBER ||
    globalValidas === INVALID_NUMBER ||
    globalNoRespondieron === INVALID_NUMBER ||
    globalTasa === INVALID_NUMBER ||
    globalMedia === INVALID_NUMBER ||
    globalSd === INVALID_NUMBER ||
    globalIcLow === INVALID_NUMBER ||
    globalIcHigh === INVALID_NUMBER ||
    !globalMetodoIc ||
    !isAllowedDiagnosticRate(globalTasa) ||
    !isNonNegativeCountOrNull(globalMatriculados) ||
    !isNonNegativeCountOrNull(globalAsistentes) ||
    !isNonNegativeCountOrNull(globalEnviadas) ||
    !isNonNegativeCountOrNull(globalValidas) ||
    !isNonNegativeCountOrNull(globalNoRespondieron) ||
    globalK !== cobertura.observados ||
    globalK !== asistencia.k ||
    globalMatriculados !== asistencia.denominador ||
    globalAsistentes !== asistencia.numerador ||
    globalEnviadas !== completitud.numerador ||
    globalValidas !== validez.numerador ||
    !ratioMatchesCounts(globalAsistentes, globalMatriculados, globalTasa) ||
    !intervalMatchesMethod(
      globalK,
      globalTasa,
      globalIcLow,
      globalIcHigh,
      globalMetodoIc,
      isAllowedDiagnosticRate,
    )
  ) return null;
  const global: CalcMuestraReferenciaAsistenciaGlobal = {
    k: globalK,
    matriculados: globalMatriculados,
    asistentes: globalAsistentes,
    enviadas: globalEnviadas,
    validas: globalValidas,
    no_respondieron: globalNoRespondieron,
    tasa: globalTasa,
    media_ch: globalMedia,
    sd_ch: globalSd,
    ic_low: globalIcLow,
    ic_high: globalIcHigh,
    metodo_ic: globalMetodoIc,
  };

  const dimensionKeys: CalcMuestraReferenciaAsistenciaDimensionKey[] = [
    "tamano",
    "rango_horario",
    "facultad",
    "tipo_sesion",
  ];
  const rawDimensions = asList(root.dimensiones);
  if (rawDimensions.length !== dimensionKeys.length) return null;
  const dimensiones: CalcMuestraReferenciaAsistenciaDimension[] = [];
  for (let dimensionIndex = 0; dimensionIndex < dimensionKeys.length; dimensionIndex += 1) {
    const expectedKey = dimensionKeys[dimensionIndex]!;
    const record = asRecord(rawDimensions[dimensionIndex]);
    if (!record) return null;
    const label = asText(record.dimension_label);
    const order = asPositiveInteger(record.orden);
    if (
      asText(record.dimension_key) !== expectedKey ||
      !label ||
      order === INVALID_NUMBER ||
      order !== dimensionIndex + 1
    ) return null;

    const rawRows = asList(record.filas);
    const filas: CalcMuestraReferenciaAsistenciaCelda[] = [];
    const cellKeys = new Set<string>();
    for (let rowIndex = 0; rowIndex < rawRows.length; rowIndex += 1) {
      const row = asRecord(rawRows[rowIndex]);
      if (!row) return null;
      const cellKey = asText(row.celda_key);
      const cellLabel = asText(row.celda_label);
      const cellOrder = asPositiveInteger(row.orden);
      const k = asNonNegativeInteger(row.k);
      const matriculados = asFiniteOrNull(row.matriculados);
      const asistentesCelda = asFiniteOrNull(row.asistentes);
      const tasa = asFiniteOrNull(row.tasa);
      const estimador = asText(row.estimador);
      const mediaCh = asFiniteOrNull(row.media_ch);
      const sdCh = asFiniteOrNull(row.sd_ch);
      const icLow = asFiniteOrNull(row.ic_low);
      const icHigh = asFiniteOrNull(row.ic_high);
      const metodoIc = asMetodoIc(row.metodo_ic);
      const suficiencia = asText(row.suficiencia);
      const tasaPublicada = asFiniteOrNull(row.tasa_publicada);
      const kPublicada = asNullableNonNegativeInteger(row.k_publicada);
      const fuentePublicada = asText(row.fuente_publicada);
      const expectedSufficiency: CalcMuestraReferenciaAsistenciaSuficiencia =
        k === INVALID_NUMBER || k === 0
          ? "vacia"
          : k <= umbrales.insuficiente_max
            ? "insuficiente"
            : k < umbrales.solida_min
              ? "delgada"
              : "solida";
      if (
        !cellKey ||
        !cellLabel ||
        cellKeys.has(cellKey) ||
        cellOrder === INVALID_NUMBER ||
        cellOrder !== rowIndex + 1 ||
        k === INVALID_NUMBER ||
        matriculados === INVALID_NUMBER ||
        asistentesCelda === INVALID_NUMBER ||
        tasa === INVALID_NUMBER ||
        estimador !== "razon_agregada" ||
        mediaCh === INVALID_NUMBER ||
        sdCh === INVALID_NUMBER ||
        icLow === INVALID_NUMBER ||
        icHigh === INVALID_NUMBER ||
        !metodoIc ||
        (suficiencia !== "vacia" &&
          suficiencia !== "insuficiente" &&
          suficiencia !== "delgada" &&
          suficiencia !== "solida") ||
        tasaPublicada === INVALID_NUMBER ||
        kPublicada === INVALID_NUMBER ||
        (fuentePublicada !== "celda" &&
          fuentePublicada !== "global" &&
          fuentePublicada !== "sin_publicacion") ||
        suficiencia !== expectedSufficiency ||
        !isNonNegativeCountOrNull(matriculados) ||
        !isNonNegativeCountOrNull(asistentesCelda) ||
        (mediaCh !== null && mediaCh < 0) ||
        (sdCh !== null && sdCh < 0) ||
        !ratioMatchesCounts(asistentesCelda, matriculados, tasa) ||
        !intervalMatchesMethod(
          k,
          tasa,
          icLow,
          icHigh,
          metodoIc,
          isAllowedDiagnosticRate,
        ) ||
        (k === 0 && (
          matriculados !== null ||
          asistentesCelda !== null ||
          tasa !== null ||
          mediaCh !== null ||
          sdCh !== null
        )) ||
        (tasaPublicada !== null && !isProbability(tasaPublicada)) ||
        !isAllowedDiagnosticRate(tasa) ||
        (fuentePublicada === "celda" &&
          (k < umbrales.delgada_min ||
            !isProbability(tasa) ||
            tasaPublicada !== tasa ||
            kPublicada !== k)) ||
        (fuentePublicada === "global" &&
          (k === 0 ||
            (k >= umbrales.delgada_min && isProbability(tasa)) ||
            !isProbability(global.tasa) ||
            tasaPublicada !== global.tasa ||
            kPublicada !== global.k)) ||
        (fuentePublicada === "sin_publicacion" &&
          (tasaPublicada !== null ||
            kPublicada !== null ||
            (k >= umbrales.delgada_min && isProbability(tasa)) ||
            (k > 0 && isProbability(global.tasa))))
      ) return null;
      cellKeys.add(cellKey);
      filas.push({
        celda_key: cellKey,
        celda_label: cellLabel,
        orden: cellOrder,
        k,
        matriculados,
        asistentes: asistentesCelda,
        tasa,
        estimador: "razon_agregada",
        media_ch: mediaCh,
        sd_ch: sdCh,
        ic_low: icLow,
        ic_high: icHigh,
        metodo_ic: metodoIc,
        suficiencia,
        tasa_publicada: tasaPublicada,
        k_publicada: kPublicada,
        fuente_publicada: fuentePublicada,
      });
    }
    dimensiones.push({
      dimension_key: expectedKey,
      dimension_label: label,
      orden: order,
      filas,
    });
  }

  return {
    schema: CALC_MUESTRA_REFERENCIA_ASISTENCIA_SCHEMA,
    owner: "estudio_historico_externo",
    momento: "post_hoc_estudio_previo",
    transferible: "modelo_por_celda",
    modelo: "marginales_independientes",
    combinable: false,
    unidad: "curso_horario_aplicado",
    denominador: "matriculados_totales",
    estudio,
    cobertura,
    identidad,
    umbrales,
    cadena,
    global,
    dimensiones,
    advertencias,
  };
}

export type CalcMuestraState = {
  estudio: CalcMuestraEstudio;
  aulas?: CalcMuestraAulasState;
  referencia_asistencia?: CalcMuestraReferenciaAsistencia | null;
  reporte: CalcMuestraReporteMeta;
};

export const DEFAULT_CALC_MUESTRA_ESTUDIO: CalcMuestraEstudio = {
  version: 1,
  id: "",
  titulo: "Estudio sin título",
  fecha_creacion: new Date().toISOString(),
  modo_trabajo: "estimacion_preliminar",
  macro_familia: "estudio_propio",
  modo_sensible: false,
  contexto: { cliente: "", tipo_cliente: "", descripcion_libre: "" },
  componentes: [],
  workspace: null,
};

export type CalcMuestraDiagnostico = {
  buscaCenso?: boolean;
  universoPequeno?: boolean;
  poblacionOculta?: boolean;
  marcoEstado?: CalcMuestraEstadoMarco;
  probabilidadConocida?: boolean;
  buscaRepresentatividad?: boolean;
  controlaCuotas?: boolean;
  necesitaMargenError?: boolean;
  modoCampo?: "individual" | "por_grupos";
  tieneConglomerados?: boolean;
  marcoOrdenado?: boolean;
  tieneEstratos?: boolean;
  medicionRecurrente?: boolean;
  N_marco?: number;
};

export type CalcMuestraRecomendacion = {
  tecnica: CalcMuestraTecnica;
  naturaleza: CalcMuestraNaturaleza;
  nivel_respaldo: CalcMuestraNivelRespaldo;
  origen_tamano: CalcMuestraOrigenTamano;
  razon: string;
};

export type CalcMuestraMemoriaDecision = {
  paso: string;
  decision: string;
  motivo: string;
  fuente: string;
};

/** Memoria de cálculo del motor R (POST /api/calc-muestra/explicar). */
export type CalcMuestraMemoria = {
  modelo: "cochran_fpc_deff" | string;
  parametros: {
    confianza: number;
    z_usado: number;
    p: number;
    q: number;
    e: number;
    deff: number;
    N: number;
    oversample_pct: number;
  };
  terminos: {
    numerador: number;
    n0_sin_fpc: number;
    fpc_denominador: number;
    n_sin_deff: number;
  };
  n_teorico: number;
  n_objetivo: number;
  n_operativo: number;
  sobremuestra: number;
  unidades_operativas?: number | null;
  retrocalculo: {
    precision_alcanzada: number;
    e_objetivo: number;
    cumple: boolean;
  };
  decision_log: CalcMuestraMemoriaDecision[];
  fuentes: string[];
};

export type CalcMuestraExplicarInput = {
  N: number;
  p?: number;
  e?: number;
  deff?: number;
  confianza?: number;
  z?: number;
  oversample_pct?: number;
  meta_valor?: number;
  promedio_conglomerado?: number;
  tau?: number;
};

export async function apiCalcMuestraState() {
  return handle<CalcMuestraState>(
    await apiFetch("/api/calc-muestra/state", { headers: headers() }),
  );
}

export async function apiCalcMuestraEstudioPut(estudio: Partial<CalcMuestraEstudio>) {
  return handle<{ ok: true; estudio: CalcMuestraEstudio }>(
    await apiFetch("/api/calc-muestra/estudio", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ estudio }),
    }),
  );
}

export async function apiCalcMuestraComponenteUpsert(
  componente: Partial<CalcMuestraComponente>,
  op: "add" | "update" = "update",
) {
  return handle<{ ok: true; componente: CalcMuestraComponente; estudio: CalcMuestraEstudio }>(
    await apiFetch("/api/calc-muestra/componente", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ componente, op }),
    }),
  );
}

export async function apiCalcMuestraComponenteEliminar(id: string) {
  return handle<{ ok: true; estudio: CalcMuestraEstudio }>(
    await apiFetch("/api/calc-muestra/componente", {
      method: "DELETE",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ id }),
    }),
  );
}

export async function apiCalcMuestraCalcular() {
  return handle<{ ok: true; estudio: CalcMuestraEstudio }>(
    await apiFetch("/api/calc-muestra/calcular", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({}),
    }),
  );
}

export async function apiCalcMuestraRecomendar(diagnostico: CalcMuestraDiagnostico) {
  return handle<{ ok: true; recomendacion: CalcMuestraRecomendacion }>(
    await apiFetch("/api/calc-muestra/recomendar", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ diagnostico }),
    }),
  );
}

export async function apiCalcMuestraExplicar(parametros: CalcMuestraExplicarInput) {
  return handle<{ ok: true; memoria: CalcMuestraMemoria }>(
    await apiFetch("/api/calc-muestra/explicar", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ parametros }),
    }),
  );
}

export async function apiCalcMuestraMarcoConfig(config: Record<string, unknown>) {
  return handle<{ ok: true; config: Record<string, unknown>; state: CalcMuestraState }>(
    await apiFetch("/api/calc-muestra/marco/config", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ config }),
    }),
  );
}

export async function apiCalcMuestraMarcoInspeccionarArchivo(file_id: string) {
  return handle<{
    ok: true;
    file_id: string;
    original_name: string;
    inspection: CalcMuestraAulasFileInspection;
  }>(
    await apiFetch("/api/calc-muestra/marco/inspeccionar-archivo", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ file_id }),
    }),
  );
}

export type CalcMuestraAsistenciaReferenciaInput = {
  referencia_asistencia_file_id: string;
  referencia_asistencia_sheet?: string;
  estudio: CalcMuestraReferenciaAsistenciaEstudio;
  workspace?: CalcMuestraWorkspace;
};

/**
 * Calibra la fuente histórica y exige que tanto la respuesta directa como el
 * sibling de sesión cumplan íntegramente el schema v1 antes de exponerlos.
 */
export async function apiCalcMuestraAsistenciaReferencia(
  payload: CalcMuestraAsistenciaReferenciaInput,
) {
  const response = await handle<{
    ok: true;
    estudio?: CalcMuestraEstudio;
    referencia_asistencia: unknown;
    state: unknown;
  }>(
    await apiFetch("/api/calc-muestra/asistencia/referencia", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
  const referencia = normalizeCalcMuestraReferenciaAsistencia(
    response.referencia_asistencia,
  );
  const stateRecord = response.state != null && typeof response.state === "object" && !Array.isArray(response.state)
    ? response.state as Record<string, unknown>
    : null;
  const referenciaState = normalizeCalcMuestraReferenciaAsistencia(
    stateRecord?.referencia_asistencia,
  );
  if (
    !referencia ||
    !stateRecord ||
    !referenciaState ||
    JSON.stringify(referencia) !== JSON.stringify(referenciaState)
  ) {
    throw new Error(
      "El backend devolvió una referencia histórica de asistencia con contrato inválido.",
    );
  }
  return {
    ok: true as const,
    estudio: response.estudio,
    referencia_asistencia: referencia,
    state: {
      ...(response.state as CalcMuestraState),
      referencia_asistencia: referenciaState,
    },
  };
}

export async function apiCalcMuestraMarcoConstruir(payload: {
  base_madre?: MonitoreoRow[];
  base_madre_file_id?: string;
  base_madre_sheet?: string;
  estudiantes?: MonitoreoRow[];
  estudiantes_file_id?: string;
  estudiantes_sheet?: string;
  catalogo_curso_horario?: MonitoreoRow[];
  catalogo_curso_horario_file_id?: string;
  catalogo_curso_horario_sheet?: string;
  inscripciones?: MonitoreoRow[];
  inscripciones_file_id?: string;
  inscripciones_sheet?: string;
  config?: Record<string, unknown>;
}) {
  return handle<{ ok: true; frame: CalcMuestraAulasFrame; state: CalcMuestraState }>(
    await apiFetch("/api/calc-muestra/marco/construir", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
}

// Con marcos grandes (>= umbral del backend, default 500 aulas) estos dos
// endpoints responden { mode: "job", job_id } en vez del resultado síncrono;
// el resultado queda en la sesión al terminar el job (pollear /api/jobs/<id>
// y refrescar con apiCalcMuestraState()).
export type CalcMuestraAulasAsyncResponse<T extends object> =
  | ({ ok: true; mode?: "sync"; job_id?: undefined; state: CalcMuestraState } & T)
  | ({ ok: true; mode: "job"; job_id: string; state?: undefined } & Partial<Record<keyof T, undefined>>);

export async function apiCalcMuestraAulasCompararMetodos(payload: {
  config?: Record<string, unknown>;
  objective_config?: CalcMuestraAulasObjectiveConfig;
  frame?: CalcMuestraAulasFrame;
  methods?: string[];
  simulation_runs?: number;
} = {}) {
  return handle<CalcMuestraAulasAsyncResponse<{ comparison: CalcMuestraAulasMethodComparison }>>(
    await apiFetch("/api/calc-muestra/aulas/comparar-metodos", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
}

export async function apiCalcMuestraAulasSeleccionar(config?: Record<string, unknown>, frame?: CalcMuestraAulasFrame, methodId?: string, objectiveConfig?: CalcMuestraAulasObjectiveConfig) {
  return handle<CalcMuestraAulasAsyncResponse<{ selection: CalcMuestraAulasSelection }>>(
    await apiFetch("/api/calc-muestra/aulas/seleccionar", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ ...(config ? { config } : {}), ...(frame ? { frame } : {}), ...(methodId ? { method_id: methodId } : {}), ...(objectiveConfig ? { objective_config: objectiveConfig } : {}) }),
    }),
  );
}

export async function apiCalcMuestraAulasSimularReemplazos(payload: {
  config?: Record<string, unknown>;
  objective_config?: CalcMuestraAulasObjectiveConfig;
  frame?: CalcMuestraAulasFrame;
  selection?: CalcMuestraAulasSelection;
} = {}) {
  // Sobre el umbral de aulas del backend este endpoint también deriva a job
  // ({ mode: "job", job_id }), mismo patrón que comparar-metodos/seleccionar.
  // Backends viejos siguen respondiendo síncrono (rama sin `mode`).
  return handle<CalcMuestraAulasAsyncResponse<{ replacement_simulation: CalcMuestraAulasReplacementSimulation }>>(
    await apiFetch("/api/calc-muestra/aulas/simular-reemplazos", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
}

export async function apiCalcMuestraAulasExportar() {
  return handle<{ ok: true; export: { ok?: true; file_id: string; filename: string; size: number }; state: CalcMuestraState }>(
    await apiFetch("/api/calc-muestra/aulas/exportar", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({}),
    }),
  );
}

/** Una variable de la solicitud de base a DTI (claves congeladas del contrato). */
export type CalcMuestraSolicitudDtiVariable = {
  rol: string;
  label: string;
  /** Hoja donde se espera la columna (base de matrícula / catálogo de cursos). */
  hoja: string;
  requerida: boolean;
  descripcion: string;
};

/**
 * Exporta el XLSX de solicitud de base para DTI: estructura de variables
 * esperadas + criterios de la reunión del diseño muestral en bullets, listo
 * para adjuntar al correo. Devuelve el binario (mismo patrón blob que
 * apiDashboardBaseDatosDescargar).
 */
export async function apiCalcMuestraSolicitudDtiExportar(payload: {
  variables: CalcMuestraSolicitudDtiVariable[];
  notas?: string[];
}): Promise<Blob> {
  const res = await apiFetch("/api/calc-muestra/solicitud-dti", {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    throw new Error(downloadFailedMessage(res.status, raw));
  }
  return await res.blob();
}

// ----------------------------------------------------------------------------
// Inicialización por tipo de estudio (reemplaza los antiguos presets).
//
// Cada tipo de estudio crea una estructura de componentes vacíos lista para
// que el usuario edite N, parámetros y metas por UI. El motor infiere técnicas
// y mínimos automáticamente al completar actor + canal + N.
//
// Variante:
//   - "vacio" (default): solo la estructura, sin datos. Aplica para todos.
//   - "plantilla_pucp" (legacy): conserva presets antiguos cuando se reabre
//     un estudio historico; la ruta activa es `encuesta_estudiantes`.
// ----------------------------------------------------------------------------

export type CalcMuestraVarianteEstudio = "vacio" | "plantilla_pucp";

export async function apiCalcMuestraIniciarEstudio(
  tipo: CalcMuestraMacroFamilia,
  variante: CalcMuestraVarianteEstudio = "vacio",
) {
  return handle<{ ok: true; estudio: CalcMuestraEstudio; state?: CalcMuestraState; demo_warning?: string | null }>(
    await apiFetch("/api/calc-muestra/iniciar-estudio", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ tipo, variante }),
    }),
  );
}

export async function apiCalcMuestraModoTrabajo(modo: CalcMuestraModoTrabajo) {
  return handle<{ ok: true; modo_trabajo: CalcMuestraModoTrabajo; estudio: CalcMuestraEstudio }>(
    await apiFetch("/api/calc-muestra/modo-trabajo", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ modo }),
    }),
  );
}

export async function apiCalcMuestraReporteIniciar(formato: "html" | "pdf" = "html") {
  return handle<{ ok: true; job_id: string; formato: "html" | "pdf" }>(
    await apiFetch("/api/calc-muestra/reporte", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ formato }),
    }),
  );
}

export function calcMuestraReporteDescargarUrl(opts: { inline?: boolean } = {}): string {
  const sid = localStorage.getItem(SESSION_KEY);
  const params = new URLSearchParams();
  if (sid) params.set("sid", sid);
  if (opts.inline) params.set("inline", "1");
  const qs = params.toString();
  return apiPath(`/api/calc-muestra/reporte/descargar${qs ? `?${qs}` : ""}`);
}
