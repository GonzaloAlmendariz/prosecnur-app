// Pastilla y acción de la base de la que se lee una pregunta del selector (modelo en baseDeReferencia.ts).
import { Pin } from "lucide-react";
import { Alert } from "../../components/Alert";
import { PulsoButton } from "../../components/PulsoButton";
import type { EstadoBaseRef } from "./baseDeReferencia";
import { rotuloBase } from "./baseDeReferencia";
import "./pastillaBaseRef.css";

type PastillaProps = {
  estado: EstadoBaseRef;
  /** Sin la pastilla neutra: donde la fila ya dice de qué base es. Las alertas se muestran igual. */
  ocultarNeutra?: boolean;
};

export function PastillaBaseRef({ estado, ocultarNeutra = false }: PastillaProps) {
  switch (estado.tipo) {
    case "base-activa":
      if (ocultarNeutra) return null;
      return (
        <span className="pulso-gv2-variable-trigger-source" data-base-ref="activa" title="Se lee de la base activa del informe.">
          {rotuloBase(estado.base)}
        </span>
      );
    case "en-otra-base":
      return (
        <span className="pulso-gv2-variable-trigger-source pulso-base-ref-pastilla is-otra-base" data-base-ref="otra" title={`Está en la base «${estado.base}».`}>
          En otra base
        </span>
      );
    case "en-ninguna":
      return (
        <span className="pulso-gv2-variable-trigger-source pulso-base-ref-pastilla is-ninguna" data-base-ref="ninguna" title="Esta pregunta no está en ninguna base del estudio.">
          No está en ninguna base
        </span>
      );
    case "falta-base":
      return (
        <span className="pulso-gv2-variable-trigger-source is-sin-base" data-base-ref="falta" title="Esta variable no dice de qué base es. Vuelve a elegirla.">
          Falta la base
        </span>
      );
    default:
      return null;
  }
}

type FijarProps = {
  estado: EstadoBaseRef;
  baseActiva: string | null;
  onFijar: (base: string) => void;
};

/** Debajo del disparador, sólo cuando la pregunta está en otra base: dice en cuál y ofrece escribir el prefijo. */
export function FijarEnOtraBase({ estado, baseActiva, onFijar }: FijarProps) {
  if (estado.tipo !== "en-otra-base") return null;
  return (
    <div className="pulso-base-ref-aviso" role="status">
      <Alert kind="warn">
        <span className="pulso-base-ref-texto">
          {baseActiva ? `No está en la base «${baseActiva}». ` : ""}
          Está en {estado.otras.length > 1 ? "las bases " : "la base "}
          {estado.otras.map((b) => `«${b}»`).join(" y ")}.
        </span>
        <span className="pulso-base-ref-acciones">
          {estado.otras.map((base) => (
            <PulsoButton key={base} variant="secondary" size="sm" onClick={() => onFijar(base)}>
              <Pin size={12} aria-hidden="true" />
              Fijar en {base}
            </PulsoButton>
          ))}
        </span>
      </Alert>
    </div>
  );
}
