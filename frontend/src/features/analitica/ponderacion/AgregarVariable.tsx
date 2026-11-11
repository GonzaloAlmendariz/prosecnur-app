// Agregar una variable: el botón punteado abre el selector en su lugar. El
// punteado es de lo que se agrega; ningún otro bloque de la pestaña lo usa.

import { useState } from "react";

import type { VariableInstrumento } from "../../../api/client";
import { PulsoButton } from "../../../components/PulsoButton";
import { Plus } from "../../../vendor/lucide-react";
import { VariableSelect } from "../VariableSelect";

export function AgregarVariable({ variables, rotulo, onElegir }: {
  variables: VariableInstrumento[];
  rotulo: string;
  onElegir: (nombre: string) => void;
}) {
  const [eligiendo, setEligiendo] = useState(false);
  if (!eligiendo) {
    return (
      <PulsoButton variant="secondary" className="pond-agregar" onClick={() => setEligiendo(true)}>
        <Plus size={14} aria-hidden="true" /> {rotulo}
      </PulsoButton>
    );
  }
  return (
    <div className="pond-agregar-selector">
      <VariableSelect
        variables={variables}
        value=""
        placeholder="Variable categórica"
        onChange={(nombre) => { if (nombre) onElegir(nombre); setEligiendo(false); }}
      />
      <PulsoButton variant="secondary" onClick={() => setEligiendo(false)}>Cancelar</PulsoButton>
    </div>
  );
}
