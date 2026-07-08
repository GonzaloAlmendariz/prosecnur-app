import {
  type CalcMuestraComponente,
  type CalcMuestraEstrato,
  type CalcMuestraEstudio,
  type CalcMuestraWorkspace,
  type CalcMuestraWorkspaceAulasConfig,
  type CalcMuestraWorkspaceAulasSelector,
  type CalcMuestraWorkspaceEscenario,
} from "../../../../api/client";
import { calcNPreview, zFromConfidence } from "../../didactica/motorPreview";
import {
  DEFAULT_PARAMS,
  defaultComponente,
  naturalezaPara,
  origenPara,
  respaldoPara,
  roundUpTo,
  safeNumber,
  setTecnica,
  type ActiveDesk,
} from "../../sharedCore";
import {
  DEFAULT_UNIVERSITY_AULAS_CONFIG,
  DEFAULT_UNIVERSITY_AULAS_OBJECTIVE,
  DEFAULT_UNIVERSITY_PUBLICATION_CONFIG,
  ESCENARIOS_OPINION,
  UNIVERSITY_FACULTY_COMPONENT_ID,
  UNIVERSITY_REFERENCE_BASE_SCENARIO_DEFAULTS,
  UNIVERSITY_REFERENCE_FACULTY_SCENARIO_DEFAULTS,
  UNIVERSITY_REFERENCE_SUCCESS_RATE,
  UNIVERSITY_REQUIRED_VARIABLES,
  UNIVERSITY_SOURCE_BINDING_DEFAULTS,
  UNIVERSITY_TOTAL_COMPONENT_ID,
} from "./constants";
import { normalizeUniversityLabel } from "./format";

export function normalizeAulasSelectorEngine(value: unknown): CalcMuestraWorkspaceAulasSelector {
  const raw = String(value ?? "").trim();
  if (raw === "local_pivotal_balanceado" || raw === "pool_controlado" || raw === "sistematico_pps" || raw === "estratificado_aleatorio" || raw === "manual_auditable") return raw;
  if (raw === "pps_balanceado") return "cube_balanceado";
  return "cube_balanceado";
}

export function normalizeUniversityAulasConfig(config?: CalcMuestraWorkspace["aulas_config"] | null): CalcMuestraWorkspaceAulasConfig {
  const raw: Partial<CalcMuestraWorkspaceAulasConfig> = config ?? {};
  const selector = raw.selector ?? DEFAULT_UNIVERSITY_AULAS_CONFIG.selector;
  const selectorEngine = normalizeAulasSelectorEngine(raw.selector_engine ?? selector);
  const acceptedConditions = (raw.accepted_conditions ?? DEFAULT_UNIVERSITY_AULAS_CONFIG.accepted_conditions ?? ["regular"])
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);
  return {
    ...DEFAULT_UNIVERSITY_AULAS_CONFIG,
    ...raw,
    modalidad: raw.modalidad ?? DEFAULT_UNIVERSITY_AULAS_CONFIG.modalidad,
    selector,
    selector_engine: selectorEngine,
    method_family: raw.method_family ?? (selectorEngine === "pool_controlado" ? "probability_with_operational_optimization" : "balanced_probability"),
    min_elegibles_aula: Math.max(1, Math.round(safeNumber(raw.min_elegibles_aula, DEFAULT_UNIVERSITY_AULAS_CONFIG.min_elegibles_aula))),
    accepted_conditions: acceptedConditions.length ? acceptedConditions : ["regular"],
    require_undergraduate: raw.require_undergraduate ?? DEFAULT_UNIVERSITY_AULAS_CONFIG.require_undergraduate,
    require_adult: raw.require_adult ?? DEFAULT_UNIVERSITY_AULAS_CONFIG.require_adult,
    min_age: Math.max(0, Math.round(safeNumber(raw.min_age, DEFAULT_UNIVERSITY_AULAS_CONFIG.min_age))),
    require_in_person: raw.require_in_person ?? (raw.modalidad ?? DEFAULT_UNIVERSITY_AULAS_CONFIG.modalidad) !== "online_controlado",
    usar_grupos_tamano: raw.usar_grupos_tamano ?? DEFAULT_UNIVERSITY_AULAS_CONFIG.usar_grupos_tamano,
    grupos_tamano: raw.grupos_tamano?.length ? raw.grupos_tamano : DEFAULT_UNIVERSITY_AULAS_CONFIG.grupos_tamano,
    estratos_selector: raw.estratos_selector?.length ? raw.estratos_selector : DEFAULT_UNIVERSITY_AULAS_CONFIG.estratos_selector,
    balance_vars: raw.balance_vars?.length ? raw.balance_vars : DEFAULT_UNIVERSITY_AULAS_CONFIG.balance_vars,
    spread_vars: raw.spread_vars?.length ? raw.spread_vars : DEFAULT_UNIVERSITY_AULAS_CONFIG.spread_vars,
    candidate_pool_size: Math.max(1, Math.round(safeNumber(raw.candidate_pool_size, DEFAULT_UNIVERSITY_AULAS_CONFIG.candidate_pool_size))),
    simulation_runs: Math.max(0, Math.round(safeNumber(raw.simulation_runs, DEFAULT_UNIVERSITY_AULAS_CONFIG.simulation_runs))),
    mos_strategy: raw.mos_strategy ?? DEFAULT_UNIVERSITY_AULAS_CONFIG.mos_strategy,
    coordination_mode: raw.coordination_mode ?? DEFAULT_UNIVERSITY_AULAS_CONFIG.coordination_mode,
    replacement_depth_strategy: raw.replacement_depth_strategy ?? DEFAULT_UNIVERSITY_AULAS_CONFIG.replacement_depth_strategy,
    min_replacements_per_titular: Math.max(0, Math.round(safeNumber(raw.min_replacements_per_titular, DEFAULT_UNIVERSITY_AULAS_CONFIG.min_replacements_per_titular))),
    max_replacements_per_titular: Math.max(0, Math.round(safeNumber(raw.max_replacements_per_titular, DEFAULT_UNIVERSITY_AULAS_CONFIG.max_replacements_per_titular))),
    extra_pool_policy: raw.extra_pool_policy ?? DEFAULT_UNIVERSITY_AULAS_CONFIG.extra_pool_policy,
    replacement_equivalence_vars: raw.replacement_equivalence_vars?.length ? raw.replacement_equivalence_vars : DEFAULT_UNIVERSITY_AULAS_CONFIG.replacement_equivalence_vars,
    replacement_score_weights: raw.replacement_score_weights ?? DEFAULT_UNIVERSITY_AULAS_CONFIG.replacement_score_weights,
    bolsas_reemplazo: Math.max(0, Math.round(safeNumber(raw.bolsas_reemplazo, DEFAULT_UNIVERSITY_AULAS_CONFIG.bolsas_reemplazo))),
    aulas_extra_operativas_default: Math.max(0, Math.round(safeNumber(raw.aulas_extra_operativas_default, DEFAULT_UNIVERSITY_AULAS_CONFIG.aulas_extra_operativas_default))),
    penalizacion_repetidos: Math.max(0, safeNumber(raw.penalizacion_repetidos, DEFAULT_UNIVERSITY_AULAS_CONFIG.penalizacion_repetidos)),
    pps_weight: Math.max(0, safeNumber(raw.pps_weight, DEFAULT_UNIVERSITY_AULAS_CONFIG.pps_weight)),
    coverage_weight: Math.max(0, safeNumber(raw.coverage_weight, DEFAULT_UNIVERSITY_AULAS_CONFIG.coverage_weight)),
    monte_carlo_n: Math.max(0, Math.round(safeNumber(raw.monte_carlo_n, DEFAULT_UNIVERSITY_AULAS_CONFIG.monte_carlo_n))),
    semilla: Math.round(safeNumber(raw.semilla, DEFAULT_UNIVERSITY_AULAS_CONFIG.semilla)),
    objective: raw.objective ?? DEFAULT_UNIVERSITY_AULAS_OBJECTIVE,
    notas_metodologicas: raw.notas_metodologicas ?? DEFAULT_UNIVERSITY_AULAS_CONFIG.notas_metodologicas,
  };
}

export function universityFacultyError(N: number) {
  if (N > 1000) return 0.05;
  if (N >= 300) return 0.07;
  return 0.10;
}

export function universityFacultyConfidence(N: number) {
  return N < 300 ? 0.90 : 0.95;
}

// zFromConfidence viene de didactica/motorPreview: réplica exacta del qnorm
// del motor R (AS241), verificada por el test de paridad TS↔R.

export function defaultTitleFor(mode: ActiveDesk) {
  if (mode === "acreditacion") return "Diseño muestral de acreditación";
  if (mode === "opinion_universitaria") return "Muestra de aulas";
  return "Diseño muestral desde marco disponible";
}

/**
 * Workspace por defecto de la mesa universitaria. Única fuente compartida entre
 * el arranque de mesa del monolito (workspaceFor) y UniversidadDesk, que lo usa
 * como base cuando el workspace persistido aún no declara frame_mode.
 */
export function universityDefaultWorkspace(): CalcMuestraWorkspace {
  return {
    version: 2,
    frame_mode: "opinion_universitaria",
    marco_disponible: "Matrícula por facultad y sexo",
    fuente_marco: "Matrícula institucional",
    unidad_observacion: "Estudiante matriculado",
    unidad_muestreo: "",
    variables_control: [
      { id: "facultad", label: "Facultad", tipo: "estrato", disponible: true, notas: "" },
      { id: "sexo", label: "Sexo", tipo: "cuota", disponible: true, notas: "" },
    ],
    escenarios: ESCENARIOS_OPINION,
    aulas_config: DEFAULT_UNIVERSITY_AULAS_CONFIG,
    source_mode: "base_madre",
    source_bindings: UNIVERSITY_SOURCE_BINDING_DEFAULTS.base_madre,
    variable_mappings: UNIVERSITY_REQUIRED_VARIABLES,
    category_mappings: [],
    publication_config: DEFAULT_UNIVERSITY_PUBLICATION_CONFIG,
    notas_diseno:
      "Propuesta A: representatividad a nivel universidad. Propuesta B: representatividad a nivel facultad.",
  };
}

// calcNFormulaPreview y calcEPreview viven en didactica/motorPreview (una sola
// fuente de verdad para la vista previa TS; la cifra definitiva sale del motor
// R vía /api/calc-muestra/explicar o /calcular).
export const calcNFormulaPreview = calcNPreview;

export function calcFacultyIndependentPreview(comp: CalcMuestraComponente) {
  const p = comp.parametros;
  const rows = (comp.marco.estratos ?? []).map((e) => {
    const pEstrato = e.p_facultad == null ? p.p : safeNumber(e.p_facultad, p.p);
    const zEstrato = safeNumber(e.z_facultad, zFromConfidence(e.confianza_facultad, p.z));
    const n = calcNFormulaPreview(safeNumber(e.N), pEstrato, zEstrato, safeNumber(e.e_facultad, p.e), p.deff) ?? 0;
    return { estrato: e.label, N: safeNumber(e.N), n };
  });
  const total = rows.reduce((sum, row) => sum + row.n, 0);
  return { total: total || null, rows };
}

export function withUniversityEstratoDefaults(estratos: CalcMuestraEstrato[] = [], kind: "universidad" | "facultad" = "universidad") {
  const auditMap = kind === "facultad" ? UNIVERSITY_REFERENCE_FACULTY_SCENARIO_DEFAULTS : UNIVERSITY_REFERENCE_BASE_SCENARIO_DEFAULTS;
  return estratos.map((e) => ({
    ...e,
    sub_a_label: e.sub_a_label || "Mujeres",
    sub_b_label: e.sub_b_label || "Hombres",
    e_facultad: safeNumber(e.e_facultad, universityFacultyError(safeNumber(e.N))),
    confianza_facultad: safeNumber(e.confianza_facultad, universityFacultyConfidence(safeNumber(e.N))),
    p_facultad: e.p_facultad == null
      ? UNIVERSITY_REFERENCE_SUCCESS_RATE[e.label.toUpperCase()] ?? UNIVERSITY_REFERENCE_SUCCESS_RATE[normalizeUniversityLabel(e.label)] ?? 0.5
      : safeNumber(e.p_facultad, UNIVERSITY_REFERENCE_SUCCESS_RATE[e.label.toUpperCase()] ?? UNIVERSITY_REFERENCE_SUCCESS_RATE[normalizeUniversityLabel(e.label)] ?? 0.5),
    ...(auditMap[normalizeUniversityLabel(e.label)] ?? {}),
    aulas_extra_operativas: e.aulas_extra_operativas == null
      ? auditMap[normalizeUniversityLabel(e.label)]?.aulas_extra_operativas ?? 1
      : Math.max(0, Math.round(safeNumber(e.aulas_extra_operativas, 1))),
  }));
}

export function makeUniversityComponent(
  base: CalcMuestraComponente,
  kind: "universidad" | "facultad",
): CalcMuestraComponente {
  const escenario = kind === "universidad" ? ESCENARIOS_OPINION[0] : ESCENARIOS_OPINION[1];
  const actorId = kind === "universidad" ? UNIVERSITY_TOTAL_COMPONENT_ID : UNIVERSITY_FACULTY_COMPONENT_ID;
  const existingNew = base.actor_id === actorId;
  const techniqueBase: CalcMuestraComponente = base.tecnica === escenario.tecnica
    ? {
        ...base,
        tecnica: escenario.tecnica,
        naturaleza: naturalezaPara(escenario.tecnica),
        origen_tamano: origenPara(escenario.tecnica),
        nivel_respaldo: respaldoPara(escenario.tecnica),
      }
    : setTecnica(base, escenario.tecnica);
  return {
    ...techniqueBase,
    id: existingNew ? base.id : kind === "universidad" ? base.id : `${base.id}-fac`,
    actor: kind === "universidad"
      ? "Muestra con representatividad a nivel universidad"
      : "Muestra con representatividad a nivel facultad",
    actor_id: actorId,
    actor_categoria: "otros",
    canal_recojo: "aula_qr",
    parametros: existingNew
      ? { ...DEFAULT_PARAMS, ...escenario.parametros, ...base.parametros }
      : { ...base.parametros, ...escenario.parametros },
    marco: {
      ...base.marco,
      estado: base.marco.estado === "no_definido" ? "validado" : base.marco.estado,
      estratos: withUniversityEstratoDefaults(base.marco.estratos ?? [], kind),
    },
    meta: {
      ...base.meta,
      tipo: "objetivo",
      valor: existingNew ? safeNumber(base.meta.valor) : 0,
      variable_control: "facultad_sexo",
    },
    resultado: existingNew ? base.resultado ?? null : null,
  };
}

export function universityComponents(componentes: CalcMuestraComponente[]) {
  const totalExisting = componentes.find((c) => c.actor_id === UNIVERSITY_TOTAL_COMPONENT_ID);
  const facultyExisting = componentes.find((c) => c.actor_id === UNIVERSITY_FACULTY_COMPONENT_ID);
  const legacy = componentes.find((c) => c.actor_id === "estudiantes") ?? componentes[0];
  const base = legacy ?? defaultComponente({
    actor: "Estudiantes pregrado",
    actor_id: "estudiantes",
    actor_categoria: "estudiantes",
    canal_recojo: "aula_qr",
    tecnica: "prob_conglomerado_multietapico",
  });
  const sharedMarco =
    (totalExisting?.marco.estratos?.length ? totalExisting.marco : null) ??
    (facultyExisting?.marco.estratos?.length ? facultyExisting.marco : null) ??
    base.marco;
  const total = makeUniversityComponent({ ...(totalExisting ?? base), marco: sharedMarco }, "universidad");
  const faculty = makeUniversityComponent({ ...(facultyExisting ?? base), marco: sharedMarco }, "facultad");
  return [total, faculty] as const;
}

export function universityWorkspace(workspace: CalcMuestraWorkspace, total: CalcMuestraComponente, faculty: CalcMuestraComponente): CalcMuestraWorkspace {
  const byId = new Map((workspace.escenarios.length ? workspace.escenarios : ESCENARIOS_OPINION).map((e) => [e.id, e]));
  return {
    ...workspace,
    aulas_config: normalizeUniversityAulasConfig(workspace.aulas_config),
    escenarios: ESCENARIOS_OPINION.map((base) => {
      const current = byId.get(base.id);
      const component_id = base.id === "total-universidad" ? total.id : faculty.id;
      return {
        ...base,
        ...(current ?? {}),
        component_id,
        incluir_reporte: current?.incluir_reporte ?? base.incluir_reporte,
        redondeo_multiplo: current?.redondeo_multiplo ?? base.redondeo_multiplo,
      };
    }),
  };
}

export function componentFormulaBase(comp: CalcMuestraComponente) {
  if (comp.tecnica === "prob_estratificado_independiente") {
    return calcFacultyIndependentPreview(comp).total;
  }
  return calcNFormulaPreview(comp.marco.marco_validado, comp.parametros.p, comp.parametros.z, comp.parametros.e, comp.parametros.deff);
}

export function componentRoundedTarget(comp: CalcMuestraComponente, escenario?: CalcMuestraWorkspaceEscenario) {
  const formula = componentFormulaBase(comp);
  return roundUpTo(formula, escenario?.redondeo_multiplo ?? 100);
}

export function scenarioTarget(escenario: CalcMuestraWorkspaceEscenario) {
  const explicit = safeNumber(escenario.parametros.n_minimo_estrato);
  return explicit > 0 ? explicit : 0;
}

export function prepareUniversityStudyForCalculation(estudio: CalcMuestraEstudio, workspace: CalcMuestraWorkspace): CalcMuestraEstudio {
  const [rawTotal, rawFaculty] = universityComponents(estudio.componentes);
  const nextWorkspace = universityWorkspace(workspace, rawTotal, rawFaculty);
  const totalScenario = nextWorkspace.escenarios.find((e) => e.component_id === rawTotal.id);
  const facultyScenario = nextWorkspace.escenarios.find((e) => e.component_id === rawFaculty.id);
  const totalRounded = scenarioTarget(totalScenario ?? ESCENARIOS_OPINION[0]) || componentRoundedTarget(rawTotal, totalScenario);
  const facultyRounded = scenarioTarget(facultyScenario ?? ESCENARIOS_OPINION[1]) || componentRoundedTarget(rawFaculty, facultyScenario);
  const total = totalRounded && safeNumber(rawTotal.meta.valor) <= 0
    ? { ...rawTotal, meta: { ...rawTotal.meta, valor: totalRounded } }
    : rawTotal;
  const faculty = facultyRounded && safeNumber(rawFaculty.meta.valor) <= 0
    ? { ...rawFaculty, meta: { ...rawFaculty.meta, valor: facultyRounded } }
    : rawFaculty;
  return {
    ...estudio,
    componentes: [total, faculty],
    workspace: universityWorkspace(nextWorkspace, total, faculty),
  };
}

export function hasUsefulResult(comp: CalcMuestraComponente) {
  return !!comp.resultado && safeNumber(comp.resultado.n_objetivo, 0) > 0;
}

/** Etiqueta corta del escenario según el componente (universidad/facultad). */
export function proposalShortLabel(comp: CalcMuestraComponente) {
  return comp.actor_id === UNIVERSITY_FACULTY_COMPONENT_ID ? "Nivel facultad" : "Nivel universidad";
}

/** Aulas extra operativas: por estrato si están fijadas, si no default × celdas. */
export function estimateOperationalExtra(estratos: CalcMuestraEstrato[], config: CalcMuestraWorkspaceAulasConfig) {
  const fromEstratos = estratos.reduce((sum, e) => sum + safeNumber(e.aulas_extra_operativas, 0), 0);
  if (fromEstratos > 0) return fromEstratos;
  const cells = Math.max(1, estratos.filter((e) => safeNumber(e.N) > 0).length);
  return cells * config.aulas_extra_operativas_default;
}

/**
 * Filas de distribución por facultad (cuota, sexo, error y p usados) a partir
 * de la distribución VALIDADA del motor (`resultado.distribucion_estratos` +
 * `distribucion_sub`). Sin resultado del motor devuelve [].
 */
export function universityDistributionRows(comp: CalcMuestraComponente) {
  const estratos = comp.marco.estratos ?? [];
  const subs = comp.resultado?.distribucion_sub ?? [];
  return (comp.resultado?.distribucion_estratos ?? []).map((row) => {
    const marcoRow = estratos.find((e) => e.label === row.estrato);
    const subA = subs.find((s) => s.estrato === row.estrato && s.sub === (marcoRow?.sub_a_label ?? "Mujeres")) ??
      subs.find((s) => s.estrato === row.estrato && s.sub.toLowerCase().includes("mujer"));
    const subB = subs.find((s) => s.estrato === row.estrato && s.sub === (marcoRow?.sub_b_label ?? "Hombres")) ??
      subs.find((s) => s.estrato === row.estrato && s.sub.toLowerCase().includes("hombre"));
    return {
      facultad: row.estrato,
      N: safeNumber(row.N),
      error: comp.tecnica === "prob_estratificado_independiente"
        ? safeNumber(marcoRow?.e_facultad, row.precision_e ?? comp.parametros.e)
        : comp.parametros.e,
      p: comp.tecnica === "prob_estratificado_independiente"
        ? safeNumber(row.p_e ?? marcoRow?.p_facultad, comp.parametros.p)
        : comp.parametros.p,
      mujeres: safeNumber(subA?.n),
      hombres: safeNumber(subB?.n),
      n: safeNumber(row.n),
    };
  });
}

export function estimateClassroomBase(comp: CalcMuestraComponente) {
  const fromResult = safeNumber(comp.resultado?.aulas_base_total, 0);
  if (fromResult > 0) return fromResult;
  const fixed = (comp.marco.estratos ?? []).reduce((sum, e) => sum + safeNumber(e.aulas_base_fijas, 0), 0);
  if (fixed > 0) return fixed;
  const target = safeNumber(comp.meta.valor, 0);
  if (target <= 0) return null;
  const operative = target * (1 + safeNumber(comp.parametros.oversample_pct, 0));
  const effectiveClassroom = Math.max(1, safeNumber(comp.parametros.promedio_conglomerado, 25) * safeNumber(comp.parametros.tau, 0.7));
  return Math.ceil(operative / effectiveClassroom);
}

/**
 * Deriva los estratos facultad×sexo del marco recién construido (filas de
 * población del frame) para sincronizarlos con los componentes del cálculo.
 * Es el handoff Marco → Cálculo: sin esto el estudio se queda con N = 0
 * aunque la base ya esté leída y depurada.
 */
export function estratosDesdeFrame(
  populationRows: Array<Record<string, unknown>>,
): { estratos: CalcMuestraEstrato[]; total: number } | null {
  if (!populationRows.length) return null;
  const facultyKeys = ["faculty", "facultad", "unidad_academica", "escuela"];
  const sexKeys = ["sex", "sexo", "genero", "gender"];
  const leer = (row: Record<string, unknown>, keys: string[]) => {
    for (const key of keys) {
      const value = Array.isArray(row[key]) ? (row[key] as unknown[])[0] : row[key];
      if (value != null && String(value).trim()) return String(value).trim();
    }
    return "";
  };

  const porFacultad = new Map<string, Map<string, number>>();
  const porSexo = new Map<string, number>();
  let total = 0;
  for (const row of populationRows) {
    const facultad = leer(row, facultyKeys);
    if (!facultad) continue;
    const sexo = leer(row, sexKeys) || "Sin dato";
    total += 1;
    const sexos = porFacultad.get(facultad) ?? new Map<string, number>();
    sexos.set(sexo, (sexos.get(sexo) ?? 0) + 1);
    porFacultad.set(facultad, sexos);
    porSexo.set(sexo, (porSexo.get(sexo) ?? 0) + 1);
  }
  if (!porFacultad.size || total === 0) return null;

  // Las dos categorías de sexo dominantes definen sub_a/sub_b (orden estable).
  const sexosOrdenados = [...porSexo.entries()].sort((a, b) => b[1] - a[1]).map(([label]) => label);
  const subA = sexosOrdenados[0] ?? "Sin dato";
  const subB = sexosOrdenados[1] ?? "";

  const estratos = [...porFacultad.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], "es"))
    .map(([label, sexos]) => {
      const nA = sexos.get(subA) ?? 0;
      const nB = subB ? sexos.get(subB) ?? 0 : 0;
      const n = [...sexos.values()].reduce((sum, v) => sum + v, 0);
      return {
        label,
        N: n,
        N_a: nA,
        N_b: nB,
        sub_a_label: subA,
        sub_b_label: subB || "Otro",
      } as CalcMuestraEstrato;
    });
  return { estratos, total };
}
