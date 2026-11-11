import type { ComponentProps } from "react";
import { CargaPlanOverview } from "../CargaPlanOverview";
import { CargaTopologyDecision } from "../CargaTopologyDecision";

type Resumen = ComponentProps<typeof CargaPlanOverview>;
type Decision = ComponentProps<typeof CargaTopologyDecision>;

export type PestanaPlanProps = {
  topologia: Resumen["topology"];
  /** Bases primarias en varias bases; vacío con una sola base. */
  bases: Resumen["bases"];
  tieneFormulario: boolean;
  tieneRespuestas: boolean;
  mapeoPendiente: boolean;
  todoListo: boolean;
  onAbrirFuentes: () => void;
  intencion: Decision["intent"];
  ocupado: boolean;
  onCambiarIntencion: Decision["onIntentChange"];
};

/** Plan: resumen de cobertura y decisión de organización, igual con una o varias bases. */
export function PestanaPlan({
  topologia,
  bases,
  tieneFormulario,
  tieneRespuestas,
  mapeoPendiente,
  todoListo,
  onAbrirFuentes,
  intencion,
  ocupado,
  onCambiarIntencion,
}: PestanaPlanProps) {
  return (
    <CargaPlanOverview
      topology={topologia}
      bases={bases}
      hasInstrument={tieneFormulario}
      hasData={tieneRespuestas}
      pendingChoiceMapping={mapeoPendiente}
      allReady={todoListo}
      onOpenSources={onAbrirFuentes}
    >
      <CargaTopologyDecision
        resolution={topologia}
        intent={intencion}
        disabled={ocupado}
        onIntentChange={onCambiarIntencion}
      />
    </CargaPlanOverview>
  );
}
