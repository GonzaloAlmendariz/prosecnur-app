import { BarChart3, Loader2, RefreshCw, Table2 } from "lucide-react";
import type { CalcMuestraWorkspaceAulasConfig } from "../../../../api/client";
import { AulasStaleJobAviso } from "./AulasStaleJobAviso";
import type { ClassroomLabModel } from "./classroomLabModel";
import { classroomMethodLabel } from "./classroomLabels";

export function ClassroomLabCommandBar({
  model,
  busy,
  acciones,
  onCompare,
  onSelectMethod,
  onSimulateReplacements,
}: {
  model: ClassroomLabModel;
  busy: string | null;
  acciones: Array<"comparar" | "seleccionar" | "reemplazos">;
  onCompare?: (config: CalcMuestraWorkspaceAulasConfig, simulationRuns: number) => void | Promise<void>;
  onSelectMethod?: (config: CalcMuestraWorkspaceAulasConfig, methodId?: string) => void | Promise<void>;
  onSimulateReplacements?: (config: CalcMuestraWorkspaceAulasConfig) => void | Promise<void>;
}) {
  const { config } = model;
  return (
    <>
    <div className="cmv2-classroom-commandbar" aria-label="Acciones de selección de cursos-horario">
      {acciones.includes("comparar") && onCompare && (
        <button
          type="button"
          className="cmv2-ghost"
          onClick={() => void onCompare(config, config.simulation_runs ?? config.monte_carlo_n ?? 500)}
          disabled={Boolean(busy) || !model.frameReady || !model.hasCalculatedQuota}
        >
          {busy === "Comparando métodos" ? <Loader2 size={14} className="pulso-spin" /> : <BarChart3 size={14} />}
          Comparar métodos
        </button>
      )}
      {acciones.includes("seleccionar") && onSelectMethod && (
        <button
          type="button"
          className="cmv2-primary"
          onClick={() => void onSelectMethod(config, model.recommendedMethodId)}
          disabled={Boolean(busy) || !model.comparisonReady}
        >
          {busy === "Seleccionando cursos-horario" ? <Loader2 size={14} className="pulso-spin" /> : <Table2 size={14} />}
          Seleccionar cursos-horario titulares
        </button>
      )}
      {acciones.includes("reemplazos") && onSimulateReplacements && (
        <button
          type="button"
          className="cmv2-ghost"
          onClick={() => void onSimulateReplacements(config)}
          disabled={Boolean(busy) || !model.selectionReady}
        >
          {busy === "Simulando reemplazos" ? <Loader2 size={14} className="pulso-spin" /> : <RefreshCw size={14} />}
          Probar reemplazos
        </button>
      )}
      {model.comparison?.recommendation && (
        <span className="cmv2-classroom-recommendation">
          Recomendado: <strong>{model.comparison.recommendation.method_label ?? classroomMethodLabel(model.recommendedMethodId)}</strong>
        </span>
      )}
    </div>
    {/* F4: la barra vive en todas las pestañas con acciones de la mesa; el
        aviso de "resultado no aplicado por marco viejo" se ancla aquí para
        que ninguna pestaña que pueda re-ejecutar el job se lo pierda. */}
    <AulasStaleJobAviso aviso={model.staleJobAviso} />
    </>
  );
}
