import { BarChart3, Loader2, RefreshCw, Sigma, Table2 } from "lucide-react";
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
  mostrarRecomendado = true,
}: {
  /** Muestra «Recomendado: X» en la barra. Se apaga donde la pestaña ya tiene la tarjeta de recomendación. */
  mostrarRecomendado?: boolean;
  model: ClassroomLabModel;
  busy: string | null;
  /**
   * `comparar` y `estabilidad` llamaban a la MISMA acción con las mismas 500
   * corridas, en dos pestañas distintas: Método y Simulación ofrecían el mismo
   * botón y no había forma de saber en qué se diferenciaban. Gonzalo,
   * 2026-08-22: «no siento que los dos estén debidamente diferenciados
   * contextualmente». Ahora responden a dos preguntas distintas:
   *   comparar    -> cuál de los cuatro métodos uso (una corrida por método)
   *   estabilidad -> cuánto varía el que ya elegí (N corridas del mismo)
   */
  acciones: Array<"comparar" | "estabilidad" | "seleccionar" | "reemplazos">;
  onCompare?: (config: CalcMuestraWorkspaceAulasConfig, simulationRuns: number) => void | Promise<void>;
  onSelectMethod?: (config: CalcMuestraWorkspaceAulasConfig, methodId?: string) => void | Promise<void>;
  onSimulateReplacements?: (config: CalcMuestraWorkspaceAulasConfig) => void | Promise<void>;
}) {
  const { config } = model;
  // El número de corridas de estabilidad es del estudio, no del botón.
  const corridasEstabilidad = Number(config.simulation_runs ?? config.monte_carlo_n ?? 500) || 500;
  return (
    <>
    <div className="cmv2-classroom-commandbar" aria-label="Acciones de selección de cursos-horario">
      {acciones.includes("comparar") && onCompare && (
        <button
          type="button"
          className="cmv2-ghost"
          // Sin corridas de auditoría: una pasada por método, que es lo que hace
          // falta para elegir. Las 500 de antes eran las de estabilidad, y
          // convertían una decisión rápida en una espera larga.
          onClick={() => void onCompare(config, 0)}
          disabled={Boolean(busy) || !model.frameReady || !model.hasCalculatedQuota}
          title="Corre una vez cada uno de los cuatro métodos y compara representatividad, balance, repetidos y cobertura, para decidir con cuál sortear."
        >
          {busy === "Comparando métodos" ? <Loader2 size={14} className="pulso-spin" /> : <BarChart3 size={14} />}
          Comparar los cuatro métodos
        </button>
      )}
      {acciones.includes("estabilidad") && onCompare && (
        <button
          type="button"
          className="cmv2-ghost"
          onClick={() => void onCompare(config, corridasEstabilidad)}
          disabled={Boolean(busy) || !model.frameReady || !model.hasCalculatedQuota}
          title="Repite el sorteo muchas veces sobre el mismo marco para medir cuánto cambia el resultado de una corrida a otra. Responde si la muestra es estable, no cuál método usar."
        >
          {busy === "Comparando métodos" ? <Loader2 size={14} className="pulso-spin" /> : <Sigma size={14} />}
          Medir estabilidad ({corridasEstabilidad} corridas)
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
          Sortear con {classroomMethodLabel(model.recommendedMethodId)}
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
      {/* En Método y Simulación esta línea repite, a 83-120 px de distancia, lo
          que la tarjeta de recomendación ya dice con su nombre Y su
          descripción: medido el 2026-08-22, «Optimizar repetidos» aparecía dos
          veces en los primeros 100 px de scroll. Donde no hay tarjeta —
          Selección, Reemplazos— esta línea es el único sitio que nombra el
          método vigente, así que no se borra: se apaga donde sobra. */}
      {mostrarRecomendado && model.comparison?.recommendation && (
        <span className="cmv2-classroom-recommendation">
          Recomendado: <strong>{classroomMethodLabel(model.recommendedMethodId) || model.comparison.recommendation.method_label}</strong>
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
