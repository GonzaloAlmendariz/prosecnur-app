import type { ComponentProps } from "react";
import { CargaTopologyDecision } from "../CargaTopologyDecision";
import { PestanaFuentes, type PestanaFuentesProps } from "./PestanaFuentes";

type Decision = ComponentProps<typeof CargaTopologyDecision>;

export type PestanaBasesProps = {
  relacion: {
    topologia: Decision["resolution"];
    intencion: Decision["intent"];
    ocupado: boolean;
    onCambiarIntencion: Decision["onIntentChange"];
  };
  fuentes: PestanaFuentesProps;
};

/**
 * Bases (ADR 0142): cómo se relacionan las bases del estudio y de dónde entra
 * cada una. Provisional hasta el rediseño de la pestaña: junta la decisión que
 * vivía en Plan con el contenido de Fuentes, sin cambiar ninguno de los dos.
 */
export function PestanaBases({ relacion, fuentes }: PestanaBasesProps) {
  return (
    <>
      <CargaTopologyDecision
        resolution={relacion.topologia}
        intent={relacion.intencion}
        disabled={relacion.ocupado}
        onIntentChange={relacion.onCambiarIntencion}
      />
      <PestanaFuentes {...fuentes} />
    </>
  );
}
