import type {
  CalcMuestraAulasState,
  CalcMuestraComponente,
  CalcMuestraWorkspace,
  CalcMuestraWorkspaceAulasConfig,
} from "../../../../api/client";
import { safeNumber } from "../../sharedCore";
import {
  classroomComparisonForState,
  classroomComparisonReady,
  classroomFrameReady,
  marcoCriteriosDesactualizado,
  classroomReplacementReady,
  classroomReplacementSimulationForState,
  classroomSelectionForState,
  classroomSelectionReady,
} from "../shared/frame";
import {
  hasUsefulResult,
  normalizeUniversityAulasConfig,
  universityAulasScenario,
  universityComponentForScenario,
} from "../shared/study";

export function classroomSelectorTarget(raw: unknown): number {
  if (raw == null || typeof raw !== "object") return 0;
  const record = raw as Record<string, unknown>;
  const selector = record.selector;
  const nestedTarget = selector && typeof selector === "object"
    ? (selector as Record<string, unknown>).n_aulas
    : undefined;
  return safeNumber(record.n_aulas ?? nestedTarget, 0);
}

export function resolveClassroomHandoff({
  workspaceConfig,
  runConfig,
  expectedTarget,
  marcoDesactualizado,
}: {
  workspaceConfig?: CalcMuestraWorkspaceAulasConfig;
  runConfig?: Record<string, unknown>;
  expectedTarget: number;
  marcoDesactualizado: boolean;
}) {
  const persistedTarget = safeNumber(workspaceConfig?.n_aulas, 0);
  const currentAulasTarget = persistedTarget > 0 && persistedTarget === expectedTarget
    ? persistedTarget
    : 0;
  const config = normalizeUniversityAulasConfig({
    ...normalizeUniversityAulasConfig(workspaceConfig),
    n_aulas: currentAulasTarget || undefined,
  });
  const runMatchesTarget = currentAulasTarget > 0 &&
    classroomSelectorTarget(runConfig) === currentAulasTarget;
  return { config, currentAulasTarget, runIsCurrent: runMatchesTarget && !marcoDesactualizado };
}

export function resolveClassroomArtifactStatus({
  workspace,
  totalComp,
  facultyComp,
  aulasState,
  marcoDesactualizado = false,
}: {
  workspace: CalcMuestraWorkspace;
  totalComp: CalcMuestraComponente;
  facultyComp: CalcMuestraComponente;
  aulasState: CalcMuestraAulasState | null;
  marcoDesactualizado?: boolean;
}) {
  const aulasScenario = universityAulasScenario(workspace);
  const selectedComp = universityComponentForScenario([totalComp, facultyComp], workspace) ??
    (aulasScenario === "e2" ? facultyComp : totalComp);
  const selectedResultReady = hasUsefulResult(selectedComp);
  const workspaceConfig = normalizeUniversityAulasConfig(workspace.aulas_config);
  const decisiones = workspace.motor_recorrido?.decisiones as Record<string, unknown> | undefined;
  const rawOpcionales = decisiones?.opcionalesActivos;
  const opcionalesActivos = Array.isArray(rawOpcionales)
    ? rawOpcionales.filter((item): item is string => typeof item === "string")
    : [];
  const artifactMarcoDesactualizado = marcoDesactualizado || marcoCriteriosDesactualizado(
    aulasState?.frame ?? null,
    workspaceConfig.criterios_seleccion,
    workspaceConfig.teacher_type_orden,
    { config: workspaceConfig, opcionalesActivos },
  );
  const handoff = resolveClassroomHandoff({
    workspaceConfig,
    runConfig: aulasState?.config,
    expectedTarget: selectedResultReady ? safeNumber(selectedComp.resultado?.aulas_base_total, 0) : 0,
    marcoDesactualizado: artifactMarcoDesactualizado,
  });
  const selection = classroomSelectionForState(aulasState);
  const comparison = classroomComparisonForState(aulasState);
  const replacement = classroomReplacementSimulationForState(aulasState);
  const frameHash = String(aulasState?.frame?.frame_hash ?? "");
  const frameReady = classroomFrameReady(aulasState) && !artifactMarcoDesactualizado;
  const matchesFrame = (artifact: { frame_hash?: string } | null | undefined) =>
    Boolean(frameHash && artifact?.frame_hash === frameHash);
  const comparisonReady = classroomComparisonReady(aulasState) && frameReady && handoff.runIsCurrent &&
    classroomSelectorTarget(comparison) === handoff.currentAulasTarget && matchesFrame(comparison);
  const selectionRunId = String(selection?.selection_run_id ?? "").trim();
  const replacementSelectionRunId = String(replacement?.selection_run_id ?? "").trim();
  const selectionReady = classroomSelectionReady(aulasState) && handoff.currentAulasTarget > 0 &&
    frameReady && Boolean(selectionRunId) && classroomSelectorTarget(selection) === handoff.currentAulasTarget && matchesFrame(selection);
  const replacementReady = classroomReplacementReady(aulasState) && selectionReady &&
    Boolean(selectionRunId) && replacementSelectionRunId === selectionRunId && matchesFrame(replacement);
  return {
    aulasScenario,
    selectedComp,
    selectedResultReady,
    frameReady,
    marcoDesactualizado: artifactMarcoDesactualizado,
    ...handoff,
    comparisonReady,
    selectionReady,
    replacementReady,
  };
}
