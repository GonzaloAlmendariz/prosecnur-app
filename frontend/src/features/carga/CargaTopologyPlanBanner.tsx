import { ArrowRight, Info, Network } from "../../vendor/lucide-react";
import type { MultiBaseStrategy } from "./store";

const STRATEGY_SUMMARY: Record<MultiBaseStrategy, string> = {
  separate: "Bases separadas: cada fuente conservará su formulario y sus respuestas.",
  integrated: "Base integrada: Fuentes abrirá la preparación de una base común con trazabilidad de origen.",
  independent: "Hermanas independientes: cada encuesta conservará sus datos y compartirá reglas de trabajo.",
};

export function CargaTopologyPlanBanner({
  strategy,
  disabled,
  onEnableMultiBase,
}: {
  strategy: MultiBaseStrategy | null;
  disabled: boolean;
  onEnableMultiBase: (strategy: MultiBaseStrategy) => void | Promise<void>;
}) {
  return (
    <section className="pulso-carga-topology-plan-banner" aria-labelledby="carga-topology-plan-banner-title">
      <span className="pulso-carga-topology-plan-banner-icon" aria-hidden="true">
        <Network size={17} />
      </span>
      <div>
        <span className="pulso-section-eyebrow">Plan pendiente de activar</span>
        <h2 id="carga-topology-plan-banner-title">Prepara aquí el estudio de varias bases</h2>
        <p>
          {strategy
            ? STRATEGY_SUMMARY[strategy]
            : "Elegiste varias bases, pero aún falta definir cómo se relacionan en Plan."}
        </p>
        <small><Info size={12} aria-hidden="true" /> La activación prepara la mesa; no importa ni combina archivos.</small>
      </div>
      <button
        type="button"
        className="pulso-carga-topology-plan-action"
        disabled={disabled || strategy === null}
        onClick={() => {
          if (strategy) void onEnableMultiBase(strategy);
        }}
      >
        Activar plan en Fuentes <ArrowRight size={14} aria-hidden="true" />
      </button>
    </section>
  );
}
