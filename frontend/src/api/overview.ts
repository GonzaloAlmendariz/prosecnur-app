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
    collected: number;
    valid: number;
    target: number;
    /** Avance % conocido, o -1 cuando no hay meta/dato. */
    avance_pct: number;
    alerts: number;
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
