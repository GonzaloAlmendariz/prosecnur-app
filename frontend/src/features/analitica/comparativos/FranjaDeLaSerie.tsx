// La franja de la serie (prototipo, `pp-relacion`): cuántas bases se comparan y
// dónde se declaran sus preguntas. La app no supone si la serie es de años o de
// públicos (`nombreDeSerie`): las nombra siempre bases.

import { useNavigate } from "react-router-dom";

import { Panel } from "../../../components/Panel";
import { PulsoButton } from "../../../components/PulsoButton";
import { formatoConteo } from "../../../lib/formatoNumero";
import { GitCompare, Split } from "../../../vendor/lucide-react";
import { DIRECCION_EQUIVALENCIAS } from "../panes/comparativosModel";

export function FranjaDeLaSerie({ nBases }: { nBases: number }) {
  const navegar = useNavigate();
  return (
    <Panel noPadding className="comparativos-serie" aria-label="Serie de bases">
      <div className="comparativos-serie-linea">
        <Split size={16} aria-hidden="true" />
        <b>Serie de {formatoConteo(nBases)} bases</b>
        <span>Se comparan por las preguntas declaradas en Equivalencias.</span>
        <PulsoButton variant="secondary" size="sm" onClick={() => navegar(DIRECCION_EQUIVALENCIAS)}>
          <GitCompare size={14} aria-hidden="true" /> Ir a Equivalencias
        </PulsoButton>
      </div>
    </Panel>
  );
}
