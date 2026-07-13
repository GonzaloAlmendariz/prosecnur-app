// =============================================================================
// inspector/logic/ValueInput.tsx — input de valor adaptado al tipo
// =============================================================================
// El lado derecho de una condición puede ser:
//   - Un literal (string/number/date/choice).
//   - Una referencia a otra variable (cuando el usuario quiere comparar
//     dos preguntas entre sí, ej. ${edad_actual} > ${edad_min}).
//
// Este componente decide qué control mostrar según el tipo de la variable
// del lhs:
//   - select_one/multiple → dropdown con las choices del catálogo.
//   - integer/decimal → input number.
//   - date/datetime → input date.
//   - text/otros → input text.
// Hay un toggle "Usar otra pregunta" que conmuta entre literal y ref.
// =============================================================================

import type { FlatCondition, LogicCatalog, LogicVariable } from "../../logic";
import { VariablePicker } from "./VariablePicker";

export type ValueInputProps = {
  /** Tipo base de la variable del lhs (determina el control). */
  baseType: string;
  /** Catálogo asociado si el tipo es select_one/multiple. */
  catalog?: LogicCatalog;
  /** Variables disponibles para el modo "ref a otra variable". */
  variables: LogicVariable[];
  /** Valor actual del rhs. */
  value: FlatCondition["value"];
  onChange: (next: FlatCondition["value"]) => void;
  disabled?: boolean;
};

export function ValueInput({
  baseType,
  catalog,
  variables,
  value,
  onChange,
  disabled,
}: ValueInputProps) {
  const isRef = value.kind === "ref";

  const setLiteral = () => {
    if (!isRef) return;
    onChange({ kind: "literal", raw: "" });
  };
  const setRef = () => {
    if (isRef) return;
    onChange({ kind: "ref", variableName: variables[0]?.name ?? "" });
  };

  return (
    <div className="pulso-logic-valueinput">
      {/* Toggle con TEXTO en vez del críptico icono "<>". Deja claro si el
          lado derecho es un valor escrito o una comparación con otra
          pregunta del formulario. */}
      <div className="pulso-logic-valuemode" role="group" aria-label="Comparar contra">
        <button
          type="button"
          className={`pulso-logic-valuemode-opt${!isRef ? " is-on" : ""}`}
          onClick={setLiteral}
          disabled={disabled}
          aria-pressed={!isRef}
          title="Comparar contra un valor escrito"
        >
          Valor
        </button>
        <button
          type="button"
          className={`pulso-logic-valuemode-opt${isRef ? " is-on" : ""}`}
          onClick={setRef}
          disabled={disabled || variables.length === 0}
          aria-pressed={isRef}
          title="Comparar contra la respuesta de otra pregunta"
        >
          Pregunta
        </button>
      </div>
      <div className="pulso-logic-valueinput-control">
        {isRef ? (
          <VariablePicker
            variables={variables}
            selected={value.variableName}
            onChange={(next) => onChange({ kind: "ref", variableName: next })}
            placeholder="Otra pregunta…"
            disabled={disabled}
          />
        ) : (
          <LiteralControl
            baseType={baseType}
            catalog={catalog}
            raw={value.raw}
            onChange={(raw) => onChange({ kind: "literal", raw })}
            disabled={disabled}
          />
        )}
      </div>
    </div>
  );
}

function LiteralControl({
  baseType,
  catalog,
  raw,
  onChange,
  disabled,
}: {
  baseType: string;
  catalog?: LogicCatalog;
  raw: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  // select_one/multiple → dropdown con choices.
  if ((baseType === "select_one" || baseType === "select_multiple") && catalog) {
    const hasRawChoice = raw === "" || catalog.items.some((it) => it.name === raw);
    return (
      <select
        className="pulso-logic-valueinput-select"
        value={raw}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      >
        <option value="">Elige opción…</option>
        {!hasRawChoice && (
          <option value={raw}>{raw} (sin opción en catálogo)</option>
        )}
        {catalog.items.map((it) => (
          <option key={`${it.rowIndex}-${it.name}`} value={it.name}>
            {it.label || it.name}
          </option>
        ))}
      </select>
    );
  }

  // Numéricos → input number.
  if (baseType === "integer") {
    return (
      <input
        type="number"
        step="1"
        className="pulso-logic-valueinput-number"
        value={raw}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        placeholder="0"
      />
    );
  }
  if (baseType === "decimal") {
    return (
      <input
        type="number"
        step="any"
        className="pulso-logic-valueinput-number"
        value={raw}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        placeholder="0.0"
      />
    );
  }

  // Fechas.
  if (baseType === "date") {
    return (
      <input
        type="date"
        className="pulso-logic-valueinput-date"
        value={raw}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      />
    );
  }
  if (baseType === "datetime") {
    return (
      <input
        type="datetime-local"
        className="pulso-logic-valueinput-date"
        value={raw}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      />
    );
  }
  if (baseType === "time") {
    return (
      <input
        type="time"
        className="pulso-logic-valueinput-date"
        value={raw}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      />
    );
  }

  // Default → text.
  return (
    <input
      type="text"
      className="pulso-logic-valueinput-text"
      value={raw}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      placeholder="Valor"
      spellCheck={false}
    />
  );
}
