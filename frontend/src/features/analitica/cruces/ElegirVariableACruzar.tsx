// Elegir una variable a cruzar: el select del kit (PulsoSelect), que abre su
// lista en un portal y no queda recortada por el cuerpo con scroll que lo
// contiene. Cada opción se lee por su pregunta, con el nombre de la variable y
// el tipo en castellano como datos secundarios; se escribe para buscar.
// Elegir agrega la variable: el select no guarda una elección propia.

import type { VariableInstrumento } from "../../../api/analitica";
import { PulsoSelect, type PulsoSelectOption } from "../../../components/PulsoSelect";
import { tipoDeVariable } from "./crucesModelo";

export function ElegirVariableACruzar({ variables, rotulo, onElegir }: {
  /** Las que se pueden agregar: de selección única o múltiple y todavía no elegidas. */
  variables: readonly VariableInstrumento[];
  /** El nombre del control y el texto que muestra cerrado. */
  rotulo: string;
  onElegir: (variable: string) => void;
}) {
  const opciones: PulsoSelectOption[] = variables.map((v) => {
    const pregunta = v.label?.trim() || v.name;
    const tipo = tipoDeVariable(v.tipo);
    return {
      value: v.name,
      textValue: `${pregunta} ${v.name}`,
      label: (
        <span className="cruces-opcion">
          <span className="cruces-opcion-pregunta">{pregunta}</span>
          <span className="cruces-opcion-datos">
            {pregunta !== v.name ? <code className="tablas-codigo">{v.name}</code> : null}
            {tipo ? <span>{tipo}</span> : null}
          </span>
        </span>
      ),
    };
  });
  return (
    <div className="cruces-elegir">
      <PulsoSelect
        ariaLabel={rotulo}
        placeholder={rotulo}
        value=""
        options={opciones}
        disabled={opciones.length === 0}
        onValueChange={(v) => { if (v) onElegir(v); }}
      />
    </div>
  );
}
