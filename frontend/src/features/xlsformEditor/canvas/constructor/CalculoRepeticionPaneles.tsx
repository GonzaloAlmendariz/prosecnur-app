// Paneles de cálculo (calculation) y de repeticiones (repeat_count) del Constructor.
// Extraído de constructor/TabRespuesta.tsx — refactor puro, revamp 2026-10-16.

import { useEffect, useState } from "react";
import { Calculator, Repeat, Trash2 } from "lucide-react";
import type { BuilderNode } from "../../types";
import { type LogicScope } from "../../logic";
import { InspectorField } from "../../inspector/InspectorPrimitives";
import { variableDisplayLabel } from "../constructor/compartido";

export function CalculationRecipePanel({
  expression,
  scope,
  onFieldChange,
}: {
  expression: string;
  scope: LogicScope;
  onFieldChange: (field: string, value: string) => void;
}) {
  const variables = scope.variables.filter((variable) => variable.name.trim().length > 0);
  const multiVariables = variables.filter((variable) => variable.baseType === "select_multiple");
  const numericVariables = variables.filter(
    (variable) => variable.baseType === "integer" || variable.baseType === "decimal",
  );
  const variableOptionsKey = variables.map((variable) => variable.name).join("\u0000");
  const multiOptionsKey = multiVariables.map((variable) => variable.name).join("\u0000");
  const numericOptionsKey = numericVariables.map((variable) => variable.name).join("\u0000");
  const [copyVariable, setCopyVariable] = useState(variables[0]?.name ?? "");
  const [multiVariable, setMultiVariable] = useState(multiVariables[0]?.name ?? "");
  const [numericVariable, setNumericVariable] = useState(numericVariables[0]?.name ?? "");
  const hasExpression = expression.trim().length > 0;

  useEffect(() => {
    setCopyVariable((current) => {
      if (current && variables.some((variable) => variable.name === current)) return current;
      return variables[0]?.name ?? "";
    });
  }, [variableOptionsKey]);

  useEffect(() => {
    setMultiVariable((current) => {
      if (current && multiVariables.some((variable) => variable.name === current)) return current;
      return multiVariables[0]?.name ?? "";
    });
  }, [multiOptionsKey]);

  useEffect(() => {
    setNumericVariable((current) => {
      if (current && numericVariables.some((variable) => variable.name === current)) return current;
      return numericVariables[0]?.name ?? "";
    });
  }, [numericOptionsKey]);

  const applyFormula = (formula: string) => onFieldChange("calculation", formula);
  if (hasExpression) return null;

  return (
    <div className="pulso-focus-calculation-recipes" aria-label="Recetas rápidas de cálculo">
      <div className="pulso-focus-calculation-recipes-head">
        <span className="pulso-focus-calculation-recipes-icon" aria-hidden="true">
          <Calculator size={14} />
        </span>
        <div>
          <span className="pulso-section-eyebrow">Cálculo Kobo</span>
          <strong>Recetas frecuentes sin escribir fórmula desde cero</strong>
          <p>Aplican una fórmula XLSForm válida y dejan el editor avanzado disponible para ajustes finos.</p>
        </div>
      </div>

      <div className="pulso-focus-calculation-recipe-grid">
        <button
          type="button"
          className="pulso-focus-calculation-recipe"
          onClick={() => applyFormula("today()")}
        >
          <span>
            <strong>Fecha de hoy</strong>
            <small>Guarda la fecha del dispositivo al abrir el formulario.</small>
          </span>
          <code>today()</code>
        </button>
        <button
          type="button"
          className="pulso-focus-calculation-recipe"
          onClick={() => applyFormula("now()")}
        >
          <span>
            <strong>Momento actual</strong>
            <small>Guarda fecha y hora del dispositivo.</small>
          </span>
          <code>now()</code>
        </button>

        {variables.length > 0 && (
          <div className="pulso-focus-calculation-recipe is-builder">
            <span>
              <strong>Copiar una respuesta</strong>
              <small>Útil para conservar una versión calculada o normalizada.</small>
            </span>
            <div className="pulso-focus-calculation-recipe-row">
              <select value={copyVariable} onChange={(event) => setCopyVariable(event.target.value)}>
                {variables.map((variable) => (
                  <option key={variable.name} value={variable.name}>
                    {variableDisplayLabel(variable)}
                  </option>
                ))}
              </select>
              <button type="button" onClick={() => copyVariable && applyFormula(`\${${copyVariable}}`)}>
                Usar
              </button>
            </div>
          </div>
        )}

        {multiVariables.length > 0 && (
          <div className="pulso-focus-calculation-recipe is-builder">
            <span>
              <strong>Contar opciones marcadas</strong>
              <small>Para preguntas de selección múltiple.</small>
            </span>
            <div className="pulso-focus-calculation-recipe-row">
              <select value={multiVariable} onChange={(event) => setMultiVariable(event.target.value)}>
                {multiVariables.map((variable) => (
                  <option key={variable.name} value={variable.name}>
                    {variableDisplayLabel(variable)}
                  </option>
                ))}
              </select>
              <button type="button" onClick={() => multiVariable && applyFormula(`count-selected(\${${multiVariable}})`)}>
                Contar
              </button>
            </div>
          </div>
        )}

        {numericVariables.length > 0 && (
          <div className="pulso-focus-calculation-recipe is-builder">
            <span>
              <strong>Convertir años a meses</strong>
              <small>Multiplica una edad, antigüedad o duración numérica por 12.</small>
            </span>
            <div className="pulso-focus-calculation-recipe-row">
              <select value={numericVariable} onChange={(event) => setNumericVariable(event.target.value)}>
                {numericVariables.map((variable) => (
                  <option key={variable.name} value={variable.name}>
                    {variableDisplayLabel(variable)}
                  </option>
                ))}
              </select>
              <button type="button" onClick={() => numericVariable && applyFormula(`\${${numericVariable}} * 12`)}>
                Aplicar
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export function RepeatCountPanel({
  node,
  scope,
  onFieldChange,
}: {
  node: BuilderNode;
  scope: LogicScope;
  onFieldChange: (field: string, value: string) => void;
}) {
  const value = node.repeat_count ?? "";
  const trimmed = value.trim();
  const variables = scope.variables.filter(
    (variable) =>
      variable.name.trim().length > 0 &&
      ["integer", "decimal", "calculate"].includes(variable.baseType) &&
      (typeof variable.rowIndex !== "number" || variable.rowIndex < node.rowIndex),
  );
  const variableOptionsKey = variables.map((variable) => variable.name).join("\u0000");
  const [fixedCount, setFixedCount] = useState(isPositiveInteger(trimmed) ? trimmed : "");
  const [selectedVariable, setSelectedVariable] = useState(variables[0]?.name ?? "");
  const status = describeRepeatCount(trimmed, variables);

  useEffect(() => {
    setFixedCount(isPositiveInteger(trimmed) ? trimmed : "");
  }, [trimmed]);

  useEffect(() => {
    setSelectedVariable((current) => {
      if (current && variables.some((variable) => variable.name === current)) return current;
      return variables[0]?.name ?? "";
    });
  }, [variableOptionsKey]);

  const applyFixedCount = () => {
    const next = fixedCount.trim();
    if (!isPositiveInteger(next)) return;
    onFieldChange("repeat_count", next);
  };

  const applyVariable = () => {
    if (!selectedVariable) return;
    onFieldChange("repeat_count", `\${${selectedVariable}}`);
  };

  return (
    <div className={`pulso-focus-repeat-panel ${trimmed ? "is-active" : "is-empty"} ${status.tone === "warn" ? "is-warning" : ""}`}>
      <div className="pulso-focus-repeat-head">
        <span className="pulso-focus-repeat-icon" aria-hidden="true">
          <Repeat size={14} />
        </span>
        <div>
          <span className="pulso-section-eyebrow">Repeticiones Kobo</span>
          <strong>{status.title}</strong>
          <p>{status.detail}</p>
        </div>
        {trimmed && (
          <button
            type="button"
            className="pulso-focus-repeat-clear-icon"
            onClick={() => onFieldChange("repeat_count", "")}
            aria-label="Quitar límite de repeticiones"
            title="Quitar límite"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>

      <div className="pulso-focus-repeat-builder" aria-label="Constructor de cantidad de repeticiones">
        <label className="pulso-focus-repeat-fixed">
          <span>Número fijo</span>
          <div>
            <input
              type="number"
              min="1"
              step="1"
              value={fixedCount}
              onChange={(event) => setFixedCount(event.target.value)}
              placeholder="Ej. 5"
            />
            <button type="button" onClick={applyFixedCount} disabled={!isPositiveInteger(fixedCount)}>
              Aplicar
            </button>
          </div>
        </label>

        <label className="pulso-focus-repeat-variable">
          <span>Según respuesta previa</span>
          <div>
            <select
              value={selectedVariable}
              onChange={(event) => setSelectedVariable(event.target.value)}
              disabled={variables.length === 0}
            >
              {variables.length === 0 ? (
                <option value="">Sin variables numéricas</option>
              ) : (
                variables.map((variable) => (
                  <option key={variable.name} value={variable.name}>
                    {variableDisplayLabel(variable)}
                  </option>
                ))
              )}
            </select>
            <button type="button" onClick={applyVariable} disabled={!selectedVariable}>
              Usar
            </button>
          </div>
        </label>
      </div>

      <InspectorField
        label="Regla guardada"
        hint="Vacío = el encuestador decide cuántas veces repetir. También puedes pegar una fórmula XLSForm."
      >
        {(campo) => (
          <input
            id={campo.id}
            aria-describedby={campo.hintId}
            type="text"
            value={value}
            onChange={(event) => onFieldChange("repeat_count", event.target.value)}
            placeholder='Ej. 5 o ${num_personas}'
            spellCheck={false}
            className="pulso-focus-repeat-formula"
          />
        )}
      </InspectorField>
    </div>
  );
}

export function describeRepeatCount(
  value: string,
  variables: LogicScope["variables"],
): { tone: "empty" | "ok" | "warn"; title: string; detail: string } {
  if (!value) {
    return {
      tone: "empty",
      title: "Cantidad decidida en campo",
      detail: "Kobo preguntará al encuestador si desea agregar otra repetición.",
    };
  }
  if (isPositiveInteger(value)) {
    return {
      tone: "ok",
      title: `${value} ${value === "1" ? "repetición fija" : "repeticiones fijas"}`,
      detail: "El bloque se abrirá esa cantidad de veces.",
    };
  }
  const variable = simpleVariableReference(value);
  if (variable) {
    const match = variables.find((candidate) => candidate.name === variable);
    return {
      tone: match ? "ok" : "warn",
      title: match ? "Controlada por una respuesta" : "Referencia por revisar",
      detail: match
        ? `La cantidad sale de ${variableDisplayLabel(match)}.`
        : `No encuentro ${value} entre las variables actuales del formulario.`,
    };
  }
  return {
    tone: "warn",
    title: "Fórmula avanzada",
    detail: "Se preserva como repeat_count; confirma que devuelve un número entero positivo.",
  };
}

export function isPositiveInteger(value: string): boolean {
  return /^[1-9]\d*$/.test(value.trim());
}

export function simpleVariableReference(value: string): string | null {
  const match = /^\$\{([^}]+)\}$/.exec(value.trim());
  return match?.[1]?.trim() || null;
}
