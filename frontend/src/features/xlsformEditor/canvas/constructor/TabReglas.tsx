// Pestaña «Reglas» del Constructor: cuándo aparece, qué acepta, filtro de opciones, mensajes.
// Extraída de canvas/FocusedWorkspace.tsx — refactor puro, revamp 2026-10-16.

import { useEffect, useState } from "react";
import { CheckCircle2, Info, ShieldCheck, Trash2 } from "lucide-react";
import { IconConditionalLogic } from "../../../../lib/icons";
import type { BuilderNode } from "../../types";
import { parseExpression, type LogicScope } from "../../logic";
import type { ConditionalContext } from "../../inspector/ContextPanel";
import { stripMarkdown } from "../../helpers/markdown";
import { InspectorBlock, InspectorField } from "../../inspector/InspectorPrimitives";
import { LogicBuilder } from "../../inspector/logic/LogicBuilder";
import { ConstraintBuilder } from "../../inspector/logic/ConstraintBuilder";
import { TextRuleSuite } from "../../inspector/logic/TextRuleSuite";
import { describeRuleBreakdown, describeValidation, validationPresetsFor, variableLabel, type HumanizedExpression } from "../reglasHumanas";
import { matchTextRule } from "../../inspector/logic/textRules";
import { TechTerm } from "../../helpers/TechTerm";
import { fieldMessageLooksTechnical, variableDisplayLabel } from "../constructor/compartido";

export function RuleSectionHead({
  variant,
  title,
  purpose,
}: {
  variant: "visibility" | "validation";
  title: string;
  purpose: string;
}) {
  return (
    <div className={`pulso-focus-rule-section-head is-${variant}`}>
      <span className="pulso-focus-rule-section-icon" aria-hidden="true">
        {variant === "visibility" ? (
          <IconConditionalLogic size={13} />
        ) : (
          <ShieldCheck size={13} />
        )}
      </span>
      <div>
        <strong>{title}</strong>
        <small>{purpose}</small>
      </div>
    </div>
  );
}

export function RulesTab({
  node,
  scope,
  choiceColumns,
  conditionalContext,
  onFieldChange,
  onFieldsChange,
}: {
  node: BuilderNode;
  scope: LogicScope;
  choiceColumns: string[];
  conditionalContext?: ConditionalContext | null;
  onFieldChange: (field: string, value: string) => void;
  onFieldsChange: (updates: Record<string, string>) => void;
}) {
  const isSelect =
    node.typeInfo.base === "select_one" || node.typeInfo.base === "select_multiple";
  const isCalculate = node.kind === "calculate";
  const isSection = node.kind === "section" || node.kind === "repeat";
  const isNote = node.kind === "note";
  const showConstraint = !isCalculate && !isSection && !isNote;
  const targetNoun = isSection ? "este bloque" : "esta pregunta";
  const constraintMessage = node.constraint_message ?? "";
  const hasConstraint = node.constraint.trim().length > 0;
  // La lectura de visibilidad de arriba se reserva para la HERENCIA (lo que
  // no se edita aquí): es contexto genuino. La condición PROPIA no necesita
  // una lectura gemela — el editor de abajo ya la muestra y edita, y así el
  // editar/agregar condición queda como el foco principal de Reglas.
  const hasOwnRelevant = node.relevant.trim().length > 0;
  const inheritedRelevantCount =
    conditionalContext?.ancestorRelevants?.length ?? 0;
  const hasInheritedVisibility = inheritedRelevantCount > 0;
  const validation = describeValidation(node.constraint, node, scope);
  // Si el constraint es una receta de texto reconocida, el ConstraintBuilder
  // la muestra en modo humano editable (TextRuleSuite) — eso gana sobre el
  // aviso "Preset claro" legado, que ocultaba la edición paramétrica.
  const constraintTextRule = node.constraint.trim()
    ? matchTextRule(parseExpression(node.constraint))
    : null;
  const isGuidedPreset =
    validation?.status === "Preset claro" && !constraintTextRule;
  const readonlyBlocks: Array<{
    field: string;
    title: string;
    hint: string;
    value: string;
  }> = [];

  if (!isCalculate && node.calculation) {
    readonlyBlocks.push({
      field: "calculation",
      title: "Fórmula importada",
      hint: "Esta fila tiene una fórmula en una pregunta que no es calculate. Se preserva al exportar.",
      value: node.calculation,
    });
  }

  return (
    <div className="pulso-focus-tab-panel">
      <InspectorBlock>
        <RuleSectionHead
          variant="visibility"
          title="Visibilidad"
          purpose={`Cuándo aparece ${targetNoun} en el formulario.`}
        />
        {hasInheritedVisibility && (
          <RuleInheritancePanel
            ownRelevant={node.relevant}
            conditionalContext={conditionalContext}
            scope={scope}
            targetLabel={isSection ? "Este bloque" : "Esta pregunta"}
            inheritedOnly
          />
        )}
        <LogicBuilder
          expression={node.relevant}
          scope={scope}
          fieldLabel="Condición propia"
          targetNoun={targetNoun}
          onChange={(next) => onFieldChange("relevant", next)}
        />
      </InspectorBlock>

      {showConstraint && (
        <InspectorBlock>
          <RuleSectionHead
            variant="validation"
            title="Validación"
            purpose="Qué respuestas se aceptan como válidas."
          />
          {/* Estado con regla: la lectura humana (ValidationSummary) resume el
              qué; el editor de abajo edita el cómo. Estado vacío: el
              ConstraintBuilder es el ÚNICO dueño de la frase "sin validación"
              + CTA + atajos — antes ValidationSummary pintaba una card gemela
              con el mismo texto (redundancia 2× dentro de la pestaña). */}
          {hasConstraint && (
            <ValidationSummary
              node={node}
              scope={scope}
              onFieldChange={onFieldChange}
              onFieldsChange={onFieldsChange}
            />
          )}
          {isGuidedPreset && validation ? (
            <GuidedValidationNotice
              summary={validation.summary}
              onClear={() => {
                onFieldChange("constraint", "");
                onFieldChange("constraint_message", "");
              }}
            />
          ) : (
            <ConstraintBuilder
              // Re-monta al cambiar de pregunta (mismo criterio que LogicTab):
              // descarta borradores internos de la fila previa.
              key={node.rowIndex}
              expression={node.constraint}
              scope={scope}
              baseType={node.typeInfo.base}
              listName={node.typeInfo.listName || undefined}
              fieldLabel="Regla de la respuesta"
              onChange={(next) => onFieldChange("constraint", next)}
              onApplyPreset={({ expression, message }) => {
                onFieldsChange({ constraint: expression, constraint_message: message });
              }}
              // Atajos (Cero o más, Edad 18-65, galería de texto…) solo en el
              // estado vacío, donde reemplazan a los presets que antes vivían
              // en ValidationSummary.
              showShortcuts={!hasConstraint}
            />
          )}
          {(node.constraint || constraintMessage) && (
            <ConstraintMessageField
              node={node}
              validation={validation}
              value={constraintMessage}
              onFieldChange={onFieldChange}
            />
          )}
          {/* Escape hatch para fórmula cruda — al final, plegado por defecto. */}
          <CustomValidationPanel
            node={node}
            validation={validation}
            onFieldChange={onFieldChange}
            onFieldsChange={onFieldsChange}
          />
        </InspectorBlock>
      )}

      {isSelect && (
        <InspectorBlock>
          <ChoiceFilterPanel
            node={node}
            scope={scope}
            choiceColumns={choiceColumns}
            onFieldChange={onFieldChange}
          />
        </InspectorBlock>
      )}

      {readonlyBlocks.length > 0 && (
        <InspectorBlock>
          {readonlyBlocks.map((block) => (
            <InspectorField key={block.field} label={block.title} hint={block.hint}>
              <div className="pulso-inspector-logic-readout">
                <pre>{block.value}</pre>
                <button
                  type="button"
                  className="pulso-inspector-logic-clear"
                  onClick={() => onFieldChange(block.field, "")}
                  title="Quitar esta regla"
                >
                  <Trash2 size={12} /> Quitar
                </button>
              </div>
            </InspectorField>
          ))}
        </InspectorBlock>
      )}
    </div>
  );
}

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


export function CustomValidationPanel({
  node,
  validation,
  onFieldChange,
  onFieldsChange,
}: {
  node: BuilderNode;
  validation: (HumanizedExpression & { status: string }) | null;
  onFieldChange: (field: string, value: string) => void;
  onFieldsChange: (updates: Record<string, string>) => void;
}) {
  const openByDefault = Boolean(
    node.constraint.trim() &&
      validation?.status !== "Preset claro" &&
      validation?.status !== "Editable visualmente",
  );
  // Las reglas de texto (regex) viven en la galería humana de
  // ValidationSummary; este panel queda solo para la fórmula cruda.

  return (
    <details className="pulso-focus-custom-validation" open={openByDefault}>
      <summary>Patrón o regla avanzada</summary>
      <p>
        Pega una regla completa cuando los atajos no alcancen: patrones de texto,
        conteos de selección múltiple o una validación importada desde otro XLSForm.
      </p>
      <InspectorField
        label="Regla avanzada"
        hint="Debe devolver verdadero cuando la respuesta puede aceptarse. Se exporta como validación XLSForm."
      >
        {(campo) => (
          <textarea
            id={campo.id}
            aria-describedby={campo.hintId}
            value={node.constraint}
            onChange={(event) => onFieldChange("constraint", event.target.value)}
            placeholder={"Ej. regex(., '^[^@\\\\s]+@[^@\\\\s]+\\\\.[^@\\\\s]+$')"}
            rows={3}
            spellCheck={false}
          />
        )}
      </InspectorField>
    </details>
  );
}


export function ConstraintMessageField({
  node,
  validation,
  value,
  onFieldChange,
}: {
  node: BuilderNode;
  validation: (HumanizedExpression & { status: string }) | null;
  value: string;
  onFieldChange: (field: string, value: string) => void;
}) {
  const presets = constraintMessagePresetsFor(node, validation);
  const hasConstraint = node.constraint.trim().length > 0;

  return (
    <InspectorField
      label="Mensaje si la respuesta no es válida"
      hint="Texto visible en Kobo cuando la respuesta no cumple la regla. Escríbelo como una indicación para campo."
    >
      {(campo) => (
        <>
          {hasConstraint && (
            <ConstraintMessageAssistant
              value={value}
              validation={validation}
              presets={presets}
              onApply={(message) => onFieldChange("constraint_message", message)}
            />
          )}
          <input
            id={campo.id}
            aria-describedby={campo.hintId}
            type="text"
            value={value}
            onChange={(event) =>
              onFieldChange("constraint_message", event.target.value)
            }
            placeholder="Ej. Ingresa un correo electrónico válido."
          />
        </>
      )}
    </InspectorField>
  );
}

export type ConstraintMessagePreset = {
  id: string;
  label: string;
  hint: string;
  message: string;
};

export function ConstraintMessageAssistant({
  value,
  validation,
  presets,
  onApply,
}: {
  value: string;
  validation: (HumanizedExpression & { status: string }) | null;
  presets: ConstraintMessagePreset[];
  onApply: (message: string) => void;
}) {
  const cleanValue = value.trim();
  const hasMessage = cleanValue.length > 0;
  const looksTechnical = fieldMessageLooksTechnical(cleanValue);
  const hasCorrectionCue =
    /\b(ingresa|selecciona|elige|escribe|usa|verifica|corrige|marca|indica|debe|solo|entre|mínimo|máximo|mayor|menor)\b/i.test(
      cleanValue,
    );
  const isReady = hasMessage && !looksTechnical && hasCorrectionCue;
  const checks = [
    {
      key: "message",
      label: hasMessage ? "Mensaje definido" : "Falta mensaje",
      ok: hasMessage,
    },
    {
      key: "language",
      label: looksTechnical ? "Suena técnico" : "Lenguaje de campo",
      ok: hasMessage && !looksTechnical,
    },
    {
      key: "action",
      label: hasCorrectionCue ? "Dice cómo corregir" : "Explica qué hacer",
      ok: hasMessage && hasCorrectionCue,
    },
  ];
  const primaryPresets = isReady ? presets : presets.slice(0, 2);
  const secondaryPresets = isReady ? [] : presets.slice(2);
  const renderPresetGrid = (items: ConstraintMessagePreset[]) =>
    items.length > 0 ? (
      <div className="pulso-focus-message-preset-grid">
        {items.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className="pulso-focus-message-preset"
            onClick={() => onApply(preset.message)}
            title={preset.hint}
          >
            <span className="pulso-focus-message-preset-icon">
              <CheckCircle2 size={12} />
            </span>
            <span className="pulso-focus-message-preset-copy">
              <strong>{preset.label}</strong>
              <small>{preset.hint}</small>
              <em>{preset.message}</em>
            </span>
          </button>
        ))}
      </div>
    ) : null;
  const primaryPresetGrid = renderPresetGrid(primaryPresets);

  return (
    <div
      className={`pulso-focus-message-presets pulso-focus-constraint-message-presets pulso-focus-constraint-message-assistant${isReady ? "" : " is-warning"}`}
      aria-label="Asistente de mensaje de validación"
    >
      <div className="pulso-focus-message-presets-head pulso-focus-constraint-message-head">
        <span className="pulso-focus-constraint-message-icon" aria-hidden="true">
          {isReady ? <CheckCircle2 size={14} /> : <Info size={14} />}
        </span>
        <div>
          <span className="pulso-section-eyebrow">Mensaje Kobo</span>
          <strong>{isReady ? "Texto listo para campo" : "Completa una indicación clara"}</strong>
          <small>
            Kobo lo muestra cuando la respuesta no cumple
            {validation?.summary ? " la regla resumida arriba." : " esta validación."}
          </small>
        </div>
      </div>

      <div className="pulso-focus-required-message-checks pulso-focus-constraint-message-checks" aria-label="Revisión del mensaje de validación">
        {checks.map((check) => (
          <span key={check.key} className={check.ok ? "is-ok" : "is-pending"}>
            {check.ok ? <CheckCircle2 size={11} /> : <Info size={11} />}
            {check.label}
          </span>
        ))}
      </div>

      {isReady ? (
        primaryPresetGrid ? (
          <details className="pulso-focus-required-message-alternatives">
            <summary>Cambiar por otro texto sugerido</summary>
            {primaryPresetGrid}
          </details>
        ) : null
      ) : (
        <>
          {primaryPresetGrid}
          {secondaryPresets.length > 0 && (
            <details className="pulso-focus-required-message-alternatives pulso-focus-constraint-message-more">
              <summary>Más textos sugeridos</summary>
              {renderPresetGrid(secondaryPresets)}
            </details>
          )}
          {!primaryPresetGrid && (
            <div className="pulso-focus-constraint-message-guidance">
              <strong>Guía rápida</strong>
              <span>
                Empieza con una acción: 'Ingresa...', 'Selecciona...' o 'Debe estar entre...'.
                Evita mencionar regex, constraint o XLSForm.
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function constraintMessagePresetsFor(
  node: BuilderNode,
  validation: (HumanizedExpression & { status: string }) | null,
): ConstraintMessagePreset[] {
  const summary = validation?.summary.toLowerCase() ?? "";
  const base = node.typeInfo.base;
  const presets: ConstraintMessagePreset[] = [];

  if (summary.includes("correo")) {
    presets.push({
      id: "email",
      label: "Correo válido",
      hint: "Para validaciones de correo electrónico.",
      message: "Ingresa un correo electrónico válido.",
    });
  } else if (summary.includes("url") || summary.includes("enlace")) {
    presets.push({
      id: "url",
      label: "Enlace válido",
      hint: "Para respuestas que deben ser enlaces web.",
      message: "Ingresa un enlace web válido.",
    });
  } else if (summary.includes("dígitos") || summary.includes("digitos")) {
    presets.push({
      id: "digits",
      label: "Solo números",
      hint: "Para códigos o identificadores numéricos.",
      message: "Ingresa solo números, sin letras ni símbolos.",
    });
  } else if (summary.includes("posterior a hoy") || summary.includes("hoy")) {
    presets.push({
      id: "date",
      label: "Fecha permitida",
      hint: "Para fechas que no pueden estar en el futuro.",
      message: "La fecha no puede ser posterior a hoy.",
    });
  } else if (summary.includes("mayor que cero")) {
    presets.push({
      id: "positive",
      label: "Valor positivo",
      hint: "Para cantidades que no aceptan cero.",
      message: "Ingresa un valor mayor que cero.",
    });
  } else if (summary.includes("cero o mayor") || summary.includes("igual o mayor")) {
    presets.push({
      id: "non-negative",
      label: "Cero o más",
      hint: "Para cantidades que no aceptan valores negativos.",
      message: "Ingresa un valor igual o mayor que cero.",
    });
  }

  if (base === "integer" || base === "decimal") {
    presets.push({
      id: "numeric-range",
      label: "Rango numérico",
      hint: "Para reglas de mínimos, máximos o rangos.",
      message: "Ingresa un número dentro del rango permitido.",
    });
  }
  if (base === "date") {
    presets.push({
      id: "date-general",
      label: "Revisar fecha",
      hint: "Para reglas de fecha importadas o personalizadas.",
      message: "Revisa la fecha antes de continuar.",
    });
  }
  if (base === "text") {
    presets.push({
      id: "text-format",
      label: "Formato de texto",
      hint: "Para patrones de texto personalizados.",
      message: "Revisa el formato de esta respuesta.",
    });
  }

  presets.push(
    {
      id: "field-confirm",
      label: "Confirmar en campo",
      hint: "Para datos que conviene verificar con la persona encuestada.",
      message: "Confirma este dato antes de continuar.",
    },
    {
      id: "review-answer",
      label: "Revisar respuesta",
      hint: "Mensaje general para reglas técnicas importadas.",
      message: "Revisa esta respuesta antes de continuar.",
    },
  );

  const seen = new Set<string>();
  return presets.filter((preset) => {
    if (seen.has(preset.message)) return false;
    seen.add(preset.message);
    return true;
  }).slice(0, 4);
}

export function GuidedValidationNotice({
  summary,
  onClear,
}: {
  summary: string;
  onClear: () => void;
}) {
  return (
    <div className="pulso-focus-guided-validation">
      <div>
        <span className="pulso-section-eyebrow">Cómo se valida la respuesta</span>
        <strong>{summary}</strong>
        <p>Esta regla está aplicada como preset. Para cambiarla, elige otro preset arriba o quítala para construir una regla manual.</p>
      </div>
      <button type="button" className="pulso-logic-builder-clear" onClick={onClear}>
        <Trash2 size={12} /> Quitar
      </button>
    </div>
  );
}

export function RuleInheritancePanel({
  ownRelevant,
  conditionalContext,
  scope,
  targetLabel,
  inheritedOnly = false,
}: {
  ownRelevant: string;
  conditionalContext?: ConditionalContext | null;
  scope: LogicScope;
  targetLabel: string;
  /** Solo herencia (contexto). La condición propia se ve/edita en el builder
   *  de abajo, así que aquí no se duplica. */
  inheritedOnly?: boolean;
}) {
  const ancestors = conditionalContext?.ancestorRelevants ?? [];
  const hasOwn = !inheritedOnly && ownRelevant.trim().length > 0;
  const showOwn = hasOwn;

  return (
    <div className="pulso-focus-rule-context" aria-label="Alcance de reglas de visibilidad">
      <div className="pulso-focus-rule-context-head">
        <span className="pulso-section-eyebrow">
          {inheritedOnly ? "Hereda visibilidad" : "Lectura de visibilidad"}
        </span>
        <strong>{showOwn || ancestors.length ? "Condicionada" : "Siempre visible"}</strong>
      </div>

      {!showOwn && !ancestors.length && (
        <div className="pulso-focus-rule-card is-muted">
          <Info size={13} />
          <span>Esta pieza no tiene condición propia ni hereda condiciones de secciones.</span>
        </div>
      )}

      {showOwn && (
        <HumanRuleCard
          label="Condición propia"
          expression={ownRelevant}
          scope={scope}
          targetLabel={targetLabel}
        />
      )}

      {ancestors.map((ancestor, index) => (
        <HumanRuleCard
          key={`${ancestor.sectionLabel}-${index}`}
          label={`Heredada de ${ancestor.sectionLabel}`}
          expression={ancestor.relevant}
          scope={scope}
          targetLabel={targetLabel}
        />
      ))}
    </div>
  );
}

export function HumanRuleCard({
  label,
  expression,
  scope,
  targetLabel,
}: {
  label: string;
  expression: string;
  scope: LogicScope;
  targetLabel: string;
}) {
  const breakdown = describeRuleBreakdown(expression, scope, targetLabel);
  return (
    <div className={`pulso-focus-rule-card ${breakdown.technical ? "is-technical" : ""}`}>
      <IconConditionalLogic size={13} />
      <div>
        <span>{label}</span>
        <strong>{breakdown.title}</strong>
        <div className="pulso-focus-rule-list">
          {breakdown.items.map((item, index) => (
            <div className="pulso-focus-rule-item" key={`${item.subject}-${index}`}>
              <span className="pulso-focus-rule-item-index">{index + 1}</span>
              <div className="pulso-focus-rule-item-copy">
                <strong>{item.subject}</strong>
                <p>
                  {item.relation}
                  {item.value && <b>{item.value}</b>}
                </p>
                {item.values && (
                  <div className="pulso-focus-rule-values">
                    {item.values.map((value) => (
                      <span key={value}>{value}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ValidationSummary({
  node,
  scope,
  onFieldChange,
  onFieldsChange,
}: {
  node: BuilderNode;
  scope: LogicScope;
  onFieldChange: (field: string, value: string) => void;
  onFieldsChange: (updates: Record<string, string>) => void;
}) {
  const summary = describeValidation(node.constraint, node, scope);
  const presets = validationPresetsFor(node);
  const messageStatus = summary
    ? validationMessageStatusFor(node.constraint_message ?? "")
    : null;
  // Preguntas de texto: la galería de reglas humanas (textRules) reemplaza a
  // los presets fijos. Solo en modo "elegir" — si el constraint actual ya es
  // una receta reconocida, el ConstraintBuilder de abajo la muestra en modo
  // humano y acá no se duplica.
  const recognizedRule = node.constraint.trim()
    ? matchTextRule(parseExpression(node.constraint))
    : null;
  const showTextRuleGallery = node.typeInfo.base === "text" && !recognizedRule;
  // La lectura superior usa el título humano de la receta cuando existe
  // ("Debe tener exactamente 8 dígitos" en vez de un resumen genérico).
  const summaryStatus = recognizedRule ? "Regla de texto" : summary?.status;
  const summaryText = recognizedRule
    ? recognizedRule.recipe.title(recognizedRule.params)
    : summary?.summary;

  return (
    <div className="pulso-focus-validation">
      <div className={`pulso-focus-validation-card ${summary ? "" : "is-empty"}`}>
        {summary ? <ShieldCheck size={14} /> : <Info size={14} />}
        <div>
          <span>{summaryStatus ?? "Sin validación"}</span>
          <strong>{summaryText ?? "La respuesta se acepta tal como fue ingresada."}</strong>
          {summary?.technical && (
            <details>
              <summary>Ver regla XLSForm</summary>
              <code>{summary.raw}</code>
            </details>
          )}
        </div>
      </div>
      {messageStatus && (
        <div className={`pulso-focus-validation-message-status is-${messageStatus.tone}`}>
          {messageStatus.tone === "ok" ? <CheckCircle2 size={12} /> : <Info size={12} />}
          <span>
            <strong>{messageStatus.title}</strong>
            <small>{messageStatus.detail}</small>
          </span>
        </div>
      )}

      {showTextRuleGallery && (
        <div className="pulso-focus-validation-presets" aria-label="Reglas de texto">
          <div className="pulso-focus-validation-presets-head">
            <span className="pulso-section-eyebrow">
              Formato del texto <TechTerm t="regex" />
            </span>
            <strong>Reglas en lenguaje claro</strong>
            <small>La regla técnica y el mensaje para el encuestado se completan juntos.</small>
          </div>
          <TextRuleSuite
            active={null}
            onApply={(constraintExpr, message) => {
              onFieldsChange({
                constraint: constraintExpr,
                constraint_message: message,
              });
            }}
            onClear={() => {
              onFieldsChange({ constraint: "", constraint_message: "" });
            }}
          />
        </div>
      )}

      {presets.length > 0 && (
        <div className="pulso-focus-validation-presets" aria-label="Validaciones sugeridas">
          <div className="pulso-focus-validation-presets-head">
            <span className="pulso-section-eyebrow">Atajos Kobo</span>
            <strong>Aplicar una regla común</strong>
            <small>La regla técnica y el mensaje para el encuestado se completan juntos.</small>
          </div>
          <div className="pulso-focus-validation-preset-grid">
            {presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="pulso-focus-validation-preset"
                onClick={() => {
                  if (preset.message) {
                    onFieldsChange({
                      constraint: preset.expression,
                      constraint_message: preset.message,
                    });
                    return;
                  }
                  onFieldChange("constraint", preset.expression);
                }}
                title={preset.hint}
              >
                <span className="pulso-focus-validation-preset-icon">
                  <CheckCircle2 size={12} />
                </span>
                <span className="pulso-focus-validation-preset-copy">
                  <strong>{preset.label}</strong>
                  <small>{preset.hint}</small>
                  {preset.message && <em>{preset.message}</em>}
                </span>
                {preset.expression.includes("regex(") && (
                  <code className="pulso-focus-validation-preset-badge">regex</code>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function validationMessageStatusFor(value: string): {
  tone: "ok" | "warning";
  title: string;
  detail: string;
} {
  const cleanValue = value.trim();
  if (!cleanValue) {
    return {
      tone: "warning",
      title: "Falta mensaje para campo",
      detail: "Completa una frase clara para que Kobo explique cómo corregir la respuesta.",
    };
  }
  if (fieldMessageLooksTechnical(cleanValue)) {
    return {
      tone: "warning",
      title: "Mensaje suena técnico",
      detail: "Cambia términos como regex, constraint o XLSForm por una instrucción directa.",
    };
  }
  return {
    tone: "ok",
    title: "Mensaje listo para campo",
    detail: "Kobo mostrará una indicación entendible cuando la respuesta no cumpla la regla.",
  };
}
