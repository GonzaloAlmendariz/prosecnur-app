import type {
  CalcMuestraAulasState,
  CalcMuestraAlumnosPorChDecision,
  CalcMuestraComponente,
  CalcMuestraWorkspace,
} from "../../../../api/client";
import { normalizeUniversityAulasConfig } from "../shared/study";

/**
 * Persiste una nueva firma del marco y borra de forma atómica los derivados
 * del cálculo anterior. El target de Aulas nunca puede sobrevivir al rehash.
 */
export function applyAlumnosPorChDecision({
  workspace,
  componentes,
  decision,
}: {
  workspace: CalcMuestraWorkspace;
  componentes: readonly CalcMuestraComponente[];
  decision: CalcMuestraAlumnosPorChDecision;
}) {
  const { n_aulas: _targetAnterior, ...config } = normalizeUniversityAulasConfig(
    workspace.aulas_config,
  );
  return {
    workspace: {
      ...workspace,
      aulas_config: { ...config, alumnos_por_ch_decision: decision },
    },
    componentes: componentes.map((componente) => ({ ...componente, resultado: null })),
  };
}

/** Conserva frame/config, pero ninguna salida derivada de la decisión vieja. */
export function invalidateAlumnosPorChAulasArtifacts(
  aulasState: CalcMuestraAulasState | null,
): CalcMuestraAulasState | null {
  if (!aulasState) return null;
  return {
    ...aulasState,
    selection: null,
    method_comparison: null,
    replacement_simulation: null,
    export: null,
    stale_job_result: null,
  };
}
