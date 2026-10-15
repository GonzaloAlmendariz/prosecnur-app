// F5: «Confirmar las N de misma escala». Con N = 0 no hay nada que confirmar y
// el botón no se pinta: la barra conserva su marco con el resumen.

import { CheckCircle2 } from "../../vendor/lucide-react";
import { PulsoButton } from "../../components/PulsoButton";
import { textoConfirmarMismaEscala } from "./mismaEscalaModel";

export type ConfirmarMismaEscalaBotonProps = {
  n: number;
  ocupado: boolean;
  disabled: boolean;
  onConfirmar: () => void;
};

export function ConfirmarMismaEscalaBoton({ n, ocupado, disabled, onConfirmar }: ConfirmarMismaEscalaBotonProps) {
  if (n === 0) return null;
  return (
    <PulsoButton
      variant="secondary"
      size="sm"
      className="pulso-equiv-btn"
      disabled={disabled}
      title="Las declara armonizadas con la lista de respuestas que ya comparten, sin recodificar. Entran a los comparativos."
      onClick={onConfirmar}
    >
      <CheckCircle2 size={13} aria-hidden="true" />
      {ocupado ? "Confirmando…" : textoConfirmarMismaEscala(n)}
    </PulsoButton>
  );
}
