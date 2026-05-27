// =============================================================================
// inspector/logic/LogicGroupBlock.tsx — bloque AND/OR de condiciones
// =============================================================================
// Renderiza una serie de condiciones unidas por un mismo conector AND u
// OR. Permite:
//   - Cambiar el conector (toggle AND/OR).
//   - Agregar una condición al bloque ("+ condición").
//   - Quitar una condición.
//   - Negar el bloque entero (envuelve en `not(...)`).
//
// En F2-2 nos limitamos a un nivel plano (todas las condiciones bajo el
// mismo conector). El AND/OR mixto y la negación parcial entran en F2-3.
// =============================================================================

import { Plus } from "lucide-react";
import type { FlatCondition, LogicScope } from "../../logic";
import { ConditionRow } from "./ConditionRow";

export type LogicGroupBlockProps = {
  scope: LogicScope;
  /** Conector usado entre condiciones. */
  connector: "and" | "or";
  onChangeConnector: (next: "and" | "or") => void;
  /** Lista de condiciones. */
  conditions: FlatCondition[];
  onChangeConditions: (next: FlatCondition[]) => void;
  /** Etiqueta humana del campo (ej. "Cuándo aparece"). */
  fieldLabel: string;
  /** Constructor de una condición default cuando se agrega una nueva. */
  buildEmptyCondition: () => FlatCondition;
};

export function LogicGroupBlock({
  scope,
  connector,
  onChangeConnector,
  conditions,
  onChangeConditions,
  fieldLabel,
  buildEmptyCondition,
}: LogicGroupBlockProps) {
  const updateAt = (index: number, next: FlatCondition) => {
    const copy = [...conditions];
    copy[index] = next;
    onChangeConditions(copy);
  };
  const removeAt = (index: number) => {
    onChangeConditions(conditions.filter((_, i) => i !== index));
  };
  const add = () => {
    onChangeConditions([...conditions, buildEmptyCondition()]);
  };
  const connectorSummary =
    connector === "and"
      ? "Todas estas reglas deben cumplirse para mostrar la pieza."
      : "Basta con que una de estas reglas se cumpla para mostrar la pieza.";

  return (
    <div className="pulso-logic-group">
      <header className="pulso-logic-group-header">
        <div className="pulso-logic-group-copy">
          <span className="pulso-logic-group-prompt">{fieldLabel}</span>
          <p>{connectorSummary}</p>
        </div>
        {conditions.length > 1 && (
          <span
            className="pulso-logic-group-connector"
            role="radiogroup"
            aria-label="Conector entre condiciones"
          >
            <button
              type="button"
              role="radio"
              aria-checked={connector === "and"}
              className={connector === "and" ? "is-on" : ""}
              onClick={() => onChangeConnector("and")}
              title="Todas las condiciones deben cumplirse"
            >
              Todas
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={connector === "or"}
              className={connector === "or" ? "is-on" : ""}
              onClick={() => onChangeConnector("or")}
              title="Cualquiera de las condiciones basta"
            >
              Alguna
            </button>
          </span>
        )}
      </header>

      <div className="pulso-logic-group-body">
        {conditions.map((cond, idx) => (
          <div className="pulso-logic-group-item" key={idx}>
            {idx > 0 && (
              <span className="pulso-logic-group-sep" aria-hidden="true">
                {connector === "and" ? "y" : "o"}
              </span>
            )}
            <ConditionRow
              scope={scope}
              condition={cond}
              onChange={(next) => updateAt(idx, next)}
              onRemove={conditions.length > 1 ? () => removeAt(idx) : undefined}
            />
          </div>
        ))}
      </div>

      <footer className="pulso-logic-group-footer">
        <button
          type="button"
          className="pulso-logic-group-add"
          onClick={add}
          disabled={!scope.variables.length}
        >
          <Plus size={12} /> Agregar condición
        </button>
      </footer>
    </div>
  );
}
