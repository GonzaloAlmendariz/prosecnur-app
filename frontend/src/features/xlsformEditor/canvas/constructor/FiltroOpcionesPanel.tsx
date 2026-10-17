// Filtro de opciones (choice_filter) del Constructor: lectura, sugerencias y edición.
// Extraído de constructor/TabReglas.tsx — refactor puro, revamp 2026-10-16.

import { useEffect, useState } from "react";
import { CheckCircle2, Info, Trash2 } from "lucide-react";
import { IconConditionalLogic } from "../../../../lib/icons";
import type { BuilderNode } from "../../types";
import { type LogicScope } from "../../logic";
import { stripMarkdown } from "../../helpers/markdown";
import { InspectorField } from "../../inspector/InspectorPrimitives";
import { variableLabel } from "../reglasHumanas";
import { variableDisplayLabel } from "../constructor/compartido";

export function ChoiceFilterPanel({
  node,
  scope,
  choiceColumns,
  onFieldChange,
}: {
  node: BuilderNode;
  scope: LogicScope;
  choiceColumns: string[];
  onFieldChange: (field: string, value: string) => void;
}) {
  const currentFilter = node.choiceFilter ?? "";
  const hasFilter = currentFilter.trim().length > 0;
  const variables = scope.variables.filter((variable) => variable.name.trim().length > 0);
  const priorVariables = variables.filter(
    (variable) => variable.rowIndex == null || variable.rowIndex < node.rowIndex,
  );
  const controllingVariables = priorVariables.length > 0 ? priorVariables : variables;
  const [draftColumn, setDraftColumn] = useState(choiceColumns[0] ?? "");
  const [draftVariable, setDraftVariable] = useState(controllingVariables[0]?.name ?? "");
  const variableOptionsKey = controllingVariables.map((variable) => variable.name).join("\u0000");
  const columnOptionsKey = choiceColumns.join("\u0000");
  const status = describeChoiceFilter(currentFilter, scope, choiceColumns);
  const selectedVariable = controllingVariables.find((variable) => variable.name === draftVariable);
  const simpleFilter = parseSimpleChoiceFilter(currentFilter);
  const filterHasComparison = /(?:!=|<=|>=|=|<|>\b|\bselected\s*\()/i.test(currentFilter);
  const suggestions = buildChoiceFilterSuggestions(node, choiceColumns, controllingVariables, currentFilter);
  const checks = [
    {
      key: "columns",
      label: choiceColumns.length > 0 ? "Columnas en choices" : "Añade columnas en choices",
      ok: choiceColumns.length > 0,
    },
    {
      key: "variable",
      label: controllingVariables.length > 0 ? "Respuesta previa" : "Falta respuesta previa",
      ok: controllingVariables.length > 0,
    },
    {
      key: "comparison",
      label: hasFilter ? "Regla comparativa" : "Sin filtro aplicado",
      ok: hasFilter && filterHasComparison,
    },
    {
      key: "column",
      label: simpleFilter?.column ? `Columna ${simpleFilter.column}` : "Columna por definir",
      ok: Boolean(simpleFilter?.column && (!choiceColumns.length || choiceColumns.includes(simpleFilter.column))),
    },
  ];
  const canApplyTemplate = draftColumn.trim().length > 0 && draftVariable.trim().length > 0;
  const datalistId = `pulso-choice-filter-columns-${node.rowIndex}`;

  useEffect(() => {
    setDraftColumn((current) => {
      if (current.trim() && (!choiceColumns.length || choiceColumns.includes(current))) return current;
      return choiceColumns[0] ?? "";
    });
  }, [columnOptionsKey]);

  useEffect(() => {
    setDraftVariable((current) => {
      if (current && controllingVariables.some((variable) => variable.name === current)) return current;
      return controllingVariables[0]?.name ?? "";
    });
  }, [variableOptionsKey]);

  const applyTemplate = () => {
    const column = draftColumn.trim();
    const variable = draftVariable.trim();
    if (!column || !variable) return;
    onFieldChange("choice_filter", `${column}=\${${variable}}`);
  };

  const applySuggestion = (expression: string) => {
    onFieldChange("choice_filter", expression);
    const suggestion = parseSimpleChoiceFilter(expression);
    if (suggestion) {
      setDraftColumn(suggestion.column);
      setDraftVariable(suggestion.variable);
    }
  };

  const suggestionGrid = suggestions.length > 0 ? (
    <div className="pulso-focus-choice-filter-suggestion-grid">
      {suggestions.map((suggestion) => (
        <button
          key={suggestion.expression}
          type="button"
          className="pulso-focus-choice-filter-suggestion"
          onClick={() => applySuggestion(suggestion.expression)}
          title={suggestion.detail}
        >
          <span>
            <strong>{suggestion.title}</strong>
            <small>{suggestion.detail}</small>
          </span>
          <code>{suggestion.expression}</code>
        </button>
      ))}
    </div>
  ) : null;

  const insertVariableReference = (variableName: string) => {
    const token = `\${${variableName}}`;
    const separator = currentFilter.trim().length > 0 && !currentFilter.endsWith(" ") ? " " : "";
    onFieldChange("choice_filter", `${currentFilter}${separator}${token}`);
  };

  return (
    <div className={`pulso-focus-choice-filter ${hasFilter ? "is-active" : "is-empty"} ${status.tone === "warn" ? "is-warning" : ""}`}>
      <div className="pulso-focus-choice-filter-head">
        <span className="pulso-focus-choice-filter-icon" aria-hidden="true">
          <IconConditionalLogic size={14} />
        </span>
        <div>
          <span className="pulso-section-eyebrow">Filtro de opciones</span>
          <strong>{hasFilter ? "Lista condicionada" : "Lista completa"}</strong>
          <p>
            {hasFilter
              ? status.detail
              : "Todas las opciones aparecen cuando la pregunta se muestra."}
          </p>
        </div>
        <code className="pulso-focus-choice-filter-code">choice_filter</code>
      </div>

      {/* El constructor de cascadas es denso y casi ningún instrumento lo usa:
          se pliega por defecto y solo se abre cuando ya hay un filtro. */}
      <details className="pulso-focus-choice-filter-body" open={hasFilter}>
        <summary>
          {hasFilter
            ? "Editar filtro de opciones"
            : "Filtrar opciones según una respuesta previa (cascada)"}
        </summary>

      <div className="pulso-focus-choice-filter-state">
        {status.tone === "ok" ? <CheckCircle2 size={14} /> : <Info size={14} />}
        <div>
          <strong>{status.title}</strong>
          <p>{status.detail}</p>
          {status.references.length > 0 && (
            <div className="pulso-focus-choice-filter-refs" aria-label="Variables usadas por el filtro">
              {status.references.map((variable) => (
                <span key={variable.name}>{variableDisplayLabel(variable)}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="pulso-focus-choice-filter-checks" aria-label="Revisión rápida del filtro de opciones">
        {checks.map((check) => (
          <span key={check.key} className={check.ok ? "is-ok" : "is-pending"}>
            {check.ok ? <CheckCircle2 size={11} /> : <Info size={11} />}
            {check.label}
          </span>
        ))}
      </div>

      {suggestionGrid && status.tone === "ok" ? (
        <details className="pulso-focus-choice-filter-suggestions pulso-focus-choice-filter-suggestions-compact">
          <summary>Cambiar por otra cascada sugerida</summary>
          {suggestionGrid}
        </details>
      ) : suggestionGrid ? (
        <div className="pulso-focus-choice-filter-suggestions" aria-label="Atajos sugeridos para filtros de opciones">
          <div className="pulso-focus-choice-filter-suggestions-head">
            <strong>Cascadas sugeridas</strong>
            <small>Atajos seguros desde columnas detectadas y respuestas previas.</small>
          </div>
          {suggestionGrid}
        </div>
      ) : null}

      <div className="pulso-focus-choice-filter-builder" aria-label="Constructor de filtro de opciones">
        <div className="pulso-focus-choice-filter-builder-head">
          <strong>Constructor rápido</strong>
          <small>Une una columna de la lista con una respuesta previa.</small>
        </div>
        <div className="pulso-focus-choice-filter-builder-row">
          <label>
            <span>Columna en choices</span>
            <input
              type="text"
              list={datalistId}
              value={draftColumn}
              onChange={(event) => setDraftColumn(event.target.value)}
              placeholder="Ej. region"
              spellCheck={false}
            />
            <datalist id={datalistId}>
              {choiceColumns.map((column) => (
                <option key={column} value={column} />
              ))}
            </datalist>
          </label>
          <label>
            <span>Respuesta que controla</span>
            <select
              value={draftVariable}
              onChange={(event) => setDraftVariable(event.target.value)}
              disabled={controllingVariables.length === 0}
            >
              {controllingVariables.length === 0 ? (
                <option value="">Sin variables disponibles</option>
              ) : (
                controllingVariables.map((variable) => (
                  <option key={variable.name} value={variable.name}>
                    {variableDisplayLabel(variable)}
                  </option>
                ))
              )}
            </select>
          </label>
          <button
            type="button"
            className="pulso-focus-choice-filter-apply"
            onClick={applyTemplate}
            disabled={!canApplyTemplate}
            title={selectedVariable ? `Usar ${selectedVariable.name}` : "Elige una variable"}
          >
            <IconConditionalLogic size={12} />
            Aplicar
          </button>
        </div>
        {choiceColumns.length > 0 && (
          <div className="pulso-focus-choice-filter-chips" aria-label="Columnas detectadas en choices">
            {choiceColumns.slice(0, 8).map((column) => (
              <button key={column} type="button" onClick={() => setDraftColumn(column)}>
                {column}
              </button>
            ))}
          </div>
        )}
      </div>

      <InspectorField
        label="Regla guardada"
        hint="Ej. region=${region}. La parte antes del igual debe existir como columna en choices."
      >
        {(campo) => (
          <textarea
            id={campo.id}
            aria-describedby={campo.hintId}
            value={currentFilter}
            onChange={(event) => onFieldChange("choice_filter", event.target.value)}
            placeholder="Ej. region=${region}"
            rows={2}
            spellCheck={false}
          />
        )}
      </InspectorField>

      <div className="pulso-focus-choice-filter-actions">
        <div className="pulso-focus-choice-filter-vars" aria-label="Insertar referencia a una respuesta">
          {controllingVariables.slice(0, 6).map((variable) => (
            <button
              key={variable.name}
              type="button"
              onClick={() => insertVariableReference(variable.name)}
              title={`Insertar ${variable.name}`}
            >
              ${`{${variable.name}}`}
            </button>
          ))}
        </div>
        {hasFilter && (
          <button
            type="button"
            className="pulso-inspector-logic-clear"
            onClick={() => onFieldChange("choice_filter", "")}
          >
            <Trash2 size={12} /> Quitar filtro
          </button>
        )}
      </div>
      </details>
    </div>
  );
}

export function describeChoiceFilter(
  expression: string,
  scope: LogicScope,
  choiceColumns: string[],
): {
  tone: "empty" | "ok" | "warn";
  title: string;
  detail: string;
  references: LogicScope["variables"];
} {
  const raw = expression.trim();
  if (!raw) {
    return {
      tone: "empty",
      title: "Sin filtro aplicado",
      detail: "Todas las opciones de la lista aparecen cuando la pregunta se muestra.",
      references: [],
    };
  }

  const variableNames = choiceFilterVariableNames(raw);
  const references = variableNames
    .map((name) => scope.variables.find((variable) => variable.name === name))
    .filter((variable): variable is LogicScope["variables"][number] => Boolean(variable));
  const missingVariables = variableNames.filter(
    (name) => !scope.variables.some((variable) => variable.name === name),
  );
  const simpleFilter = parseSimpleChoiceFilter(raw);
  const hasComparison = /(?:!=|<=|>=|=|<|>|\bselected\s*\()/i.test(raw);

  if (missingVariables.length > 0) {
    return {
      tone: "warn",
      title: "Revisa la referencia",
      detail: `No encuentro ${missingVariables.map((name) => `\${${name}}`).join(", ")} entre las variables actuales del formulario.`,
      references,
    };
  }

  if (!hasComparison) {
    return {
      tone: "warn",
      title: "Falta la comparación",
      detail: "Agrega la columna de la lista y el operador, por ejemplo region=${region}.",
      references,
    };
  }

  if (simpleFilter && choiceColumns.length > 0 && !choiceColumns.includes(simpleFilter.column)) {
    return {
      tone: "warn",
      title: "Columna no detectada",
      detail: `El filtro usa ${simpleFilter.column}; confirma que exista como columna adicional en la hoja choices.`,
      references,
    };
  }

  if (simpleFilter) {
    return {
      tone: "ok",
      title: "Filtro conectado",
      detail: `Kobo mostrará opciones donde ${simpleFilter.column} coincida con ${variableLabel(simpleFilter.variable, scope)}.`,
      references,
    };
  }

  return {
    tone: references.length > 0 ? "ok" : "warn",
    title: references.length > 0 ? "Filtro avanzado" : "Filtro técnico importado",
    detail:
      references.length > 0
        ? "La regla usa variables del formulario y se conservará al exportar."
        : "No detecté referencias ${variable}; conserva la fórmula si viene de un XLSForm probado.",
    references,
  };
}

export function choiceFilterVariableNames(expression: string): string[] {
  const names = new Set<string>();
  const regex = /\$\{([^}]+)\}/g;
  let match = regex.exec(expression);
  while (match) {
    const name = match[1]?.trim();
    if (name) names.add(name);
    match = regex.exec(expression);
  }
  return Array.from(names);
}

export function parseSimpleChoiceFilter(expression: string): { column: string; variable: string } | null {
  const match = /^([^\s=<>!()]+)\s*={1,2}\s*\$\{([^}]+)\}\s*$/.exec(expression.trim());
  if (!match) return null;
  const column = match[1] ?? "";
  const variable = (match[2] ?? "").trim();
  if (!column || !variable) return null;
  return { column, variable };
}

export type ChoiceFilterSuggestion = {
  title: string;
  detail: string;
  expression: string;
};

export function buildChoiceFilterSuggestions(
  node: BuilderNode,
  choiceColumns: string[],
  variables: LogicScope["variables"],
  currentFilter: string,
): ChoiceFilterSuggestion[] {
  if (choiceColumns.length === 0 || variables.length === 0) return [];
  const current = currentFilter.trim();
  const scored: Array<ChoiceFilterSuggestion & { score: number }> = [];

  choiceColumns.forEach((column) => {
    variables.forEach((variable) => {
      const expression = `${column}=\${${variable.name}}`;
      if (expression === current) return;
      const score = scoreChoiceFilterPair(column, variable, node);
      if (score <= 0) return;
      scored.push({
        score,
        expression,
        title: `${column} coincide con ${variable.name}`,
        detail: `Muestra opciones donde ${column} sea igual a ${variableDisplayLabel(variable)}.`,
      });
    });
  });

  scored.sort((a, b) => b.score - a.score || a.expression.localeCompare(b.expression));
  const unique = new Map<string, ChoiceFilterSuggestion>();
  scored.forEach(({ score: _score, ...suggestion }) => {
    if (!unique.has(suggestion.expression)) unique.set(suggestion.expression, suggestion);
  });
  return [...unique.values()].slice(0, 3);
}

export function scoreChoiceFilterPair(
  column: string,
  variable: LogicScope["variables"][number],
  node: BuilderNode,
): number {
  const col = normalizeChoiceFilterToken(column);
  const name = normalizeChoiceFilterToken(variable.name);
  const listName = normalizeChoiceFilterToken(variable.listName ?? "");
  const label = normalizeChoiceFilterToken(variable.label);
  if (!col || !name) return 0;

  let score = 0;
  if (col === name) score += 10;
  if (listName && col === listName) score += 8;
  if (label && col === label) score += 7;
  if (col.includes(name) || name.includes(col)) score += 5;
  if (label && (label.includes(col) || col.includes(label))) score += 4;
  if (variable.baseType === "select_one") score += 4;
  if (variable.baseType === "select_multiple") score += 2;
  if (variable.rowIndex == null || variable.rowIndex < node.rowIndex) score += 3;
  if (/^(region|departamento|provincia|distrito|zona|sector|ubigeo|sede|facultad|curso)$/.test(col)) {
    score += 2;
  }
  return score;
}

export function normalizeChoiceFilterToken(value: string): string {
  return stripMarkdown(value)
    .toLowerCase()
    .replace(/ñ/g, "n")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
