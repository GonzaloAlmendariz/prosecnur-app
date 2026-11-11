// Elegir una variable a cruzar: el select del kit (PulsoSelect), que abre su
// lista en un portal y no queda recortada por el cuerpo con scroll que lo
// contiene. Cada opción se lee por su pregunta, con el nombre de la variable y
// el tipo en castellano como datos secundarios; se escribe para buscar.
// Elegir agrega la variable: el select no guarda una elección propia. En su
// forma corta (junto a los chips de las variables de cruce) se lee "Añadir".

import type { VariableInstrumento } from "../../../api/analitica";
import { PulsoSelect, type PulsoSelectOption } from "../../../components/PulsoSelect";
import { Plus } from "../../../vendor/lucide-react";
import { tipoDeVariable } from "./crucesModelo";

export function ElegirVariableACruzar({ variables, rotulo, corto = false, onElegir }: {
  /** Las que se pueden agregar: de selección única o múltiple y todavía no elegidas. */
  variables: readonly VariableInstrumento[];
  /** El nombre del control y, en su forma larga, el texto que muestra cerrado. */
  rotulo: string;
  /** Muestra "Añadir" en el renglón de los chips; el nombre del control sigue siendo `rotulo`. */
  corto?: boolean;
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
    <div className="cruces-elegir" data-corto={corto ? "" : undefined}>
      <PulsoSelect
        ariaLabel={rotulo}
        placeholder={corto ? <span className="cruces-elegir-corto"><Plus size={13} aria-hidden="true" /> Añadir</span> : rotulo}
        size={corto ? "sm" : undefined}
        value=""
        options={opciones}
        disabled={opciones.length === 0}
        onValueChange={(v) => { if (v) onElegir(v); }}
      />
    </div>
  );
}
