// ADR 0078: decidir que una pregunta incluida no se codifica es una decisión con su motivo, y queda
// registrada. No es lo mismo que sacarla de la codificación con el interruptor, que borra la intención.
// El motivo es obligatorio: una decisión sin porqué no se distingue de un olvido.

import { useEffect, useId, useRef, useState } from "react";
import type { CodifDecision } from "../../../api/codificacion";
import { PulsoButton } from "../../../components/PulsoButton";

export type DecisionNoCodificarProps = {
  decision: CodifDecision;
  motivo?: string;
  busy?: boolean;
  onRegistrar: (motivo: string) => void;
  onRevertir: () => void;
};

export function DecisionNoCodificar({ decision, motivo, busy = false, onRegistrar, onRevertir }: DecisionNoCodificarProps) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const campo = useId();
  const caja = useRef<HTMLDivElement>(null);
  const entrada = useRef<HTMLInputElement>(null);

  // Al abrirse, el motivo y sus botones quedan a la vista dentro del inspector (el pie no los tapa) y
  // el foco va al campo.
  useEffect(() => {
    if (!abierto) return;
    caja.current?.scrollIntoView({ block: "nearest" });
    entrada.current?.focus({ preventScroll: true });
  }, [abierto]);

  if (decision === "no_categorizar") {
    return (
      <div className="pulso-preg-decision">
        {motivo ? <p className="pulso-preg-insp-ayuda">Motivo registrado: {motivo}</p> : null}
        <PulsoButton variant="secondary" size="sm" disabled={busy} onClick={onRevertir}>
          Volver a pendiente
        </PulsoButton>
      </div>
    );
  }

  // Solo se decide sobre lo que sigue abierto: una codificada no necesita esta salida y una sin respuestas ya se cerró sola.
  if (decision !== "pendiente" && decision !== "pendiente_parcial") return null;

  if (!abierto) {
    return (
      <div className="pulso-preg-decision">
        <PulsoButton variant="secondary" size="sm" disabled={busy} onClick={() => setAbierto(true)}>
          Registrar que no se codifica
        </PulsoButton>
      </div>
    );
  }

  const listo = texto.trim().length > 0;
  return (
    <div ref={caja} className="pulso-preg-decision" data-abierta="">
      <label className="pulso-preg-decision-rotulo" htmlFor={campo}>
        Motivo por el que no se codifica
      </label>
      <input
        id={campo}
        ref={entrada}
        className="pulso-input pulso-input--sm"
        value={texto}
        onChange={(evento) => setTexto(evento.target.value)}
        onKeyDown={(evento) => {
          if (evento.key === "Enter" && listo) onRegistrar(texto.trim());
          if (evento.key === "Escape") setAbierto(false);
        }}
      />
      <div className="pulso-preg-decision-acciones">
        <PulsoButton variant="primary" size="sm" disabled={!listo || busy} onClick={() => onRegistrar(texto.trim())}>
          Registrar
        </PulsoButton>
        <PulsoButton variant="ghost" size="sm" disabled={busy} onClick={() => setAbierto(false)}>
          Cancelar
        </PulsoButton>
      </div>
    </div>
  );
}
