import type {
  CalcMuestraAulasMethodComparison,
  CalcMuestraAulasMethodSummary,
  CalcMuestraWorkspaceAulasConfig,
} from "../../../../api/client";
import { ComparadorMetodosVisual } from "../../didactica/ComparadorMetodosVisual";
import { fmtPct } from "../../sharedCore";
import { ClassroomBalanceTable } from "./ClassroomMethodPanels";
import { classroomMethodLabel, classroomScore } from "./classroomLabels";

export function ClassroomMethodComparator({
  ready,
  comparison,
  methods,
  recommendedMethodId,
  config,
  busy,
  onSelectMethod,
}: {
  ready: boolean;
  comparison: CalcMuestraAulasMethodComparison | null;
  methods: CalcMuestraAulasMethodSummary[];
  recommendedMethodId: string;
  config: CalcMuestraWorkspaceAulasConfig;
  busy: string | null;
  onSelectMethod: (config: CalcMuestraWorkspaceAulasConfig, methodId?: string) => void | Promise<void>;
}) {
  return (
    <details className="cmv2-aulas-referencia cmv2-method-comparator">
      <summary>
        {ready ? `Abrir comparador vigente (${methods.length} métodos)` : "Comparador de métodos pendiente"}
      </summary>
      {!ready || !comparison ? (
        <div className="cmv2-classroom-empty is-compact">
          <div>
            <strong>Sin comparación vigente</strong>
            <em>El método configurado no se presenta como recomendación hasta comparar el marco y el objetivo actuales.</em>
          </div>
        </div>
      ) : (
        <div className="cmv2-method-comparator-body">
          <div
            className="cmv2-classroom-method-grid"
            data-qa-geometry-group="aulas-metodo-comparador"
            data-qa-geometry-contract="equal"
          >
            {methods.map((method) => {
              const recommended = method.method_id === recommendedMethodId;
              return (
                <article key={method.method_id} className={`cmv2-classroom-method-card${recommended ? " is-recommended" : ""}`} data-qa-geometry-member>
                  <small>{recommended ? "Recomendado" : "Resultado comparado"}</small>
                  <strong>{method.method_label || classroomMethodLabel(String(method.method_id))}</strong>
                  <div className="cmv2-classroom-quality-metrics">
                    <span><strong>{classroomScore(method.representativity_score ?? method.overall_score)}</strong> representatividad</span>
                    <span><strong>{classroomScore(method.balance_score)}</strong> balance</span>
                    <span><strong>{fmtPct(method.duplicate_loss ?? 0)}</strong> repetidos</span>
                    <span><strong>{fmtPct(method.coverage_unique_pct ?? 0)}</strong> cobertura</span>
                  </div>
                  <button type="button" className={recommended ? "cmv2-primary" : "cmv2-ghost"} onClick={() => void onSelectMethod(config, String(method.method_id))} disabled={Boolean(busy)}>
                    Usar método
                  </button>
                </article>
              );
            })}
          </div>
          <ClassroomBalanceTable rows={comparison.balance ?? []} methodId={recommendedMethodId} />
          <details className="cmv2-aulas-referencia">
            <summary>Referencia visual de la corrida</summary>
            <ComparadorMetodosVisual comparison={comparison} />
          </details>
        </div>
      )}
    </details>
  );
}
