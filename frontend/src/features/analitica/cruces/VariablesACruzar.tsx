// Las variables a cruzar: cada una define las columnas de las tablas. Por
// variable, su pregunta, el botón de quitarla y sus categorías, con las
// excluidas tachadas. Debajo, el selector que agrega otra.

import { useMemo } from "react";

import type { VariableInstrumento } from "../../../api/analitica";
import { PulsoButton } from "../../../components/PulsoButton";
import { X } from "../../../vendor/lucide-react";
import type { CruceVarConfig } from "../store";
import { CategoriasDeCruce } from "./CategoriasDeCruce";
import { ElegirVariableACruzar } from "./ElegirVariableACruzar";

export function VariablesACruzar({ elegidas, cruzables, etiquetasDeCategorias, onAgregar, onQuitar, onExcluidas }: {
  elegidas: readonly CruceVarConfig[];
  /** Las variables del formulario que pueden ser variable de cruce (selección única o múltiple). */
  cruzables: readonly VariableInstrumento[];
  /** Por variable de cruce, el rótulo de cada categoría por su código, de las columnas de la vista previa. */
  etiquetasDeCategorias: ReadonlyMap<string, ReadonlyMap<string, string>>;
  onAgregar: (variable: string) => void;
  onQuitar: (variable: string) => void;
  onExcluidas: (variable: string, excluidas: string[]) => void;
}) {
  const porNombre = useMemo(() => new Map(cruzables.map((v) => [v.name, v])), [cruzables]);
  const disponibles = useMemo(
    () => cruzables.filter((v) => !elegidas.some((e) => e.name === v.name)),
    [cruzables, elegidas],
  );

  return (
    <div className="cruces-variables">
      {/* Sin variables, el vacío lo dice la vista previa, con su propia acción: aquí queda el botón. */}
      {elegidas.length === 0 ? null : (
        <ul className="cruces-variables-lista" aria-label="Variables a cruzar" data-qa-geometry-group="analitica/cruces-variables" data-qa-geometry-contract="intrinsic">
          {elegidas.map((e) => {
            const etiqueta = porNombre.get(e.name)?.label?.trim() || e.name;
            return (
              <li key={e.name} className="cruces-variable-de-cruce">
                <div className="cruces-variable-cabecera">
                  <span className="cruces-variable-nombre">
                    <span className="cruces-variable-etiqueta">{etiqueta}</span>
                    {etiqueta !== e.name ? <code className="tablas-codigo">{e.name}</code> : null}
                  </span>
                  <PulsoButton variant="icon" size="sm" intent="remove" aria-label={`Quitar ${etiqueta}`} onClick={() => onQuitar(e.name)}>
                    <X size={14} aria-hidden="true" />
                  </PulsoButton>
                </div>
                <CategoriasDeCruce
                  variable={e.name}
                  etiqueta={etiqueta}
                  excluidas={e.excluidas ?? []}
                  etiquetas={etiquetasDeCategorias.get(e.name)}
                  onCambio={(excluidas) => onExcluidas(e.name, excluidas)}
                />
              </li>
            );
          })}
        </ul>
      )}
      {/* La consecuencia de excluir no se ve hasta releer: se dice una vez. */}
      {elegidas.length > 0 ? <p className="tablas-nota">Excluir una categoría quita sus casos de todas las tablas, también del Total.</p> : null}

      <ElegirVariableACruzar variables={disponibles} rotulo="Añadir variable a cruzar" onElegir={onAgregar} />
    </div>
  );
}
