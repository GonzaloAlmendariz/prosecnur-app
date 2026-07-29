// overview.ts — resumen de proyecto (Home mission-control).
// Extraído de client.ts (split por dominio, 2026-07). Los consumidores
// importan del barrel ./client; este módulo no cambia el contrato.

import { apiFetch, handle, headers } from "./core";
import type { DisenoEstudioNextAction, DisenoEstudioProtocol, DisenoEstudioRisk, DisenoEstudioSource } from "./disenoEstudio";

// ============================================================================
// Resumen de proyecto (Home mission-control)
// ============================================================================

export type ProjectOverviewMaturityLevel = "new" | "in_progress";

export type ProjectOverviewMaturity = {
  level: ProjectOverviewMaturityLevel;
  has_any_work: boolean;
  readiness_score: number;
  ready_count: number;
  active_count: number;
  warning_count: number;
  pending_count: number;
  total_count: number;
};

export type ProjectOverviewMetrics = {
  bases_count: number;
  records_count: number;
  variables_count: number;
  sample_target_n: number;
  classroom_units_count: number;
  monitoring_sources_count: number;
  monitoring_family: string;
  monitoreo_last_cut: string;
};

export type ProjectOverviewFacts = {
  bitacora: {
    next_title: string;
    next_date: string;
    pending: number;
    total_tasks: number;
    /** Entradas del log de bitácora que el usuario registró (≠ tasks del cronograma). */
    entries_count: number;
    last_entry_at: string;
    last_entry_title: string;
    decisions_count: number;
    risks_count: number;
    blocks_count: number;
  };
  monitoreo: {
    family: string;
    has_snapshot: boolean;
    /** Denominador del avance: universo contactado (acreditación/telefónico) o respuestas (territorial). */
    collected: number;
    /** Numerador del avance: efectivas (acreditación/telefónico) o válidas (territorial/aulas). */
    valid: number;
    target: number;
    /** Avance % conocido, o -1 cuando no hay meta/dato. */
    avance_pct: number;
    alerts: number;
    /**
     * Vocabulario de la familia. El numerador y el denominador no significan lo
     * mismo entre familias (válidas sobre meta vs efectivas sobre universo), así
     * que la etiqueta viaja con el dato. `collected_label` describe a
     * `collected`. Opcionales por compatibilidad con payloads previos al fix.
     */
    valid_label?: string;
    collected_label?: string;
    avance_label?: string;
    /**
     * Cuotas por actor/segmento. El agregado orienta y es comparable entre
     * proyectos, pero esconde al que está parado: sin `lagging_actor`, un 65%
     * global no deja ver un actor al 1%. `-1` en `lagging_pct` = sin dato.
     */
    actors_count?: number;
    actors_done?: number;
    lagging_actor?: string;
    lagging_pct?: number;
  };
  calc: {
    macro_familia: string;
    /** "aulas" | "territorial" | "general". */
    mode: string;
    aulas_titulares: number;
    students_covered: number;
    faculties_count: number;
    territories_count: number;
    techniques_count: number;
    actors_count: number;
  };
  hojas: {
    phase: string;
    districts_count: number;
    n_objetivo: number;
    blocks_count: number;
    replacement_blocks_count: number;
    interviews_count: number;
    quota_assigned: number;
    from_pilot: boolean;
  };
  recopiladores: {
    total: number;
    titulares: number;
    with_link: number;
    without_link: number;
    faculties_count: number;
    eligible_total: number;
  };
  editor: {
    /** "" (desde cero) | "xlsform" (importado) | "surveymonkey" (traducido). */
    source_kind: string;
    questions_count: number;
    sections_count: number;
    catalogs_count: number;
    /** Instrumentos vinculados al estudio. El borrador del editor es uno de
        ellos, así que con varios `questions_count` no describe el estudio. */
    instruments_count?: number;
  };
  procesamiento?: {
    /** "unibase" | "multibase". */
    processing_mode: string;
    bases_count: number;
    /** Bases que ya tienen analítica. Las otras 4 fases son flags globales de
        sesión, no por base: no hay avance por base que reportar. */
    bases_con_analitica: number;
  };
  dashboard: {
    sections_count: number;
    excluded_vars_count: number;
    confirmed: boolean;
    published: boolean;
    published_at: string;
    rows_count: number;
  };
};

export type ProjectOverviewProject = {
  name: string;
  client: string;
  project_file: string;
  has_project: boolean;
  processing_mode: string;
  saved_at: string;
};

export type ProjectOverview = {
  ok: true;
  schema: "project_overview_v1" | string;
  generated_at: string;
  project: ProjectOverviewProject;
  maturity: ProjectOverviewMaturity;
  metrics: ProjectOverviewMetrics;
  protocol: DisenoEstudioProtocol;
  facts: ProjectOverviewFacts;
  modules: DisenoEstudioSource[];
  /** Slugs de módulos agregados al proyecto, o null si nunca se curó
      (el frontend deriva un default desde el avance). */
  added_modules: string[] | null;
  next_actions: DisenoEstudioNextAction[];
  risks: DisenoEstudioRisk[];
};

export async function apiProjectOverview() {
  return handle<ProjectOverview>(
    await apiFetch("/api/project/overview", { headers: headers() }),
  );
}

export async function apiProjectModulesSet(modules: string[]) {
  return handle<{ ok: true; modules: string[] }>(
    await apiFetch("/api/project/modules", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ modules }),
    }),
  );
}
