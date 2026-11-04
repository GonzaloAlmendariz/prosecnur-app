// ADR 0078 — el chip que distingue las cuatro situaciones que se veían iguales
// en la lista de preguntas. El motivo de «no se categoriza» va junto al chip,
// a la vista, no en un tooltip: es la información que evita que la próxima
// persona lo confunda con un olvido, y esconderla detrás de un hover la pierde.
//
// P6 de la pasada de formato (4 nov 2026): el estado es el `EstadoChip` del kit
// (punto del tono, mayúscula inicial, detalle en el `title`); la coletilla va
// fuera de la píldora, en texto apagado, en vez de coserse con « · ».

import type { CodifDecision } from "../../api/codificacion";
import { EstadoChip } from "../../components/EstadoChip";
import type { ChromeStatusTone } from "../../components/ModuleCommandBar";
import { presentarDecision, type DecisionTono } from "./decisionCodificacion";

const TONOS: Record<DecisionTono, ChromeStatusTone> = {
  abierto: "warn",
  cerrado: "success",
  neutro: "neutral",
};

export default function DecisionChip({
  decision,
  motivo,
  nota,
}: {
  decision: CodifDecision;
  motivo?: string;
  /** Lo que falta, en números. Nunca coincide con `motivo`: uno es de las
      cerradas y el otro de las abiertas. */
  nota?: string | null;
}) {
  const meta = presentarDecision(decision);
  if (!meta) return null;
  // Se pintan en la misma ranura pero NO son lo mismo: el motivo explica una
  // decisión y la nota cuenta lo que falta. Colapsarlos en una variable dejaba
  // títulos como «Motivo: 48 sin asignar».
  const razon = motivo?.trim();
  const pendiente = razon ? undefined : nota?.trim();
  const coletilla = razon || pendiente;

  return (
    <span className="pulso-codif-decision" data-decision={decision} data-nota={pendiente || undefined}>
      <EstadoChip
        label={meta.etiqueta}
        tone={TONOS[meta.tono]}
        detail={razon ? `${meta.detalle} Motivo: ${razon}` : meta.detalle}
      />
      {coletilla && <span className="pulso-codif-decision-coletilla">{coletilla}</span>}
    </span>
  );
}
