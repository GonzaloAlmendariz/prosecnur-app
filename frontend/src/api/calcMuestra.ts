// calcMuestra.ts — calculador de muestra (módulo calc-muestra + legacy aulas).
// Extraído de client.ts (split por dominio, 2026-07). Los consumidores
// importan del barrel ./client; este módulo no cambia el contrato.

import { apiFetch, apiPath, downloadFailedMessage, handle, headers, SESSION_KEY } from "./core";
import type { MonitoreoRow } from "./monitoreo";
import type { CalcMuestraAulasCriteriosRadiografia } from "./calcMuestraCriteriosRadiografia";
import type {
  CalcMuestraAlumnosPorCh,
  CalcMuestraAlumnosPorChDecision,
} from "./calcMuestraAlumnosPorCh";

export * from "./calcMuestraCriteriosRadiografia";
export * from "./calcMuestraMatrizEmbudo";
export * from "./calcMuestraAlumnosPorCh";

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
  /**
   * Mediana del tamaño de conglomerado del estrato. El motor R la acepta desde
   * siempre y la usa cuando `estadistico_conglomerado` vale `mediana` o
   * `min_media_mediana` —la regla del diseño de 2025—, pero degrada a la media
   * en silencio si llega en 0. Faltaba declararla aquí, así que no había forma
   * de enviarla y el modo no podía dispararse nunca.
   */
  mediana_conglomerado?: number;
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
  /** Método y valor que R resolvió desde la decisión vigente de Marco. */
  estadistico_usado?: CalcMuestraAlumnosPorChDecision["estadistico_default"];
  alumnos_por_ch?: {
    /** `sin_decision`: la fila se calculó con el promedio GLOBAL porque la
     *  decisión de alumnos por CH no está firmada. No es un detalle: la
     *  cantidad de aulas de cada facultad depende de cuántos elegibles hay por
     *  curso-horario ALLÍ, de 16 a 46 según la facultad. */
    estado?: "sin_decision";
    aviso?: string;
    referencia: "marco_ejecutado" | "promedio_global";
    frame_hash?: string;
    denominador?: "elegible";
    faculty_key?: string;
    estadistico?: CalcMuestraAlumnosPorChDecision["estadistico_default"];
    valor?: number;
  };
  /** Cuántas aulas HAY frente a las que la facultad necesita. El motor sabía
   *  cuántas pedía y no decía cuántas existen: LETRAS Y CIENCIAS HUMANAS
   *  requiere 16 y tiene 16, así que ninguna queda para reemplazar. */
  margen?: {
    aulas_disponibles: number | null;
    aulas_requeridas: number | null;
    aulas_sobrantes: number | null;
    reservas_sostenibles: number | null;
    reservas_pedidas: number | null;
    estado: "insuficiente" | "sin_reservas" | "reservas_cortas" | "holgado" | "desconocido";
    aviso: string;
  };
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
  /** Auditoría I18: la UI la presenta, pero no reinterpreta ni recalcula. */
  alumnos_por_ch_decision?: Omit<CalcMuestraAlumnosPorChDecision, "por_facultad">;
  /** Payload crítico raw; solo el normalizador I19 acredita la variante ready. */
  distribucion_universitaria?: unknown;
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
  /** Afijación del diseño: facultad → aulas titulares (el motor la respeta en
   *  el sorteo; ver calc_muestra_aulas_afijacion.R y afijacionTargets.ts). */
  faculty_targets?: Record<string, number>;
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
  /** Facultades excluidas del estudio por decisión de diseño (no por tamaño). */
  excluded_faculties?: string[];
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
  /** Decisión confirmada en Marco → Alumnos por CH; firma el frame ejecutado. */
  alumnos_por_ch_decision?: CalcMuestraAlumnosPorChDecision;
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
  // `by_faculty` es el candado del operativo de 2025: la reserva sale de la
  // misma facultad, y el tamaño puede variar. `by_cell` exige la celda entera
  // (facultad × sexo × tamaño) y por eso deja cadenas cortas donde la celda es
  // fina. Cualquier otro valor deja el pool libre tras agotar la celda.
  replacement_depth_strategy?:
    | "max_complete_chains_by_cell"
    | "max_complete_chains_by_faculty"
    | string;
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
  /**
   * ADR 0060 · catálogo de filtros de corte del instrumento que produjo esta
   * base. Vive en el binding y no en el workspace para que viaje en el `.pulso`
   * junto a la fuente que describe: dos bases distintas pueden declarar filtros
   * distintos, y un catálogo suelto no sabría a cuál pertenece.
   */
  filtros_corte?: CalcMuestraFiltroCorteDeclarado[];
};

/**
 * ADR 0060 · lo que el usuario declara por filtro. Cuántos hay, cómo se llaman,
 * qué columna los produce y qué condición los dispara es propiedad del estudio;
 * la `clase` es lo único cerrado, porque es lo que el motor interpreta para
 * decidir el efecto sobre el denominador.
 */
export type CalcMuestraFiltroCorteDeclarado = {
  id: string;
  etiqueta: string;
  columna: string;
  condicion: string;
  clase: CalcMuestraReferenciaAsistenciaFiltroClase;
  origen: "campo" | "formulario";
  orden: number;
  /** Una sugerencia no cuenta como declarada hasta que el usuario la confirma. */
  confirmado: boolean;
};

/** ADR 0060 · la clase decide si el corte queda dentro o fuera del denominador. */
export const CALC_MUESTRA_FILTRO_CLASES: Array<{
  clase: CalcMuestraReferenciaAsistenciaFiltroClase;
  label: string;
  detalle: string;
  enDenominador: boolean;
}> = [
  {
    clase: "rechazo",
    label: "Rechazo",
    detalle: "Podía responder y no quiso. Es una pérdida real del operativo.",
    enDenominador: true,
  },
  {
    clase: "abandono",
    label: "Abandono",
    detalle: "Empezó y no terminó, sin declinar explícitamente.",
    enDenominador: true,
  },
  {
    clase: "no_elegible",
    label: "No elegible",
    detalle: "No pertenecía al estudio. Nunca debió contar en la meta.",
    enDenominador: false,
  },
  {
    clase: "ya_medido",
    label: "Ya medido",
    detalle: "Respondió en otro encuentro. No es pérdida: ya cumplió.",
    enDenominador: false,
  },
];

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
  /**
   * D6 (ADR 0060) · registros del marco sin dato para evaluar el criterio.
   * Divulgación aditiva: frames previos no lo traen y no hay UI en esta ronda.
   */
  composicion_na_n?: number | null;
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
  /** Facultad -> rangos admitidos del nivel del curso. La clave puede ser la
   *  etiqueta del marco («EE.GG. LETRAS», como la guarda el motor) o el slug
   *  de la UI; se comparan canonicalizadas. El valor viaja en dos shapes: la
   *  UI emite pares [min, max] y el motor R emite objetos {min, max} más el
   *  centinela de exención [{exenta: true}] («esta facultad no se juzga por
   *  nivel»). Leer SIEMPRE vía rangosFacultad/rangosDesdeMapa
   *  (dominio/rangosNivel.ts), que normalizan ambos; el motor también acepta
   *  ambos desde .cm_criterios_normalize_rangos. */
  courseLevelRanges?: Record<
    string,
    Array<[number, number] | { min?: number; max?: number; exenta?: boolean }>
  >;
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
   * Cuánto dejó pasar cada criterio de alumno y sobre qué total. Crudo: se lee
   * con `normalizeCalcMuestraCriteriosAlumnoReporte`.
   */
  criterios_alumno_report?: unknown;
  /**
   * Impacto de los tipos de sesión EXCLUIDOS del set global, por facultad
   * (contrato congelado cm_session_type_impacto_v1): qué facultades pierden CH
   * y elegibles por cada tipo excluido, y dónde ya está exceptuado.
   * Retrocompatible: marcos viejos no lo traen — sin el campo la tarjeta se
   * comporta como hoy (sin aviso). El consumidor debe pasarlo por
   * `normalizeCalcMuestraSessionTypeImpacto` (payload crítico).
   */
  session_type_impacto?: CalcMuestraSessionTypeImpacto | null;
  /** Distribución R que sustenta la decisión de alumnos por curso-horario. */
  alumnos_por_ch?: CalcMuestraAlumnosPorCh | null;
} & import("./calcMuestraCriteriosI18b").CalcMuestraCriteriosI18bFrameFields;

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
/**
 * Recorte de cada criterio de ALUMNO, tal como lo publica el motor en
 * `frame.criterios_alumno_report`.
 *
 * El motor lo calcula desde hace tiempo (`calc_muestra_aulas.R:1520`) y hasta
 * 2026-08-16 no estaba ni tipado aquí: el desglose no llegaba a ninguna
 * pantalla. La UI mostraba el agregado —cuántos estudiantes quedan— pero no
 * cuánto se llevó cada criterio, que es lo que hace falta para decidir uno.
 *
 * Medido sobre el proyecto real de 2025-2: `age` recorta 12.924 filas,
 * `condition` 12.117, `formation` 11.281, `faculty` 8.266 y `level` **0** — un
 * criterio activo que no muerde y que sólo se detectaba calculándolo a mano.
 */
export type CalcMuestraCriterioAlumnoReporte = {
  /** Id de la variable: `age`, `condition`, `formation`, `faculty`, `level`. */
  id: string;
  /** `marco` recorta la población; `instrumento`/`procesamiento` sólo se reportan. */
  layer: string;
  /** Filas (alumno x curso-horario) que el criterio deja pasar. */
  filas_pasan: number;
  /**
   * El criterio se pudo medir. Falso cuando su columna no trae ningún dato: sin
   * señal la evaluación deja pasar a todo el mundo, y ese `filas_pasan` es
   * indistinguible del de un criterio que sí se midió y no recortó.
   */
  evaluable: boolean;
};

export type CalcMuestraCriteriosAlumnoReporte = {
  /** Si hay algún criterio de alumno en la suite. Sin ella, nada recorta. */
  activa: boolean;
  /**
   * Filas del universo sobre el que cortan TODOS estos criterios. Sin él el
   * recorte de cada uno sólo puede inferirse del que más pasa, y esa cota
   * inferior únicamente es exacta cuando alguno no recorta nada; `null` cuando
   * el frame es anterior al contrato.
   */
  filas_total: number | null;
  criterios: CalcMuestraCriterioAlumnoReporte[];
};

/**
 * Normaliza el reporte. Devuelve `null` si el frame no lo trae —frames
 * anteriores al contrato— para que la superficie distinga «no se midió» de
 * «midió cero», que es justo la distinción que este dato existe para hacer.
 */
export function normalizeCalcMuestraCriteriosAlumnoReporte(
  raw: unknown,
): CalcMuestraCriteriosAlumnoReporte | null {
  if (raw == null || typeof raw !== "object") return null;
  const unwrap = (v: unknown): unknown => (Array.isArray(v) ? (v.length > 0 ? v[0] : null) : v);
  const root = raw as Record<string, unknown>;
  const criteriosRaw = unwrap(root.criterios);
  if (criteriosRaw == null || typeof criteriosRaw !== "object") return null;

  const criterios: CalcMuestraCriterioAlumnoReporte[] = [];
  for (const [id, valor] of Object.entries(criteriosRaw as Record<string, unknown>)) {
    const fila = unwrap(valor);
    if (fila == null || typeof fila !== "object") continue;
    const f = fila as Record<string, unknown>;
    const pasanRaw = unwrap(f.filas_pasan);
    const pasan = typeof pasanRaw === "number"
      ? pasanRaw
      : typeof pasanRaw === "string" ? Number(pasanRaw.trim()) : Number.NaN;
    // Sin conteo no hay recorte que mostrar: la fila se descarta en vez de
    // publicar un 0, que afirmaría que el criterio no dejó pasar a nadie.
    if (!Number.isFinite(pasan)) continue;
    const layerRaw = unwrap(f.layer);
    const evaluableRaw = unwrap(f.evaluable);
    criterios.push({
      id,
      layer: typeof layerRaw === "string" && layerRaw !== "NA" ? layerRaw : "marco",
      filas_pasan: pasan,
      // Ausente se lee como medible: los frames anteriores al contrato no traen
      // la clave, y asumir lo contrario marcaría como no medidos criterios que
      // sí corrieron — al revés del error que este dato existe para evitar.
      evaluable: evaluableRaw === undefined || evaluableRaw === null
        ? true
        : !(evaluableRaw === false || evaluableRaw === "FALSE"),
    });
  }
  if (!criterios.length) return null;

  const activaRaw = unwrap(root.activa);
  const totalRaw = unwrap(root.filas_total);
  const total = typeof totalRaw === "number"
    ? totalRaw
    : typeof totalRaw === "string" ? Number(totalRaw.trim()) : Number.NaN;
  return {
    activa: activaRaw === true || activaRaw === "TRUE",
    // Un total no positivo no es un universo: se trata como ausente antes que
    // dejar que la pantalla divida por él.
    filas_total: Number.isFinite(total) && total > 0 ? total : null,
    criterios,
  };
}

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

/**
 * Balance de sexo de la selección, POR FACULTAD.
 *
 * El informe de representatividad publica el eje sexo en UNA fila —53,8 % de
 * mujeres en el marco contra 52,1 % en lo elegido, dentro de tolerancia— y ese
 * agregado cuadra mientras esconde que ARTE Y DISEÑO ofrece 62 % donde su cuota
 * pide 76 %. Se mide sobre las TITULARES, que son las que se visitan.
 *
 * `veredicto: "ninguno"` es deliberado: con dos aulas ninguna selección cae
 * dentro de una tolerancia pensada para el agregado, así que marcarlas como
 * incumplidas sería un aviso falso.
 */
export type CalcMuestraSexoPorFacultadFila = {
  faculty_key: string;
  facultad: string;
  aulas_titulares: number;
  marco_prop_mujeres: number | null;
  titulares_prop_mujeres: number | null;
  brecha_pp: number | null;
  estado: "medido" | "sin_dato";
  aviso: string;
};

export type CalcMuestraSexoPorFacultad = {
  schema: "calc_muestra_aulas_sexo_por_facultad_v1";
  base: string;
  tolerancia: number | null;
  /** Ordenadas de la peor brecha a la mejor. */
  filas: CalcMuestraSexoPorFacultadFila[];
};

export function normalizeCalcMuestraSexoPorFacultad(
  raw: unknown,
): CalcMuestraSexoPorFacultad | null {
  const asText = (v: unknown): string => {
    const x = Array.isArray(v) ? v[0] : v;
    return typeof x === "string" ? x.trim() : typeof x === "number" ? String(x) : "";
  };
  const asNum = (v: unknown): number | null => {
    const x = Array.isArray(v) ? v[0] : v;
    const n = typeof x === "number" ? x : typeof x === "string" ? Number(x) : NaN;
    return Number.isFinite(n) ? n : null;
  };
  const asList = (v: unknown): unknown[] => (Array.isArray(v) ? v : v == null ? [] : [v]);
  const asRecord = (v: unknown): Record<string, unknown> =>
    v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  const r = asRecord(raw);
  const filas = asList(r.filas)
    .map((rawFila): CalcMuestraSexoPorFacultadFila | null => {
      const f = asRecord(rawFila);
      const facultad = asText(f.facultad);
      if (!facultad) return null;
      return {
        faculty_key: asText(f.faculty_key),
        facultad,
        aulas_titulares: asNum(f.aulas_titulares) ?? 0,
        marco_prop_mujeres: asNum(f.marco_prop_mujeres),
        titulares_prop_mujeres: asNum(f.titulares_prop_mujeres),
        brecha_pp: asNum(f.brecha_pp),
        estado: asText(f.estado) === "medido" ? "medido" : "sin_dato",
        aviso: asText(f.aviso),
      };
    })
    .filter((f): f is CalcMuestraSexoPorFacultadFila => f != null);
  if (!filas.length) return null;
  return {
    schema: "calc_muestra_aulas_sexo_por_facultad_v1",
    base: asText(r.base) || "titulares",
    tolerancia: asNum(r.tolerancia),
    filas,
  };
}

export type CalcMuestraCertificacionSexoCelda = {
  sexo: "F" | "M";
  cuota: number | null;
  elegibles: number | null;
  esperadas: number | null;
  margen: number | null;
  /** null cuando la tasa no está declarada: la celda queda medida, no afirmada. */
  cubre: boolean | null;
};

export type CalcMuestraCertificacionFacultadFila = {
  faculty_key: string;
  facultad: string;
  cuota: number | null;
  aulas_titulares: number;
  elegibles_titulares: number | null;
  efectivas_esperadas: number | null;
  margen: number | null;
  estado: "certificada" | "no_cubre" | "sin_titulares" | "sin_tasa" | "sin_cuota";
  aviso: string;
  /** Cuotas de hombre y mujer por celda (distribucion_sub del cálculo). */
  sexo: CalcMuestraCertificacionSexoCelda[];
};

/** Certificación por facultad de la selección (Gonzalo: «la selección de
 *  aulas tiene que certificarse de esa forma»): ¿las titulares cargan los
 *  ALUMNOS que la cuota exige, con la tasa esperada? Derivada al servir en
 *  calc_muestra_aulas_certificacion.R. */
export type CalcMuestraCertificacionFacultad = {
  schema: "calc_muestra_aulas_certificacion_facultad_v1";
  tasa_esperada: number | null;
  certificadas: number;
  evaluables: number;
  total: number;
  ok: boolean;
  filas: CalcMuestraCertificacionFacultadFila[];
};

const CERT_ESTADOS = ["certificada", "no_cubre", "sin_titulares", "sin_tasa", "sin_cuota"] as const;

export function normalizeCalcMuestraCertificacionFacultad(
  raw: unknown,
): CalcMuestraCertificacionFacultad | null {
  const asText = (v: unknown): string => {
    const x = Array.isArray(v) ? v[0] : v;
    return typeof x === "string" ? x.trim() : typeof x === "number" ? String(x) : "";
  };
  const asNum = (v: unknown): number | null => {
    const x = Array.isArray(v) ? v[0] : v;
    const n = typeof x === "number" ? x : typeof x === "string" ? Number(x) : NaN;
    return Number.isFinite(n) ? n : null;
  };
  const asBool = (v: unknown): boolean => {
    const x = Array.isArray(v) ? v[0] : v;
    return x === true;
  };
  const asList = (v: unknown): unknown[] => (Array.isArray(v) ? v : v == null ? [] : [v]);
  const asRecord = (v: unknown): Record<string, unknown> =>
    v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  const r = asRecord(raw);
  if (asText(r.schema) !== "calc_muestra_aulas_certificacion_facultad_v1") return null;
  const filas = asList(r.filas)
    .map((rawFila): CalcMuestraCertificacionFacultadFila | null => {
      const f = asRecord(rawFila);
      const facultad = asText(f.facultad);
      if (!facultad) return null;
      const estadoRaw = asText(f.estado);
      const estado = (CERT_ESTADOS as readonly string[]).includes(estadoRaw)
        ? (estadoRaw as CalcMuestraCertificacionFacultadFila["estado"])
        : "sin_cuota";
      const sexo = asList(f.sexo)
        .map((rawCelda): CalcMuestraCertificacionSexoCelda | null => {
          const c = asRecord(rawCelda);
          const sx = asText(c.sexo).toUpperCase();
          if (sx !== "F" && sx !== "M") return null;
          const cubreRaw = Array.isArray(c.cubre) ? c.cubre[0] : c.cubre;
          return {
            sexo: sx,
            cuota: asNum(c.cuota),
            elegibles: asNum(c.elegibles),
            esperadas: asNum(c.esperadas),
            margen: asNum(c.margen),
            cubre: typeof cubreRaw === "boolean" ? cubreRaw : null,
          };
        })
        .filter((c): c is CalcMuestraCertificacionSexoCelda => c != null);
      return {
        faculty_key: asText(f.faculty_key),
        facultad,
        cuota: asNum(f.cuota),
        aulas_titulares: asNum(f.aulas_titulares) ?? 0,
        elegibles_titulares: asNum(f.elegibles_titulares),
        efectivas_esperadas: asNum(f.efectivas_esperadas),
        margen: asNum(f.margen),
        estado,
        aviso: asText(f.aviso),
        sexo,
      };
    })
    .filter((f): f is CalcMuestraCertificacionFacultadFila => f != null);
  if (!filas.length) return null;
  return {
    schema: "calc_muestra_aulas_certificacion_facultad_v1",
    tasa_esperada: asNum(r.tasa_esperada),
    certificadas: asNum(r.certificadas) ?? 0,
    evaluables: asNum(r.evaluables) ?? 0,
    total: asNum(r.total) ?? filas.length,
    ok: asBool(r.ok),
    filas,
  };
}

export type CalcMuestraAulasSelection = {
  schema: "calc_muestra_aulas_selection_v1" | string;
  /** Balance de sexo por facultad; derivado al servir, puede no venir. */
  sexo_por_facultad?: unknown;
  /** Certificación por facultad; derivada al servir, puede no venir. */
  certificacion_facultad?: unknown;
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

export const CALC_MUESTRA_AULAS_CERTEZA_SCHEMA =
  "calc_muestra_aulas_certeza_cobertura_v1" as const;

/**
 * Un candidato evaluado: con `aulas` cursos-horario, en qué proporción de los
 * sorteos simulados se alcanzó la cuota.
 */
export type CalcMuestraAulasCertezaPunto = {
  aulas: number;
  probabilidad: number;
  rendimiento_medio: number;
  rendimiento_p05: number;
};

export type CalcMuestraAulasCertezaFila = {
  key: string;
  label: string;
  disponibles: number;
  cuota: number;
  tau: number | null;
  /** Lo que pide hoy la división `cuota / (tamaño típico × τ)`. */
  aulas_formula: number;
  /** Probabilidad de que ese número alcance la cuota. Ahí está el hallazgo. */
  probabilidad_formula: number | null;
  aulas_certeza: number | null;
  probabilidad_certeza: number | null;
  brecha: number | null;
  alcanzable: boolean;
  /** Ni con todas las aulas del estrato se llega: el marco no da. */
  agotado: boolean;
  motivo: string;
  rendimiento_medio: number | null;
  rendimiento_p05: number | null;
  /** `suma_elegibles` = marco sin ids; el rendimiento es una cota superior. */
  base_conteo: string;
  corridas: number;
  tope_evaluaciones?: boolean;
  curva: CalcMuestraAulasCertezaPunto[];
};

export type CalcMuestraAulasCerteza = {
  schema: typeof CALC_MUESTRA_AULAS_CERTEZA_SCHEMA;
  generado_en: string;
  nivel: number;
  engine: string;
  frame_hash: string;
  corridas_solicitadas: number;
  criterio: {
    pregunta: string;
    metodo: string;
    unidad: string;
    olas: string;
    no_cubre: string;
  };
  filas: CalcMuestraAulasCertezaFila[];
  total: {
    aulas_formula: number;
    aulas_certeza: number;
    brecha: number;
    estratos_cortos: number;
    estratos_agotados: number;
    estratos_sin_ids: number;
  };
};

export const CALC_MUESTRA_REFERENCIA_CRITERIOS_SCHEMA =
  "calc_muestra_referencia_criterios_v1" as const;

/**
 * Histórico de CRITERIOS del estudio anterior: el método general y las cuentas
 * por facultad.
 *
 * El proyecto ya ingería una referencia del estudio previo, pero es la de
 * ASISTENCIA. Para comparar criterios no servía: de las 269 anclas de
 * `criterios_anclas_historicas` —grano criterio × facultad— 252 decían
 * «incompatible» y sólo 17 traían dato, todas de un mismo criterio. La
 * estantería estaba y el dato no.
 *
 * Sale de las hojas `cuotas` y `diseno` del mismo libro que el endpoint de
 * referencia ya leía. Lo que la hoja no trae viaja como `null`, nunca 0.
 */
export type CalcMuestraReferenciaCriteriosFila = {
  faculty_key: string;
  facultad: string;
  poblacion: number | null;
  cuota: number | null;
  cuota_mujeres: number | null;
  cuota_hombres: number | null;
  sobremuestra: number | null;
  aulas_universo: number | null;
  aulas_sorteadas: number | null;
  aulas_titulares: number | null;
  /** Aulas donde el estudio anterior APLICÓ la encuesta. 2025 declaró 170
   *  titulares y aplicó 194: la diferencia son los reemplazos. */
  aulas_aplicadas: number | null;
  alumnos_por_ch: number | null;
  piso_matriculados: number | null;
  efectivas_logradas: number | null;
  asistentes: number | null;
};

export type CalcMuestraReferenciaCriterios = {
  schema: typeof CALC_MUESTRA_REFERENCIA_CRITERIOS_SCHEMA;
  periodo: string;
  estudio: string;
  /** Pares campo/valor del diseño anterior, tal cual: es lo que permite
   *  comparar MÉTODO y no sólo números. */
  general: Record<string, string>;
  por_facultad: CalcMuestraReferenciaCriteriosFila[];
};

export function normalizeCalcMuestraReferenciaCriterios(
  raw: unknown,
): CalcMuestraReferenciaCriterios | null {
  const asText = (v: unknown): string => {
    const x = Array.isArray(v) ? v[0] : v;
    return typeof x === "string" ? x.trim() : typeof x === "number" ? String(x) : "";
  };
  const asNum = (v: unknown): number | null => {
    const x = Array.isArray(v) ? v[0] : v;
    const n = typeof x === "number" ? x : typeof x === "string" ? Number(x) : NaN;
    return Number.isFinite(n) ? n : null;
  };
  const asList = (v: unknown): unknown[] => (Array.isArray(v) ? v : v == null ? [] : [v]);
  const asRecord = (v: unknown): Record<string, unknown> =>
    v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  const r = asRecord(raw);
  const filas = asList(r.por_facultad)
    .map((rawFila): CalcMuestraReferenciaCriteriosFila | null => {
      const f = asRecord(rawFila);
      const facultad = asText(f.facultad);
      if (!facultad) return null;
      return {
        faculty_key: asText(f.faculty_key),
        facultad,
        poblacion: asNum(f.poblacion),
        cuota: asNum(f.cuota),
        cuota_mujeres: asNum(f.cuota_mujeres),
        cuota_hombres: asNum(f.cuota_hombres),
        sobremuestra: asNum(f.sobremuestra),
        aulas_universo: asNum(f.aulas_universo),
        aulas_sorteadas: asNum(f.aulas_sorteadas),
        aulas_titulares: asNum(f.aulas_titulares),
        aulas_aplicadas: asNum(f.aulas_aplicadas),
        alumnos_por_ch: asNum(f.alumnos_por_ch),
        piso_matriculados: asNum(f.piso_matriculados),
        efectivas_logradas: asNum(f.efectivas_logradas),
        asistentes: asNum(f.asistentes),
      };
    })
    .filter((f): f is CalcMuestraReferenciaCriteriosFila => f != null);
  if (!filas.length) return null;
  const generalRaw = asRecord(r.general);
  const general: Record<string, string> = {};
  for (const k of Object.keys(generalRaw)) {
    const v = asText(generalRaw[k]);
    if (v) general[k] = v;
  }
  return {
    schema: CALC_MUESTRA_REFERENCIA_CRITERIOS_SCHEMA,
    periodo: asText(r.periodo),
    estudio: asText(r.estudio),
    general,
    por_facultad: filas,
  };
}

export const CALC_MUESTRA_SALUD_CRITERIOS_SCHEMA =
  "calc_muestra_aulas_salud_criterios_v1" as const;

/**
 * Estado de salud de un criterio de AULA sobre el marco vigente.
 *
 * `sin_senal` es el que importa: la columna del criterio llega vacía, así que
 * deja pasar a todos y **no es que no recorte**. Esa distinción es la que faltó
 * cuatro veces —`exclude_level_patterns` buscando «posgrado» en un número de
 * ciclo, `session_type` vacío en las 5.263 aulas, `teacher_type` con nombres
 * propios como categorías— y en las cuatro el marco se publicó igual.
 */
export type CalcMuestraSaludCriterioEstado =
  | "sin_senal"
  | "sin_coincidencia"
  | "sin_categorias"
  | "parcial"
  | "ok"
  | "desconocido";

export type CalcMuestraSaludCriterioFacultad = {
  facultad: string;
  aulas: number;
  con_valor: number;
};

export type CalcMuestraSaludCriterioFila = {
  criterion_id: string;
  label: string;
  columna: string;
  columna_en_el_marco: boolean;
  aulas: number;
  aulas_con_valor: number;
  kind: string;
  categorias_declaradas: number;
  categorias_presentes: number;
  categorias_ausentes: string[];
  estado: CalcMuestraSaludCriterioEstado;
  aviso: string;
  /** Ordenado de la facultad peor cubierta a la mejor. */
  por_facultad: CalcMuestraSaludCriterioFacultad[];
};

export type CalcMuestraSaludCriterios = {
  schema: typeof CALC_MUESTRA_SALUD_CRITERIOS_SCHEMA;
  grain: "criterio";
  unit: string;
  momento: string;
  filas: CalcMuestraSaludCriterioFila[];
};

const SALUD_ESTADOS: readonly CalcMuestraSaludCriterioEstado[] = [
  "sin_senal", "sin_coincidencia", "sin_categorias", "parcial", "ok", "desconocido",
];

/**
 * Normalizador defensivo: R serializa un escalar como array de uno y una lista
 * vacía como `{}`. Una fila sin `criterion_id` se descarta en vez de pintarse
 * con el nombre en blanco.
 */
export function normalizeCalcMuestraSaludCriterios(
  raw: unknown,
): CalcMuestraSaludCriterios | null {
  // Los helpers viven dentro de cada normalizador en este módulo; se repiten
  // aquí por la misma razón: R serializa un escalar como array de uno.
  const asText = (v: unknown): string => {
    const x = Array.isArray(v) ? v[0] : v;
    return typeof x === "string" ? x.trim() : typeof x === "number" ? String(x) : "";
  };
  const asNum = (v: unknown): number | null => {
    const x = Array.isArray(v) ? v[0] : v;
    const n = typeof x === "number" ? x : typeof x === "string" ? Number(x) : NaN;
    return Number.isFinite(n) ? n : null;
  };
  const asList = (v: unknown): unknown[] => (Array.isArray(v) ? v : v == null ? [] : [v]);
  const asRecord = (v: unknown): Record<string, unknown> =>
    v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  const r = asRecord(raw);
  const filas = asList(r.filas)
    .map((rawFila): CalcMuestraSaludCriterioFila | null => {
      const f = asRecord(rawFila);
      const id = asText(f.criterion_id);
      if (!id) return null;
      const estadoText = asText(f.estado) as CalcMuestraSaludCriterioEstado;
      return {
        criterion_id: id,
        label: asText(f.label) || id,
        columna: asText(f.columna),
        columna_en_el_marco: f.columna_en_el_marco === true,
        aulas: asNum(f.aulas) ?? 0,
        aulas_con_valor: asNum(f.aulas_con_valor) ?? 0,
        kind: asText(f.kind),
        categorias_declaradas: asNum(f.categorias_declaradas) ?? 0,
        categorias_presentes: asNum(f.categorias_presentes) ?? 0,
        categorias_ausentes: asList(f.categorias_ausentes).map(asText).filter(Boolean),
        estado: SALUD_ESTADOS.includes(estadoText) ? estadoText : "desconocido",
        aviso: asText(f.aviso),
        por_facultad: asList(f.por_facultad)
          .map((rawFac) => {
            const p = asRecord(rawFac);
            const facultad = asText(p.facultad);
            if (!facultad) return null;
            return { facultad, aulas: asNum(p.aulas) ?? 0, con_valor: asNum(p.con_valor) ?? 0 };
          })
          .filter((p): p is CalcMuestraSaludCriterioFacultad => p != null),
      };
    })
    .filter((f): f is CalcMuestraSaludCriterioFila => f != null);
  if (!filas.length) return null;
  return {
    schema: CALC_MUESTRA_SALUD_CRITERIOS_SCHEMA,
    grain: "criterio",
    unit: asText(r.unit) || "curso_horario",
    momento: asText(r.momento) || "marco_ejecutado",
    filas,
  };
}

export type CalcMuestraAulasState = {
  config?: Record<string, unknown>;
  frame?: CalcMuestraAulasFrame | null;
  /** Salud de los criterios de aula; derivada al servir, puede no venir. */
  salud_criterios?: CalcMuestraSaludCriterios | null;
  /** Histórico de CRITERIOS del estudio anterior. Crudo: se normaliza en la
   *  superficie que lo consume. */
  referencia_criterios?: unknown;
  selection?: CalcMuestraAulasSelection | null;
  method_comparison?: CalcMuestraAulasMethodComparison | null;
  certeza?: CalcMuestraAulasCerteza | null;
  replacement_simulation?: CalcMuestraAulasReplacementSimulation | null;
  export?: { ok?: true; file_id: string; filename: string; size: number } | null;
  /** Resultado de un job que llegó con un frame_hash que ya no corresponde al
   *  marco vigente (guard del backend): se conserva aparte en vez de pisar el
   *  estado bueno. Retrocompatible: puede no venir. */
  stale_job_result?: Record<string, unknown> | null;
};

export const CALC_MUESTRA_REFERENCIA_ASISTENCIA_SCHEMA =
  "calc_muestra_referencia_asistencia_v2" as const;

/**
 * ADR 0060. Diseño del estudio previo. Sin saber sobre qué meta se trabajó, una
 * tasa de campo es un número suelto: por eso el histórico transporta el diseño
 * junto a las tasas. Todo campo ausente viaja como `null`, nunca como cero.
 */
export type CalcMuestraReferenciaAsistenciaDiseno = {
  poblacion_objetivo: number | null;
  nivel_confianza: number | null;
  proporcion_esperada: number | null;
  margen_error: number | null;
  deff: number | null;
  muestra: number | null;
  ratio_sobremuestra: number | null;
  sobremuestra: number | null;
  aulas_marco: number | null;
  aulas_dimensionadas: number | null;
  aulas_aplicadas: number | null;
  tasa_respuesta_asumida: number | null;
  /** Lo que pasó después del campo, tan parte del diseño como el tamaño. */
  efectivas_logradas: number | null;
  base_analitica: number | null;
  casos_recortados: number | null;
  ponderacion_alcance: string;
  afijacion: string;
  metodo_seleccion: string;
  metodo_ajuste: string;
  ponderado: boolean | null;
  /** Falso cuando la base no documentó su diseño: la referencia sigue siendo válida. */
  declarado: boolean;
};

/** ADR 0060. La clase es lo único cerrado; decide el efecto sobre el denominador. */
export type CalcMuestraReferenciaAsistenciaFiltroClase =
  | "rechazo"
  | "abandono"
  | "no_elegible"
  | "ya_medido";

export type CalcMuestraReferenciaAsistenciaFiltro = {
  id: string;
  etiqueta: string;
  columna: string;
  condicion: string;
  clase: CalcMuestraReferenciaAsistenciaFiltroClase;
  /** Un mismo fenómeno medido por campo y por formulario NO se suma dos veces. */
  origen: "campo" | "formulario";
  orden: number;
  en_denominador: boolean;
};

/**
 * ADR 0060. Taxonomía del encuentro. Es `null` cuando la base histórica no trae
 * las columnas del glosario y el motor tuvo que degradar a la lectura heredada.
 */
export type CalcMuestraReferenciaAsistenciaEncuentros = {
  elegibles: number | null;
  asistentes: number | null;
  ya_medidas: number | null;
  no_elegibles: number | null;
  elegibles_presentes: number | null;
  efectivas: number | null;
  no_efectivas: number | null;
  /** Residual: `null` cuando ninguna unidad lo tiene publicable. */
  no_realizadas: number | null;
  /**
   * Presentes que el conteo del aula no vio: respondieron más personas de las
   * que el aplicador contó. No es un error, es cómo funciona un aula abierta.
   */
  presentes_no_contados: number | null;
  unidades_publicables: number;
  unidades_con_residual_negativo: number;
};

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
  /** ADR 0060: declara si se leyó con el glosario del encuentro o degradado. */
  glosario_completo: boolean;
  columnas_glosario: string[];
  /** ADR 0060 · criterios de curso-horario detectados (condición, nivel, docente…). */
  columnas_criterio: string[];
};

/** ADR 0060: la regla depende de si la base trae el glosario del encuentro. */
export type CalcMuestraReferenciaAsistenciaIdentidadRegla =
  | "elegibles_presentes + presentes_no_contados = efectivas + no_efectivas + no_realizadas"
  | "A = E + no_respondieron";

export type CalcMuestraReferenciaAsistenciaIdentidad = {
  regla: CalcMuestraReferenciaAsistenciaIdentidadRegla;
  verificada: boolean;
  verificables: number;
  inconsistentes: number;
  /** Unidades donde el conteo de campo no cierra. `null` en modo degradado. */
  residuales_negativos: number | null;
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
  | "apertura"
  | "efectividad"
  | "rendimiento";

export type CalcMuestraReferenciaAsistenciaTramo = {
  key: CalcMuestraReferenciaAsistenciaTramoKey;
  label: string;
  k: number;
  numerador: number | null;
  denominador: number | null;
  tasa: number | null;
  /**
   * ADR 0060 · marca del desborde: el conteo de campo no cierra (más
   * numerador que denominador), así que la tasa viaja null y esta bandera
   * divulga por qué. Es la ÚNICA forma sancionada de tasa null con conteos
   * poblados; sin la marca, ese patrón invalida el payload.
   */
  residual_negativo?: boolean;
  ic_low: number | null;
  ic_high: number | null;
  metodo_ic: CalcMuestraReferenciaAsistenciaMetodoIc;
};

export type CalcMuestraReferenciaAsistenciaCadena = {
  asistencia: CalcMuestraReferenciaAsistenciaTramo;
  apertura: CalcMuestraReferenciaAsistenciaTramo;
  efectividad: CalcMuestraReferenciaAsistenciaTramo;
  rendimiento: CalcMuestraReferenciaAsistenciaTramo;
};

export type CalcMuestraReferenciaAsistenciaGlobal = {
  k: number;
  matriculados: number | null;
  asistentes: number | null;
  enviadas: number | null;
  validas: number | null;
  no_respondieron: number | null;
  tasa: number | null;
  /** ADR 0060 · mismo contrato que en el tramo: tasa null sancionada por desborde. */
  residual_negativo?: boolean;
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
  /**
   * G53 · En qué tramo del campo se aplicó esta celda. Una facultad cuyas aulas
   * cayeron todas en la última semana no rindió menos por ser esa facultad,
   * sino porque para entonces el marco ya estaba más agotado. Null cuando la
   * base no declara semana.
   */
  semana_min: number | null;
  semana_max: number | null;
  semana_media: number | null;
  /** Cuántas de sus aulas traen fecha: con la mitad sin fechar, la media miente. */
  k_con_semana: number | null;
  tasa: number | null;
  /** ADR 0060 · mismo contrato que en el tramo: tasa null sancionada por desborde. */
  residual_negativo?: boolean;
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

/**
 * ADR 0060 · el embudo abierto por una dimensión accionable. Una facultad con
 * mucha ausencia y otra con mucho traslape piden decisiones distintas aunque su
 * rendimiento coincida, así que se transporta el desglose y no sólo la tasa.
 */
export type CalcMuestraReferenciaAsistenciaEmbudoFila = {
  celda_key: string;
  celda_label: string;
  k: number;
  /** G53 · La ventana de campo de esta celda; null si la base no trae semana. */
  semana_min: number | null;
  semana_max: number | null;
  semana_media: number | null;
  k_con_semana: number | null;
  elegibles: number | null;
  asistentes: number | null;
  /**
   * ADR 0060 · asistentes - no_elegibles: el único numerador comparable con
   * `elegibles` (mismo universo). Aditivo; bases previas al ADR no lo traen.
   */
  asistentes_elegibles?: number | null;
  ya_medidas: number | null;
  no_elegibles: number | null;
  elegibles_presentes: number | null;
  efectivas: number | null;
  no_efectivas: number | null;
  pct_ausencia: number | null;
  pct_ya_medidas: number | null;
  pct_rechazo: number | null;
  efectividad: number | null;
  rendimiento: number | null;
  /** ADR 0060 · desborde del conteo de la celda: la tasa afectada viaja null. */
  residual_negativo?: boolean;
  /** ADR 0060 · cotas de la asistencia elegible cuando el conteo trae holgura. */
  asistencia_elegibles_min?: number | null;
  asistencia_elegibles_max?: number | null;
};

export type CalcMuestraReferenciaAsistenciaEmbudo = {
  dimension_key: string;
  dimension_label: string;
  orden: number;
  filas: CalcMuestraReferenciaAsistenciaEmbudoFila[];
};

/**
 * Una semana del operativo. La serie existe para poner en el tiempo lo que el
 * agregado esconde: `pct_ya_medidas` creciendo semana a semana es la huella del
 * agotamiento del marco, y sin ella la cifra global no dice si eso pasó.
 */
export type CalcMuestraReferenciaAsistenciaSemana = {
  semana: number;
  etiqueta: string;
  orden: number;
  /** Cursos-horario aplicados esa semana. */
  k: number;
  elegibles: number | null;
  ausentes: number | null;
  asistentes: number | null;
  /**
   * ADR 0060 · asistentes - no_elegibles: numerador de `asistencia` cuando el
   * glosario existe. Aditivo; bases previas al ADR no lo traen.
   */
  asistentes_elegibles?: number | null;
  ya_medidas: number | null;
  no_elegibles: number | null;
  /** Presentes, del estudio y sin haber contestado antes: base de la efectividad. */
  a_encuestar: number | null;
  registros: number | null;
  efectivas: number | null;
  no_efectivas: number | null;
  efectivas_acumuladas: number | null;
  asistencia: number | null;
  /** ADR 0060 · el desborde semanal publica asistencia null + esta marca. */
  residual_negativo?: boolean;
  /** ADR 0060 · cotas de la asistencia elegible cuando el conteo trae holgura. */
  asistencia_elegibles_min?: number | null;
  asistencia_elegibles_max?: number | null;
  pct_ya_medidas: number | null;
  efectividad: number | null;
  /**
   * Sobre qué se midió la efectividad de esa semana. Es el mismo denominador
   * que usa la cadena global —presentes a encuestar con glosario, registros sin
   * él—, para que la cifra semanal y la publicada sean la misma métrica.
   */
  efectividad_denominador: number | null;
  rendimiento: number | null;
  efectivas_por_aula: number | null;
};

/**
 * Cuánto se movió la tasa a lo largo del campo.
 *
 * G53 · Existe porque la tasa que se hereda es un promedio y la superficie la
 * mostraba como una constante. En 2025 la efectividad global (74,6 %) es un
 * ponderado que la semana 1 domina con el 47 % del denominador, mientras el
 * rango real va de 56 % a 80 %.
 */
export type CalcMuestraReferenciaAsistenciaDeriva = {
  tramos: number;
  tramos_medibles: number;
  etiqueta_primera: string;
  etiqueta_ultima: string;
  efectividad_primera: number | null;
  efectividad_ultima: number | null;
  efectividad_min: number | null;
  efectividad_min_etiqueta: string;
  efectividad_min_k: number | null;
  efectividad_max: number | null;
  efectividad_max_etiqueta: string;
  efectividad_max_k: number | null;
  /** El tramo que más pesa en el promedio global, y cuánto pesa. */
  tramo_dominante: string;
  peso_dominante: number | null;
  ya_medidas_primera: number | null;
  ya_medidas_ultima: number | null;
  /** Si el marco se fue agotando: cada semana llegó más gente ya medida. */
  agotamiento_crece: boolean;
  por_aula_primera: number | null;
  por_aula_ultima: number | null;
  puntos: Array<{
    etiqueta: string;
    k: number;
    a_encuestar: number | null;
    efectividad: number | null;
    pct_ya_medidas: number | null;
  }>;
};

export type CalcMuestraReferenciaAsistenciaSerieCampo = {
  unidad: "semana_de_campo";
  filas: CalcMuestraReferenciaAsistenciaSemana[];
  deriva: CalcMuestraReferenciaAsistenciaDeriva | null;
};

/**
 * Un escalón de una cadena: qué pasó con ese curso-horario concreto.
 * `aplicado` se aplicó, `cayo` se trabajó y no se pudo, `reserva` nunca hizo
 * falta contactarlo.
 */
export type CalcMuestraReferenciaAsistenciaEscalon = {
  posicion: number;
  /**
   * En qué semana se aplicó. Sólo la trae el escalón aplicado: una reserva que
   * nadie contactó no ocurrió en ninguna semana. Con ella se ve que un reemplazo
   * no es sólo un escalón más, sino un aula aplicada más tarde, cuando el marco
   * ya estaba más agotado.
   */
  semana: number | null;
  /** «Titular», «Reemplazo 1», «Reemplazo 2»… */
  rol: string;
  curso_horario: string;
  estado: "aplicado" | "cayo" | "reserva";
  efectivas: number | null;
  efectivas_mujeres: number | null;
  efectivas_hombres: number | null;
  elegibles: number | null;
  /** Efectividad de esa aula: la cantidad sola premia al aula grande. */
  rendimiento: number | null;
  motivo: string | null;
  /** Letra estable del motivo, para caber en la casilla. */
  motivo_codigo: string | null;
};

/** Una cadena de selección: un titular y los suplentes que entran si ese se cae. */
export type CalcMuestraReferenciaAsistenciaCadenaSeleccion = {
  cadena: number;
  facultad: string;
  titular: string;
  nombre_curso: string;
  horario: string;
  efectivas_mujeres: number | null;
  efectivas_hombres: number | null;
  escalones: CalcMuestraReferenciaAsistenciaEscalon[];
  escalones_trabajados: number;
  aplicados: number;
  /** Escalón en el que se resolvió; null si la cadena nunca se resolvió. */
  resuelta_en: number | null;
  /** Ventana en la que esta cadena ocurrió de verdad. */
  semana_inicio: number | null;
  semana_fin: number | null;
  efectivas: number | null;
  elegibles: number | null;
  rendimiento: number | null;
};

/** Cuándo se aplicó un grupo de escalones y qué rindió. */
export type CalcMuestraReferenciaAsistenciaPerfilEscalones = {
  aplicados: number;
  /** Semana media de aplicación: los reemplazos ocurren más tarde. */
  semana_media: number | null;
  efectivas: number | null;
  rendimiento: number | null;
};

/**
 * La matriz de cadenas. El diseño no manda aplicar un curso-horario suelto:
 * manda cubrir un puesto, y para cada puesto sortea una cadena que empieza en
 * un titular. Contar sólo cuántas se aplicaron esconde lo que costó.
 */
export type CalcMuestraReferenciaAsistenciaCadenasReemplazo = {
  unidad: "cadena_de_reemplazo";
  cadenas_declaradas: number;
  cadenas_resueltas: number;
  resueltas_con_titular: number;
  resueltas_con_reemplazo: number;
  profundidad_maxima: number;
  /**
   * Titulares y reemplazos comparados como dos grupos. Responde lo que la
   * matriz sola no puede: si los reemplazos se aplicaron más tarde y si eso se
   * notó en lo que rindieron.
   */
  titulares: CalcMuestraReferenciaAsistenciaPerfilEscalones | null;
  reemplazos: CalcMuestraReferenciaAsistenciaPerfilEscalones | null;
  motivos: { motivo: string; codigo: string; n: number; orden: number }[];
  filas: CalcMuestraReferenciaAsistenciaCadenaSeleccion[];
};

/**
 * Composición del marco por criterio, cruzada con facultad. El embudo dice cómo
 * rindió cada tipo de aula; esto dice cuántas hay de cada tipo, que es otra
 * pregunta y hace falta para leer la primera. Una facultad con muchos talleres
 * no se parece a una con clases teóricas grandes.
 */
export type CalcMuestraReferenciaAsistenciaComposicion = {
  criterio_key: string;
  criterio_label: string;
  orden: number;
  categorias: { categoria: string; n: number; pct: number | null }[];
  filas: {
    facultad: string;
    n: number;
    reparto: { categoria: string; n: number; pct: number | null; elegibles: number | null }[];
  }[];
};

/**
 * Cumplimiento de cuota por facultad y sexo.
 *
 * NO es efectividad. La efectividad divide completas entre las personas a las
 * que tocaba encuestar, y su denominador es una población. Aquí el denominador
 * es la cuota, que es una decisión del diseño, así que lo que sale es
 * cumplimiento y puede pasar del 100 %: en 2025 las mujeres cerraron en 144 %.
 */
export type CalcMuestraReferenciaAsistenciaCuotas = {
  unidad: "cumplimiento_de_cuota";
  cuota_mujeres: number | null;
  cuota_hombres: number | null;
  logradas_mujeres: number | null;
  logradas_hombres: number | null;
  cumplimiento_mujeres: number | null;
  cumplimiento_hombres: number | null;
  filas: {
    facultad: string;
    aulas: number;
    cuota_total: number | null;
    cuota_mujeres: number | null;
    cuota_hombres: number | null;
    logradas: number | null;
    logradas_mujeres: number | null;
    logradas_hombres: number | null;
    cumplimiento: number | null;
    cumplimiento_mujeres: number | null;
    cumplimiento_hombres: number | null;
  }[];
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
  unidad: "encuentro_en_curso_horario_aplicado";
  /** ADR 0060: `elegibles_presentes` con el glosario, `matriculados_totales` degradado. */
  denominador: "elegibles_presentes" | "matriculados_totales";
  estudio: CalcMuestraReferenciaAsistenciaEstudio;
  diseno: CalcMuestraReferenciaAsistenciaDiseno;
  filtros_corte: CalcMuestraReferenciaAsistenciaFiltro[];
  cobertura: CalcMuestraReferenciaAsistenciaCobertura;
  encuentros: CalcMuestraReferenciaAsistenciaEncuentros | null;
  /** Vacío cuando la base no trae el glosario del encuentro. */
  embudos: CalcMuestraReferenciaAsistenciaEmbudo[];
  /** Vacío cuando ningún criterio tiene más de una categoría. */
  composicion: CalcMuestraReferenciaAsistenciaComposicion[];
  /** null cuando el estudio no declara cuotas por facultad. */
  cuotas: CalcMuestraReferenciaAsistenciaCuotas | null;
  /** null cuando la base no declara semana de campo. */
  serie_campo: CalcMuestraReferenciaAsistenciaSerieCampo | null;
  /** null cuando la base no declara la cadena de reemplazo. */
  cadenas_reemplazo: CalcMuestraReferenciaAsistenciaCadenasReemplazo | null;
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

  /**
   * G53 · La ventana de campo de una celda. Una base sin columna de semana no
   * la trae, así que sus cuatro campos degradan a null en vez de invalidar la
   * celda: el resto de la lectura no depende de que el estudio fechara sus
   * aulas.
   */
  const ventanaDe = (record: Record<string, unknown>) => {
    const entero = (raw: unknown): number | null => {
      const parsed = asFiniteOrNull(raw);
      return parsed === INVALID_NUMBER || parsed === null || !Number.isInteger(parsed)
        ? null
        : parsed;
    };
    const decimal = (raw: unknown): number | null => {
      const parsed = asFiniteOrNull(raw);
      return parsed === INVALID_NUMBER ? null : parsed;
    };
    return {
      semana_min: entero(record.semana_min),
      semana_max: entero(record.semana_max),
      semana_media: decimal(record.semana_media),
      k_con_semana: entero(record.k_con_semana),
    };
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
    asText(root.unidad) !== "encuentro_en_curso_horario_aplicado" ||
    // ADR 0060: el denominador depende de si el motor leyó el glosario del
    // encuentro. Su coherencia con `cobertura.glosario_completo` se verifica
    // más abajo, cuando ese campo ya está parseado.
    (asText(root.denominador) !== "elegibles_presentes" &&
      asText(root.denominador) !== "matriculados_totales")
  ) return null;

  /*
   * G53 · Los metadatos del estudio son etiquetas, no datos.
   *
   * Exigir id, label y fuente no vacíos tiraba el payload ENTERO cuando el
   * proyecto todavía no tenía título: `{id: "", label: "Estudio sin título",
   * periodo: "", fuente: ""}` devolvía null y la pestaña Histórico mostraba
   * «sube la base del estudio anterior en Fuentes» con la lectura completa ya
   * calculada en la sesión. Un rótulo vacío no invalida 194 aulas medidas: se
   * degrada a vacío y la superficie pone su propio texto.
   */
  const studyRecord = asRecord(root.estudio);
  if (!studyRecord) return null;
  const estudio: CalcMuestraReferenciaAsistenciaEstudio = {
    id: asText(studyRecord.id, true) ?? "",
    label: asText(studyRecord.label, true) ?? "",
    periodo: asText(studyRecord.periodo, true) ?? "",
    fuente: asText(studyRecord.fuente, true) ?? "",
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
  const glosarioCompleto = unwrap(coverageRecord.glosario_completo);
  if (typeof glosarioCompleto !== "boolean") return null;
  const columnasGlosario = asList(coverageRecord.columnas_glosario)
    .map((item) => asText(item))
    .filter((item): item is string => Boolean(item));
  const columnasCriterio = asList(coverageRecord.columnas_criterio)
    .map((item) => asText(item))
    .filter((item): item is string => Boolean(item));
  const cobertura: CalcMuestraReferenciaAsistenciaCobertura = {
    agendados,
    aplicados,
    observados,
    glosario_completo: glosarioCompleto,
    columnas_glosario: columnasGlosario,
    columnas_criterio: columnasCriterio,
  };

  const identityRecord = asRecord(root.identidad);
  if (!identityRecord) return null;
  const identityRule = asText(identityRecord.regla);
  const identityVerified = unwrap(identityRecord.verificada);
  const verificables = asNonNegativeInteger(identityRecord.verificables);
  const inconsistentes = asNonNegativeInteger(identityRecord.inconsistentes);
  // ADR 0060: la regla que aplica la fija el motor según haya leído o no el
  // glosario del encuentro. Aceptar una regla que no corresponde al modo
  // declarado sería admitir un payload incoherente consigo mismo.
  const expectedRule: CalcMuestraReferenciaAsistenciaIdentidadRegla = glosarioCompleto
    ? "elegibles_presentes + presentes_no_contados = efectivas + no_efectivas + no_realizadas"
    : "A = E + no_respondieron";
  const residualesNegativos = identityRecord.residuales_negativos == null
    ? null
    : asNonNegativeInteger(identityRecord.residuales_negativos);
  if (
    identityRule !== expectedRule ||
    typeof identityVerified !== "boolean" ||
    verificables === INVALID_NUMBER ||
    inconsistentes === INVALID_NUMBER ||
    residualesNegativos === INVALID_NUMBER ||
    inconsistentes > verificables ||
    (identityVerified && (verificables === 0 || inconsistentes !== 0))
  ) return null;
  const identidad: CalcMuestraReferenciaAsistenciaIdentidad = {
    regla: expectedRule,
    verificada: identityVerified,
    verificables,
    inconsistentes,
    residuales_negativos: residualesNegativos,
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
  const isProbability = (value: number | null): value is number =>
    value !== null && value >= 0 && value <= 1;
  // ADR 0060 (D5): una tasa mayor que 1 es un defecto de fórmula, no un dato.
  // Antes se toleraba como "diagnóstico" cuando viajaba la advertencia dinámica
  // del backend (`asistentes_mayor_matriculados:N`); hoy invalida el payload
  // con el mismo fallo cerrado que el resto de identidades del normalizador
  // (conteos negativos, cuadre numerador/denominador/tasa, clamp). El backend
  // publica NA + marca residual en esos casos, así que una tasa > 1 solo puede
  // venir de un payload defectuoso.
  const isProbabilityOrNull = (value: number | null) =>
    value === null || isProbability(value);
  const sameSerializedRate = (left: number, right: number) =>
    Math.abs(left - right) <= 5e-4 * Math.max(1, Math.abs(left), Math.abs(right));
  const isNonNegativeCountOrNull = (value: number | null) =>
    value === null || (Number.isInteger(value) && value >= 0);
  // ADR 0060 · marca del desborde. Ausente (payloads previos al ADR) se lee
  // como false; cualquier valor presente que no sea booleano invalida el
  // payload (fail-closed: una marca ilegible no habilita nada).
  const INVALID_FLAG = Symbol("invalid-residual-flag");
  const asResidualFlag = (value: unknown): boolean | typeof INVALID_FLAG => {
    const unwrapped = unwrap(value);
    if (unwrapped === undefined || unwrapped === null) return false;
    return typeof unwrapped === "boolean" ? unwrapped : INVALID_FLAG;
  };
  const ratioMatchesCounts = (
    numerator: number | null,
    denominator: number | null,
    rate: number | null,
    residualNegativo = false,
  ) => {
    if (numerator === null || denominator === null || denominator <= 0) {
      return rate === null;
    }
    if (rate === null) {
      // ADR 0060: la salida SANCIONADA del desborde es tasa null + conteos
      // poblados + `residual_negativo = true`. Sin la marca, una tasa null con
      // conteos poblados sigue siendo payload defectuoso (fail-closed).
      return residualNegativo === true;
    }
    return sameSerializedRate(rate, numerator / denominator);
  };
  // La marca sólo es coherente con la forma sancionada: conteos poblados
  // (el numerador y el denominador quedan para el diagnóstico) y tasa null
  // (la magnitud imposible nunca se publica). Cualquier otra combinación con
  // la marca en true es contradictoria y se rechaza.
  const residualShapeValid = (
    numerator: number | null,
    denominator: number | null,
    rate: number | null,
    residualNegativo: boolean,
  ) =>
    !residualNegativo ||
    (numerator !== null && denominator !== null && denominator > 0 && rate === null);
  const intervalMatchesMethod = (
    k: number,
    rate: number | null,
    low: number | null,
    high: number | null,
    method: CalcMuestraReferenciaAsistenciaMetodoIc,
  ) => {
    if (method === "no_aplica") {
      return low === null && high === null && (k < 12 || rate === null);
    }
    return k >= 12 &&
      rate !== null &&
      low !== null &&
      high !== null &&
      low <= high &&
      isProbability(low) &&
      isProbability(high);
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
    const residualNegativo = asResidualFlag(record.residual_negativo);
    if (
      !label ||
      k === INVALID_NUMBER ||
      numerador === INVALID_NUMBER ||
      denominadorTramo === INVALID_NUMBER ||
      tasa === INVALID_NUMBER ||
      icLow === INVALID_NUMBER ||
      icHigh === INVALID_NUMBER ||
      !metodoIc ||
      residualNegativo === INVALID_FLAG ||
      !isNonNegativeCountOrNull(numerador) ||
      !isNonNegativeCountOrNull(denominadorTramo)
    ) return null;
    if (
      !isProbabilityOrNull(tasa) ||
      !residualShapeValid(numerador, denominadorTramo, tasa, residualNegativo) ||
      !ratioMatchesCounts(numerador, denominadorTramo, tasa, residualNegativo) ||
      !intervalMatchesMethod(k, tasa, icLow, icHigh, metodoIc)
    ) return null;
    return {
      key: expectedKey,
      label,
      k,
      numerador,
      denominador: denominadorTramo,
      tasa,
      residual_negativo: residualNegativo,
      ic_low: icLow,
      ic_high: icHigh,
      metodo_ic: metodoIc,
    };
  };
  const chainRecord = asRecord(root.cadena);
  if (!chainRecord) return null;
  const asistencia = parseTramo(chainRecord.asistencia, "asistencia");
  const apertura = parseTramo(chainRecord.apertura, "apertura");
  const efectividad = parseTramo(chainRecord.efectividad, "efectividad");
  const rendimiento = parseTramo(chainRecord.rendimiento, "rendimiento");
  if (!asistencia || !apertura || !efectividad || !rendimiento) return null;
  if (
    asistencia.k !== apertura.k ||
    asistencia.k !== efectividad.k ||
    asistencia.k !== rendimiento.k ||
    efectividad.numerador !== rendimiento.numerador ||
    asistencia.denominador !== rendimiento.denominador
  ) return null;
  // ADR 0060: las invariantes de encadenamiento dependen del modo. En la lectura
  // heredada la cadena es multiplicativa —presentes sobre matrícula, registros
  // sobre presentes, efectivas sobre registros— y cierra en el rendimiento. Con
  // el glosario, apertura y efectividad comparten el denominador de elegibles
  // presentes y esa multiplicación deja de tener sentido.
  if (glosarioCompleto) {
    if (apertura.denominador !== efectividad.denominador) return null;
  } else if (
    asistencia.numerador !== apertura.denominador ||
    apertura.numerador !== efectividad.denominador ||
    (asistencia.tasa !== null &&
      apertura.tasa !== null &&
      efectividad.tasa !== null &&
      rendimiento.tasa !== null &&
      !sameSerializedRate(
        rendimiento.tasa,
        asistencia.tasa * apertura.tasa * efectividad.tasa,
      ))
  ) return null;
  const cadena: CalcMuestraReferenciaAsistenciaCadena = {
    asistencia,
    apertura,
    efectividad,
    rendimiento,
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
  const globalResidual = asResidualFlag(globalRecord.residual_negativo);
  if (
    globalResidual === INVALID_FLAG ||
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
    !isProbabilityOrNull(globalTasa) ||
    !isNonNegativeCountOrNull(globalMatriculados) ||
    !isNonNegativeCountOrNull(globalAsistentes) ||
    !isNonNegativeCountOrNull(globalEnviadas) ||
    !isNonNegativeCountOrNull(globalValidas) ||
    !isNonNegativeCountOrNull(globalNoRespondieron) ||
    globalK !== cobertura.observados ||
    globalK !== asistencia.k ||
    // ADR 0060: `global.matriculados` es la matrícula del aula, que es lo que
    // usan las celdas por dimensión. Con el glosario, en cambio, la asistencia
    // se mide sobre ELEGIBLES, así que los dos denominadores dejan de coincidir
    // legítimamente. Sólo se exige la igualdad en la lectura heredada.
    (!glosarioCompleto && globalMatriculados !== asistencia.denominador) ||
    // Con glosario el numerador de la cadena es asistentes_elegibles capado a
    // elegibles (ADR 0060), un derivado que solo puede REDUCIR al crudo del
    // global; la igualdad estricta solo aplica a la lectura heredada.
    (!glosarioCompleto && globalAsistentes !== asistencia.numerador) ||
    (glosarioCompleto &&
      asistencia.numerador !== null &&
      globalAsistentes !== null &&
      asistencia.numerador > globalAsistentes) ||
    globalEnviadas !== apertura.numerador ||
    globalValidas !== efectividad.numerador ||
    !residualShapeValid(globalAsistentes, globalMatriculados, globalTasa, globalResidual) ||
    !ratioMatchesCounts(globalAsistentes, globalMatriculados, globalTasa, globalResidual) ||
    !intervalMatchesMethod(
      globalK,
      globalTasa,
      globalIcLow,
      globalIcHigh,
      globalMetodoIc,
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
    residual_negativo: globalResidual,
    media_ch: globalMedia,
    sd_ch: globalSd,
    ic_low: globalIcLow,
    ic_high: globalIcHigh,
    metodo_ic: globalMetodoIc,
  };

  // `tamano` es opcional desde que sus tramos los declara el estudio en Marco:
  // sin grupos declarados el motor omite la dimensión en vez de imponer una
  // escala propia. Las otras tres describen el marco y siempre viajan.
  //
  // Exigir las cuatro dejaba en blanco la pestaña de cualquier estudio que no
  // usara grupos de tamaño, sin decir por qué: el payload llegaba entero y el
  // cliente lo descartaba en silencio.
  const dimensionKeysObligatorias: CalcMuestraReferenciaAsistenciaDimensionKey[] = [
    "rango_horario",
    "facultad",
    "tipo_sesion",
  ];
  const rawDimensions = asList(root.dimensiones);
  const dimensionKeys: CalcMuestraReferenciaAsistenciaDimensionKey[] =
    rawDimensions.length === dimensionKeysObligatorias.length + 1
      ? ["tamano", ...dimensionKeysObligatorias]
      : dimensionKeysObligatorias;
  if (rawDimensions.length !== dimensionKeys.length) return null;
  const dimensiones: CalcMuestraReferenciaAsistenciaDimension[] = [];
  let ordenPrevio = 0;
  for (let dimensionIndex = 0; dimensionIndex < dimensionKeys.length; dimensionIndex += 1) {
    const expectedKey = dimensionKeys[dimensionIndex]!;
    const record = asRecord(rawDimensions[dimensionIndex]);
    if (!record) return null;
    const label = asText(record.dimension_label);
    const order = asPositiveInteger(record.orden);
    // `orden` declara posición relativa, no índice absoluto: cuando el motor
    // omite `tamano` porque el estudio no declaró grupos, las tres restantes
    // conservan sus órdenes 2, 3 y 4. Exigir índice+1 rechazaba el payload
    // entero y dejaba la pestaña en blanco sin decir por qué.
    if (
      asText(record.dimension_key) !== expectedKey ||
      !label ||
      order === INVALID_NUMBER ||
      order <= ordenPrevio
    ) return null;
    ordenPrevio = order;

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
      const residualCelda = asResidualFlag(row.residual_negativo);
      if (residualCelda === INVALID_FLAG) return null;
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
        !residualShapeValid(asistentesCelda, matriculados, tasa, residualCelda) ||
        !ratioMatchesCounts(asistentesCelda, matriculados, tasa, residualCelda) ||
        !intervalMatchesMethod(
          k,
          tasa,
          icLow,
          icHigh,
          metodoIc,
        ) ||
        (k === 0 && (
          matriculados !== null ||
          asistentesCelda !== null ||
          tasa !== null ||
          mediaCh !== null ||
          sdCh !== null
        )) ||
        (tasaPublicada !== null && !isProbability(tasaPublicada)) ||
        !isProbabilityOrNull(tasa) ||
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
        ...ventanaDe(row),
        tasa,
        residual_negativo: residualCelda,
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

  // ADR 0060: bloques nuevos del v2. Ninguno invalida la referencia si falta —
  // una base histórica anterior al ADR no documenta su diseño ni sus filtros—,
  // pero un payload con un bloque presente y malformado sí se rechaza.
  const disenoRecord = asRecord(root.diseno);
  const disenoNumber = (value: unknown): number | null => {
    const parsed = asFiniteOrNull(value);
    return parsed === INVALID_NUMBER ? null : parsed;
  };
  const ponderadoRaw = disenoRecord ? unwrap(disenoRecord.ponderado) : null;
  const diseno: CalcMuestraReferenciaAsistenciaDiseno = {
    poblacion_objetivo: disenoNumber(disenoRecord?.poblacion_objetivo),
    nivel_confianza: disenoNumber(disenoRecord?.nivel_confianza),
    proporcion_esperada: disenoNumber(disenoRecord?.proporcion_esperada),
    margen_error: disenoNumber(disenoRecord?.margen_error),
    deff: disenoNumber(disenoRecord?.deff),
    muestra: disenoNumber(disenoRecord?.muestra),
    ratio_sobremuestra: disenoNumber(disenoRecord?.ratio_sobremuestra),
    sobremuestra: disenoNumber(disenoRecord?.sobremuestra),
    aulas_marco: disenoNumber(disenoRecord?.aulas_marco),
    aulas_dimensionadas: disenoNumber(disenoRecord?.aulas_dimensionadas),
    aulas_aplicadas: disenoNumber(disenoRecord?.aulas_aplicadas),
    tasa_respuesta_asumida: disenoNumber(disenoRecord?.tasa_respuesta_asumida),
    efectivas_logradas: disenoNumber(disenoRecord?.efectivas_logradas),
    base_analitica: disenoNumber(disenoRecord?.base_analitica),
    casos_recortados: disenoNumber(disenoRecord?.casos_recortados),
    ponderacion_alcance: asText(disenoRecord?.ponderacion_alcance, true) ?? "",
    afijacion: asText(disenoRecord?.afijacion, true) ?? "",
    metodo_seleccion: asText(disenoRecord?.metodo_seleccion, true) ?? "",
    metodo_ajuste: asText(disenoRecord?.metodo_ajuste, true) ?? "",
    ponderado: typeof ponderadoRaw === "boolean" ? ponderadoRaw : null,
    declarado: unwrap(disenoRecord?.declarado) === true,
  };

  const FILTRO_CLASES: CalcMuestraReferenciaAsistenciaFiltroClase[] = [
    "rechazo", "abandono", "no_elegible", "ya_medido",
  ];
  const filtros: CalcMuestraReferenciaAsistenciaFiltro[] = [];
  for (const raw of asList(root.filtros_corte)) {
    const item = asRecord(raw);
    if (!item) return null;
    const id = asText(item.id);
    const clase = asText(item.clase);
    const origen = asText(item.origen);
    const orden = asFiniteOrNull(item.orden);
    const enDenominador = unwrap(item.en_denominador);
    if (
      !id ||
      !clase ||
      !FILTRO_CLASES.includes(clase as CalcMuestraReferenciaAsistenciaFiltroClase) ||
      (origen !== "campo" && origen !== "formulario") ||
      orden === INVALID_NUMBER ||
      orden === null ||
      typeof enDenominador !== "boolean"
    ) return null;
    const claseTipada = clase as CalcMuestraReferenciaAsistenciaFiltroClase;
    // El efecto sobre el denominador lo decide la clase; si el payload discrepa,
    // el catálogo no es confiable.
    const esperado = claseTipada === "rechazo" || claseTipada === "abandono";
    if (enDenominador !== esperado) return null;
    filtros.push({
      id,
      etiqueta: asText(item.etiqueta) ?? id,
      columna: asText(item.columna, true) ?? "",
      condicion: asText(item.condicion, true) ?? "",
      clase: claseTipada,
      origen,
      orden,
      en_denominador: enDenominador,
    });
  }

  // Un objeto sin claves es cómo R expresa «ausente» al serializar. Se lee como
  // ausencia y no como un bloque presente y vacío, que invalidaría el payload
  // entero: sin glosario, `encuentros` llegaba como `{}` y contradecía a
  // `glosario_completo`, así que ninguna base heredada se podía leer.
  const bloque = (value: unknown) => {
    const record = asRecord(value);
    return record && Object.keys(record).length > 0 ? record : null;
  };
  const perfilEscalones = (
    value: unknown,
  ): CalcMuestraReferenciaAsistenciaPerfilEscalones | null => {
    const record = bloque(value);
    if (!record) return null;
    const aplicados = asNonNegativeInteger(record.aplicados);
    if (aplicados === INVALID_NUMBER) return null;
    const num = (raw: unknown): number | null => {
      const parsed = asFiniteOrNull(raw);
      return parsed === INVALID_NUMBER ? null : parsed;
    };
    return {
      aplicados,
      semana_media: num(record.semana_media),
      efectivas: num(record.efectivas),
      rendimiento: num(record.rendimiento),
    };
  };
  const encuentrosRecord = bloque(root.encuentros);
  let encuentros: CalcMuestraReferenciaAsistenciaEncuentros | null = null;
  if (encuentrosRecord) {
    const num = (value: unknown): number | null => {
      const parsed = asFiniteOrNull(value);
      return parsed === INVALID_NUMBER ? null : parsed;
    };
    const publicables = asNonNegativeInteger(encuentrosRecord.unidades_publicables);
    const negativos = asNonNegativeInteger(
      encuentrosRecord.unidades_con_residual_negativo,
    );
    if (publicables === INVALID_NUMBER || negativos === INVALID_NUMBER) return null;
    encuentros = {
      elegibles: num(encuentrosRecord.elegibles),
      asistentes: num(encuentrosRecord.asistentes),
      ya_medidas: num(encuentrosRecord.ya_medidas),
      no_elegibles: num(encuentrosRecord.no_elegibles),
      elegibles_presentes: num(encuentrosRecord.elegibles_presentes),
      efectivas: num(encuentrosRecord.efectivas),
      no_efectivas: num(encuentrosRecord.no_efectivas),
      no_realizadas: num(encuentrosRecord.no_realizadas),
      presentes_no_contados: num(encuentrosRecord.presentes_no_contados),
      unidades_publicables: publicables,
      unidades_con_residual_negativo: negativos,
    };
  }
  const embudos: CalcMuestraReferenciaAsistenciaEmbudo[] = [];
  for (const rawDim of asList(root.embudos)) {
    const dim = asRecord(rawDim);
    if (!dim) return null;
    const key = asText(dim.dimension_key);
    const label = asText(dim.dimension_label);
    const orden = asNonNegativeInteger(dim.orden);
    if (!key || !label || orden === INVALID_NUMBER) return null;
    const filas: CalcMuestraReferenciaAsistenciaEmbudoFila[] = [];
    for (const rawFila of asList(dim.filas)) {
      const f = asRecord(rawFila);
      if (!f) return null;
      const celdaKey = asText(f.celda_key);
      const celdaLabel = asText(f.celda_label);
      const k = asNonNegativeInteger(f.k);
      if (!celdaKey || !celdaLabel || k === INVALID_NUMBER) return null;
      const n = (value: unknown): number | null => {
        const parsed = asFiniteOrNull(value);
        return parsed === INVALID_NUMBER ? null : parsed;
      };
      filas.push({
        celda_key: celdaKey, celda_label: celdaLabel, k,
        ...ventanaDe(f),
        elegibles: n(f.elegibles), asistentes: n(f.asistentes),
        asistentes_elegibles: n(f.asistentes_elegibles),
        ya_medidas: n(f.ya_medidas), no_elegibles: n(f.no_elegibles),
        elegibles_presentes: n(f.elegibles_presentes),
        efectivas: n(f.efectivas), no_efectivas: n(f.no_efectivas),
        pct_ausencia: n(f.pct_ausencia), pct_ya_medidas: n(f.pct_ya_medidas),
        pct_rechazo: n(f.pct_rechazo), efectividad: n(f.efectividad),
        rendimiento: n(f.rendimiento),
        residual_negativo: unwrap(f.residual_negativo) === true,
        asistencia_elegibles_min: n(f.asistencia_elegibles_min),
        asistencia_elegibles_max: n(f.asistencia_elegibles_max),
      });
    }
    embudos.push({ dimension_key: key, dimension_label: label, orden, filas });
  }

  // Serie semanal y cobertura de celdas son opcionales de punta a punta: la base
  // puede no declarar semana, celda ni rol. Ausentes se leen como null, pero un
  // bloque presente y mal formado invalida el payload en vez de degradarse a
  // medias, porque una serie a la que le falta una semana miente sobre la
  // tendencia que se dibuja con ella.
  const composicion: CalcMuestraReferenciaAsistenciaComposicion[] = [];
  for (const rawComp of asList(root.composicion)) {
    const c = asRecord(rawComp);
    if (!c) return null;
    const key = asText(c.criterio_key);
    const label = asText(c.criterio_label);
    const orden = asNonNegativeInteger(c.orden);
    if (!key || !label || orden === INVALID_NUMBER) return null;
    const n = (value: unknown): number | null => {
      const parsed = asFiniteOrNull(value);
      return parsed === INVALID_NUMBER ? null : parsed;
    };
    const categorias: { categoria: string; n: number; pct: number | null }[] = [];
    for (const rawCat of asList(c.categorias)) {
      const cat = asRecord(rawCat);
      if (!cat) return null;
      const nombre = asText(cat.categoria);
      const cuantos = asNonNegativeInteger(cat.n);
      if (!nombre || cuantos === INVALID_NUMBER) return null;
      categorias.push({ categoria: nombre, n: cuantos, pct: n(cat.pct) });
    }
    if (categorias.length < 2) return null;
    const filas: CalcMuestraReferenciaAsistenciaComposicion["filas"] = [];
    for (const rawFila of asList(c.filas)) {
      const f = asRecord(rawFila);
      if (!f) return null;
      const facultad = asText(f.facultad);
      const total = asNonNegativeInteger(f.n);
      if (!facultad || total === INVALID_NUMBER) return null;
      const reparto: CalcMuestraReferenciaAsistenciaComposicion["filas"][number]["reparto"] = [];
      for (const rawR of asList(f.reparto)) {
        const rr = asRecord(rawR);
        if (!rr) return null;
        const nombre = asText(rr.categoria);
        const cuantos = asNonNegativeInteger(rr.n);
        if (!nombre || cuantos === INVALID_NUMBER) return null;
        reparto.push({ categoria: nombre, n: cuantos, pct: n(rr.pct), elegibles: n(rr.elegibles) });
      }
      // El reparto de una facultad tiene que sumar sus propias aulas: si no,
      // los porcentajes de la barra no describen a esa facultad.
      if (reparto.reduce((acc, r) => acc + r.n, 0) !== total) return null;
      filas.push({ facultad, n: total, reparto });
    }
    composicion.push({ criterio_key: key, criterio_label: label, orden, categorias, filas });
  }

  let cuotas: CalcMuestraReferenciaAsistenciaCuotas | null = null;
  const cuotasRecord = bloque(root.cuotas);
  if (cuotasRecord) {
    const n = (value: unknown): number | null => {
      const parsed = asFiniteOrNull(value);
      return parsed === INVALID_NUMBER ? null : parsed;
    };
    const filas: CalcMuestraReferenciaAsistenciaCuotas["filas"] = [];
    for (const rawFila of asList(cuotasRecord.filas)) {
      const f = asRecord(rawFila);
      if (!f) return null;
      const facultad = asText(f.facultad, true) ?? "";
      const aulas = asNonNegativeInteger(f.aulas);
      if (!facultad || aulas === INVALID_NUMBER) return null;
      filas.push({
        facultad, aulas,
        cuota_total: n(f.cuota_total), cuota_mujeres: n(f.cuota_mujeres),
        cuota_hombres: n(f.cuota_hombres), logradas: n(f.logradas),
        logradas_mujeres: n(f.logradas_mujeres), logradas_hombres: n(f.logradas_hombres),
        cumplimiento: n(f.cumplimiento), cumplimiento_mujeres: n(f.cumplimiento_mujeres),
        cumplimiento_hombres: n(f.cumplimiento_hombres),
      });
    }
    if (!filas.length) return null;
    cuotas = {
      unidad: "cumplimiento_de_cuota",
      cuota_mujeres: n(cuotasRecord.cuota_mujeres), cuota_hombres: n(cuotasRecord.cuota_hombres),
      logradas_mujeres: n(cuotasRecord.logradas_mujeres),
      logradas_hombres: n(cuotasRecord.logradas_hombres),
      cumplimiento_mujeres: n(cuotasRecord.cumplimiento_mujeres),
      cumplimiento_hombres: n(cuotasRecord.cumplimiento_hombres),
      filas,
    };
  }

  let serieCampo: CalcMuestraReferenciaAsistenciaSerieCampo | null = null;
  const serieRecord = bloque(root.serie_campo);
  if (serieRecord) {
    const semanas: CalcMuestraReferenciaAsistenciaSemana[] = [];
    for (const rawSemana of asList(serieRecord.filas)) {
      const w = asRecord(rawSemana);
      if (!w) return null;
      const semana = asNonNegativeInteger(w.semana);
      const etiqueta = asText(w.etiqueta);
      const orden = asNonNegativeInteger(w.orden);
      const k = asNonNegativeInteger(w.k);
      if (semana === INVALID_NUMBER || !etiqueta || orden === INVALID_NUMBER || k === INVALID_NUMBER) {
        return null;
      }
      const n = (value: unknown): number | null => {
        const parsed = asFiniteOrNull(value);
        return parsed === INVALID_NUMBER ? null : parsed;
      };
      semanas.push({
        semana, etiqueta, orden, k,
        elegibles: n(w.elegibles), ausentes: n(w.ausentes), asistentes: n(w.asistentes),
        asistentes_elegibles: n(w.asistentes_elegibles),
        ya_medidas: n(w.ya_medidas), no_elegibles: n(w.no_elegibles),
        a_encuestar: n(w.a_encuestar), registros: n(w.registros),
        efectivas: n(w.efectivas), no_efectivas: n(w.no_efectivas),
        efectivas_acumuladas: n(w.efectivas_acumuladas),
        asistencia: n(w.asistencia),
        residual_negativo: unwrap(w.residual_negativo) === true,
        asistencia_elegibles_min: n(w.asistencia_elegibles_min),
        asistencia_elegibles_max: n(w.asistencia_elegibles_max),
        pct_ya_medidas: n(w.pct_ya_medidas),
        efectividad: n(w.efectividad),
        efectividad_denominador: n(w.efectividad_denominador),
        rendimiento: n(w.rendimiento),
        efectivas_por_aula: n(w.efectivas_por_aula),
      });
    }
    if (!semanas.length) return null;

    // La deriva es opcional: una base con un solo tramo medible no la trae, y
    // su ausencia sólo significa que no hay dispersión que declarar.
    let deriva: CalcMuestraReferenciaAsistenciaDeriva | null = null;
    const derivaRecord = bloque(serieRecord.deriva);
    if (derivaRecord) {
      const n = (value: unknown): number | null => {
        const parsed = asFiniteOrNull(value);
        return parsed === INVALID_NUMBER ? null : parsed;
      };
      const tramos = asNonNegativeInteger(derivaRecord.tramos);
      const medibles = asNonNegativeInteger(derivaRecord.tramos_medibles);
      if (tramos !== INVALID_NUMBER && medibles !== INVALID_NUMBER) {
        const puntos: CalcMuestraReferenciaAsistenciaDeriva["puntos"] = [];
        for (const rawPunto of asList(derivaRecord.puntos)) {
          const p = asRecord(rawPunto);
          if (!p) continue;
          const k = asNonNegativeInteger(p.k);
          puntos.push({
            etiqueta: asText(p.etiqueta, true) ?? "",
            k: k === INVALID_NUMBER ? 0 : k,
            a_encuestar: n(p.a_encuestar),
            efectividad: n(p.efectividad),
            pct_ya_medidas: n(p.pct_ya_medidas),
          });
        }
        deriva = {
          tramos, tramos_medibles: medibles,
          etiqueta_primera: asText(derivaRecord.etiqueta_primera, true) ?? "",
          etiqueta_ultima: asText(derivaRecord.etiqueta_ultima, true) ?? "",
          efectividad_primera: n(derivaRecord.efectividad_primera),
          efectividad_ultima: n(derivaRecord.efectividad_ultima),
          efectividad_min: n(derivaRecord.efectividad_min),
          efectividad_min_etiqueta: asText(derivaRecord.efectividad_min_etiqueta, true) ?? "",
          efectividad_min_k: n(derivaRecord.efectividad_min_k),
          efectividad_max: n(derivaRecord.efectividad_max),
          efectividad_max_etiqueta: asText(derivaRecord.efectividad_max_etiqueta, true) ?? "",
          efectividad_max_k: n(derivaRecord.efectividad_max_k),
          tramo_dominante: asText(derivaRecord.tramo_dominante, true) ?? "",
          peso_dominante: n(derivaRecord.peso_dominante),
          ya_medidas_primera: n(derivaRecord.ya_medidas_primera),
          ya_medidas_ultima: n(derivaRecord.ya_medidas_ultima),
          agotamiento_crece: derivaRecord.agotamiento_crece === true,
          por_aula_primera: n(derivaRecord.por_aula_primera),
          por_aula_ultima: n(derivaRecord.por_aula_ultima),
          puntos,
        };
      }
    }
    serieCampo = { unidad: "semana_de_campo", filas: semanas, deriva };
  }

  let cadenasReemplazo: CalcMuestraReferenciaAsistenciaCadenasReemplazo | null = null;
  const cadenasRecord = bloque(root.cadenas_reemplazo);
  if (cadenasRecord) {
    const campos = [
      "cadenas_declaradas", "cadenas_resueltas", "resueltas_con_titular",
      "resueltas_con_reemplazo", "profundidad_maxima",
    ] as const;
    const leidos: Record<string, number> = {};
    for (const campo of campos) {
      const valor = asNonNegativeInteger(cadenasRecord[campo]);
      if (valor === INVALID_NUMBER) return null;
      leidos[campo] = valor;
    }
    // Una cadena se resuelve en su titular o en un reemplazo, nunca en ambos.
    if (leidos.resueltas_con_titular + leidos.resueltas_con_reemplazo !== leidos.cadenas_resueltas) {
      return null;
    }
    if (leidos.cadenas_resueltas > leidos.cadenas_declaradas) return null;

    const motivos: { motivo: string; codigo: string; n: number; orden: number }[] = [];
    for (const rawMotivo of asList(cadenasRecord.motivos)) {
      const m = asRecord(rawMotivo);
      if (!m) return null;
      const motivo = asText(m.motivo);
      const cuantos = asNonNegativeInteger(m.n);
      const orden = asNonNegativeInteger(m.orden);
      if (!motivo || cuantos === INVALID_NUMBER || orden === INVALID_NUMBER) return null;
      motivos.push({ motivo, codigo: asText(m.codigo, true) ?? "", n: cuantos, orden });
    }

    const n = (value: unknown): number | null => {
      const parsed = asFiniteOrNull(value);
      return parsed === INVALID_NUMBER ? null : parsed;
    };
    const filas: CalcMuestraReferenciaAsistenciaCadenaSeleccion[] = [];
    for (const rawFila of asList(cadenasRecord.filas)) {
      const f = asRecord(rawFila);
      if (!f) return null;
      const cadena = asNonNegativeInteger(f.cadena);
      const trabajados = asNonNegativeInteger(f.escalones_trabajados);
      const aplicados = asNonNegativeInteger(f.aplicados);
      const titular = asText(f.titular);
      if (cadena === INVALID_NUMBER || trabajados === INVALID_NUMBER
          || aplicados === INVALID_NUMBER || !titular) {
        return null;
      }
      const escalones: CalcMuestraReferenciaAsistenciaEscalon[] = [];
      for (const rawEscalon of asList(f.escalones)) {
        const e = asRecord(rawEscalon);
        if (!e) return null;
        const posicion = asNonNegativeInteger(e.posicion);
        const rol = asText(e.rol);
        const cursoHorario = asText(e.curso_horario);
        const estado = asText(e.estado);
        if (posicion === INVALID_NUMBER || !rol || !cursoHorario) return null;
        if (estado !== "aplicado" && estado !== "cayo" && estado !== "reserva") return null;
        const semanaEscalon = asFiniteOrNull(e.semana);
        escalones.push({
          posicion, rol, curso_horario: cursoHorario, estado,
          semana: semanaEscalon === INVALID_NUMBER ? null : semanaEscalon,
          efectivas: n(e.efectivas),
          efectivas_mujeres: n(e.efectivas_mujeres), efectivas_hombres: n(e.efectivas_hombres),
          elegibles: n(e.elegibles), rendimiento: n(e.rendimiento),
          motivo: asText(e.motivo, true) || null,
          motivo_codigo: asText(e.motivo_codigo, true) || null,
        });
      }
      if (!escalones.length) return null;
      const resueltaEn = asFiniteOrNull(f.resuelta_en);
      filas.push({
        cadena, facultad: asText(f.facultad, true) ?? "", titular,
        nombre_curso: asText(f.nombre_curso, true) ?? "",
        horario: asText(f.horario, true) ?? "",
        efectivas_mujeres: n(f.efectivas_mujeres), efectivas_hombres: n(f.efectivas_hombres),
        escalones,
        escalones_trabajados: trabajados, aplicados,
        resuelta_en: resueltaEn === INVALID_NUMBER ? null : resueltaEn,
        semana_inicio: n(f.semana_inicio), semana_fin: n(f.semana_fin),
        efectivas: n(f.efectivas), elegibles: n(f.elegibles), rendimiento: n(f.rendimiento),
      });
    }

    cadenasReemplazo = {
      unidad: "cadena_de_reemplazo",
      cadenas_declaradas: leidos.cadenas_declaradas,
      cadenas_resueltas: leidos.cadenas_resueltas,
      resueltas_con_titular: leidos.resueltas_con_titular,
      resueltas_con_reemplazo: leidos.resueltas_con_reemplazo,
      profundidad_maxima: leidos.profundidad_maxima,
      titulares: perfilEscalones(cadenasRecord.titulares),
      reemplazos: perfilEscalones(cadenasRecord.reemplazos),
      motivos, filas,
    };
  }

  // El bloque de encuentros existe exactamente cuando el glosario se leyó, y el
  // denominador declarado en la raíz tiene que decir lo mismo.
  if (glosarioCompleto !== (encuentros !== null)) return null;
  const denominadorEsperado = glosarioCompleto
    ? "elegibles_presentes"
    : "matriculados_totales";
  if (asText(root.denominador) !== denominadorEsperado) return null;

  return {
    schema: CALC_MUESTRA_REFERENCIA_ASISTENCIA_SCHEMA,
    owner: "estudio_historico_externo",
    momento: "post_hoc_estudio_previo",
    transferible: "modelo_por_celda",
    modelo: "marginales_independientes",
    combinable: false,
    unidad: "encuentro_en_curso_horario_aplicado",
    denominador: glosarioCompleto ? "elegibles_presentes" : "matriculados_totales",
    estudio,
    diseno,
    filtros_corte: filtros,
    cobertura,
    encuentros,
    embudos,
    composicion,
    serie_campo: serieCampo,
    cuotas,
    cadenas_reemplazo: cadenasReemplazo,
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
  // I21b: con bases institucionales (>= umbral del backend, default 20.000
  // filas de entrada) el build responde { mode: "job", job_id } en vez del
  // marco; el marco queda en la sesión al terminar. Mismo contrato que
  // comparar-metodos y seleccionar, por eso reusa el tipo async.
  return handle<CalcMuestraAulasAsyncResponse<{ frame: CalcMuestraAulasFrame }> & { input_rows?: number }>(
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

/**
 * Certeza de cobertura. Los estratos se mandan tal como los publicó R en
 * `resultado.aulas_por_estrato`: cuota y τ son decisiones del motor de muestra
 * y el cliente no las recalcula. Sobre el umbral del backend deriva a job.
 */
export async function apiCalcMuestraAulasCerteza(payload: {
  estratos: Array<{
    label: string;
    faculty_key?: string;
    cuota: number;
    tau?: number | null;
    aulas_formula: number;
  }>;
  nivel?: number;
  corridas?: number;
  config?: Record<string, unknown>;
  frame?: CalcMuestraAulasFrame;
}) {
  return handle<CalcMuestraAulasAsyncResponse<{ certeza: CalcMuestraAulasCerteza }>>(
    await apiFetch("/api/calc-muestra/aulas/certeza", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
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
