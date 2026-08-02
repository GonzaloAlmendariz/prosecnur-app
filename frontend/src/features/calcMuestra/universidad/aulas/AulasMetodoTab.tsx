/** Método primero como decisión comprensible; el comparador queda colapsado. */
import { BarChart3 } from "../../../../vendor/lucide-react";
import type {
  CalcMuestraWorkspace,
  CalcMuestraWorkspaceAulasConfig,
} from "../../../../api/client";
import { AvisoModulo } from "../shared/AvisoModulo";
import { normalizeAulasSelectorEngine, normalizeUniversityAulasConfig } from "../shared/study";
import { DescuentoRepetidosControl } from "./DescuentoRepetidosControl";
import {
  ClassroomLabCommandBar,
  type ClassroomLabModel,
} from "./aulasParts";
import { ClassroomMethodComparator } from "./ClassroomMethodComparator";
import { ClassroomMethodDecisionHero, ClassroomMethodStories } from "./ClassroomMethodStories";
import { resolveClassroomMethodDecision } from "./classroomMethodStoriesModel";
import {
  AulasStageNotice,
  resolveAulasStageNotice,
  type AulasNavigate,
} from "./aulasSurfaceState";
import { ClassroomRiskList } from "./ClassroomRiskList";
import "../../didactica/didactica.css";
import "./aulas.css";

export function AulasMetodoTab({
  workspace,
  model,
  busy,
  onWorkspace,
  onCompare,
  onSelectMethod,
  onNavigate,
}: {
  workspace: CalcMuestraWorkspace;
  model: ClassroomLabModel;
  busy: string | null;
  onWorkspace: (workspace: CalcMuestraWorkspace) => void;
  onCompare: (config: CalcMuestraWorkspaceAulasConfig, simulationRuns: number) => void | Promise<void>;
  onSelectMethod: (config: CalcMuestraWorkspaceAulasConfig, methodId?: string) => void | Promise<void>;
  onNavigate?: AulasNavigate;
}) {
  const { config, comparison, comparisonMethods, engineOption } = model;

  function setSelector(next: string) {
    const nextEngine = normalizeAulasSelectorEngine(next);
    onWorkspace({
      ...workspace,
      aulas_config: normalizeUniversityAulasConfig({
        ...config,
        selector: nextEngine,
        selector_engine: nextEngine,
        method_family: nextEngine === "pool_controlado" ? "probability_with_operational_optimization" : "balanced_probability",
      }),
    });
  }

  function runComparison() {
    void onCompare(config, config.simulation_runs ?? config.monte_carlo_n ?? 500);
  }

  // Decisión del usuario: vive en el workspace (autosave) y manda sobre el
  // eco de la última corrida (ver buildClassroomLabModel). Solo surte efecto
  // al ejecutar una selección nueva.
  function setSequentialDiscount(value: boolean) {
    onWorkspace({
      ...workspace,
      aulas_config: normalizeUniversityAulasConfig({ ...config, sequential_discount: value }),
    });
  }

  const hayComparacion = model.comparisonReady && Boolean(comparison && comparisonMethods.length);
  const stageNotice = resolveAulasStageNotice(model, "metodo");
  const decision = resolveClassroomMethodDecision({
    comparisonReady: model.comparisonReady,
    comparison,
    configuredMethodId: String(config.selector_engine ?? config.selector),
    configuredMethodLabel: engineOption.label,
  });

  return (
    <div className="cmv2-aulas-stack">
      <ClassroomMethodDecisionHero decision={decision} />

      {hayComparacion && (
        <ClassroomLabCommandBar
          model={model}
          busy={busy}
          acciones={["comparar"]}
          onCompare={onCompare}
        />
      )}

      {stageNotice && (
        <AulasStageNotice
          notice={stageNotice}
          onNavigate={onNavigate}
          onAction={stageNotice.localAction === "compare" ? runComparison : undefined}
          disabled={Boolean(stageNotice.localAction) && (Boolean(busy) || !model.frameReady || !model.hasCalculatedQuota)}
        />
      )}

      <div className="cmv2-classroom-lab-grid">
        <div className="cmv2-classroom-lab-main">
          <div className="cmv2-subhead">
            <strong>Cuatro maneras de construir la selección</strong>
            <small>Primero entiende la historia; las métricas comparadas quedan al final.</small>
          </div>
          <ClassroomMethodStories
            configuredMethodId={String(config.selector_engine ?? config.selector)}
            recommendedMethodId={decision.kind === "recommended" ? decision.methodId : undefined}
            onConfigure={setSelector}
          />

          <DescuentoRepetidosControl
            checked={config.sequential_discount ?? true}
            selectorEngine={String(config.selector_engine ?? config.selector)}
            onChange={setSequentialDiscount}
          />
        </div>
        <aside className="cmv2-classroom-lab-side">
          <ClassroomRiskList risks={comparison?.risk_flags ?? []} audited={model.comparisonReady} />
          <AvisoModulo tone="neutral" icon={BarChart3}>
            El PPS queda como base auditable. Cube prioriza balance; pivotal añade dispersión; el pool
            reduce repetidos y exige probabilidades finales estimadas por simulación.
          </AvisoModulo>
        </aside>
      </div>

      <ClassroomMethodComparator
        ready={hayComparacion}
        comparison={comparison}
        methods={comparisonMethods}
        recommendedMethodId={decision.kind === "recommended" ? decision.methodId : ""}
        config={config}
        busy={busy}
        onSelectMethod={onSelectMethod}
      />
    </div>
  );
}
