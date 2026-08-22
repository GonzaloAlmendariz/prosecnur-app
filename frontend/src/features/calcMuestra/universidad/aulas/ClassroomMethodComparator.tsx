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
    <section className="cmv2-method-comparator" aria-label="Comparación de métodos de selección">
      {/* F102 · Esto era un `<details>` cerrado rotulado «Abrir comparador
          vigente». Detrás del click no había información de apoyo: estaban los
          botones «Usar método», que cambian el método de muestreo de la corrida.
          Y dentro, a un segundo click, la evidencia visual para elegirlo.

          La etiqueta además escribía la afordancia —«Abrir…»— en el único hueco
          donde cabía decir de qué trata. Ahora el encabezado nombra la pieza y
          publica cuántos métodos se compararon. */}
      <header className="cmv2-method-comparator-head">
        {/* «Comparación de métodos» a secas, después de un bloque que también
            habla de los cuatro métodos, se leía como una segunda comparación.
            El título dice qué añade: aquí están los NÚMEROS de este marco, no la
            explicación de los métodos. Llevó un «Paso 2» mientras la didáctica
            iba encima; al invertirse el orden la numeración dejó de describir
            nada, porque ya no son dos pasos de una secuencia. */}
        <strong>Qué dio cada método con este marco</strong>
        {ready ? (
          <span>
            {methods.length} {methods.length === 1 ? "método evaluado" : "métodos evaluados"} sobre
            las mismas aulas
          </span>
        ) : null}
      </header>
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
                  <strong>{classroomMethodLabel(String(method.method_id)) || method.method_label}</strong>
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
          {/* Anidado dentro del anterior, esto quedaba a DOS clicks. Es la
              lectura visual de la misma comparación que la tabla da en cifras:
              la evidencia con la que se elige método. Medido antes de abrirlo,
              porque el coste es la única razón legítima para plegar algo: 187
              líneas de DOM, sin Plotly. */}
          <ComparadorMetodosVisual comparison={comparison} />
        </div>
      )}
    </section>
  );
}
