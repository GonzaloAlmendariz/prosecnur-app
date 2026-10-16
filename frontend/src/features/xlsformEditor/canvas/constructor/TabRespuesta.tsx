// Pestaña «Respuesta» del Constructor: obligatoria, mensaje, cálculo, repetición y lista de opciones.
// Extraída de canvas/FocusedWorkspace.tsx — refactor puro, revamp 2026-10-16.

import { useEffect, useState } from "react";
import { Calculator, CheckCircle2, Info, Repeat, Trash2 } from "lucide-react";
import { IconConditionalLogic, IconRequired } from "../../../../lib/icons";
import type { BuilderNode, CatalogSummary, SectionMeta, XlsformEditorWorkbook } from "../../types";
import { type LogicScope } from "../../logic";
import type { CatalogInfo, ConditionalContext } from "../../inspector/ContextPanel";
import { plural } from "../../shell/editorMetrics";
import { InspectorBlock, InspectorField } from "../../inspector/InspectorPrimitives";
import { TypePicker } from "../../inspector/TypePicker";
import { CatalogChip } from "../../inspector/CatalogChip";
import { CalculationBuilder } from "../../inspector/logic/CalculationBuilder";
import { describeExpression } from "../reglasHumanas";
import { SectionBoundaryControl, fieldMessageLooksTechnical, variableDisplayLabel, FocusFact } from "../constructor/compartido";
import type { SectionBoundaryState } from "../FocusedWorkspace";

export function ResponseTab({
  node,
  section,
  catalogs,
  logicScope,
  catalogUsageCount,
  catalogInfo,
  conditionalContext,
  sectionBoundary,
  onTypeChange,
  onFieldChange,
  onRequiredChange,
  onCatalogAssign,
  onCatalogCreate,
  onOpenCatalogLens,
  onCloneCatalog,
  onIncludeNextInSection,
  onReleaseLastFromSection,
  onSelectRow,
}: {
  node: BuilderNode;
  section: SectionMeta | null;
  catalogs: CatalogSummary[];
  logicScope: LogicScope;
  catalogUsageCount: number;
  catalogInfo?: CatalogInfo;
  conditionalContext?: ConditionalContext | null;
  sectionBoundary: SectionBoundaryState | null;
  onTypeChange: (next: string) => void;
  onFieldChange: (field: string, value: string) => void;
  onRequiredChange: (checked: boolean) => void;
  onCatalogAssign: (listName: string) => void;
  onCatalogCreate: () => void;
  onOpenCatalogLens: (focusListName: string) => void;
  onCloneCatalog?: () => void;
  onIncludeNextInSection: () => void;
  onReleaseLastFromSection: () => void;
  onSelectRow: (rowIndex: number) => void;
}) {
  const isSection = node.kind === "section" || node.kind === "repeat";
  const isSelect = node.typeInfo.base === "select_one" || node.typeInfo.base === "select_multiple";

  if (isSection) {
    return (
      <div className="pulso-focus-tab-panel">
        <InspectorBlock>
          <div className="pulso-focus-structure-summary">
            <FocusFact label="Bloque" value={node.kind === "repeat" ? "Repetición" : "Sección"} />
            <FocusFact label="Contenido directo" value={plural(section?.itemCount ?? 0, "elemento", "elementos")} />
            <FocusFact label="Padre" value={section?.parentId && section.parentId !== "root" ? section.parentId : "Formulario"} />
          </div>
          <SectionBoundaryControl
            boundary={sectionBoundary}
            onIncludeNext={onIncludeNextInSection}
            onReleaseLast={onReleaseLastFromSection}
          />
        </InspectorBlock>
        {node.kind === "repeat" && (
          <InspectorBlock>
            <RepeatCountPanel
              node={node}
              scope={logicScope}
              onFieldChange={onFieldChange}
            />
          </InspectorBlock>
        )}
      </div>
    );
  }

  return (
    <div className="pulso-focus-tab-panel">
      {node.kind === "calculate" && (
        <InspectorBlock>
          <CalculationRecipePanel
            expression={node.calculation}
            scope={logicScope}
            onFieldChange={onFieldChange}
          />
          <CalculationBuilder
            expression={node.calculation}
            scope={logicScope}
            fieldLabel="Cómo se calcula"
            hint="Fórmula que completa este campo. Usa ${variable} para referenciar otras preguntas."
            onChange={(next) => onFieldChange("calculation", next)}
          />
        </InspectorBlock>
      )}

      <InspectorBlock>
        <InspectorField label="Tipo de respuesta" hint="Cómo va a contestar el encuestado.">
          <TypePicker value={node.typeInfo.base} onChange={onTypeChange} />
        </InspectorField>
      </InspectorBlock>

      {node.kind === "question" && (
        <InspectorBlock>
          <RequiredControl
            node={node}
            conditionalContext={conditionalContext}
            scope={logicScope}
            onRequiredChange={onRequiredChange}
            onFieldChange={onFieldChange}
          />
        </InspectorBlock>
      )}

      {isSelect && (
        <InspectorBlock>
          <InspectorField
            label="Lista de opciones"
            hint="Lista que alimenta esta pregunta. Puedes reusar listas o abrir el editor de listas."
          >
            <CatalogChip
              assignedListName={node.typeInfo.listName}
              catalogs={catalogs}
              onAssign={onCatalogAssign}
              onCreate={onCatalogCreate}
              onOpenLens={onOpenCatalogLens}
            />
          </InspectorField>
          {catalogInfo && (
            <FocusedCatalogInfo
              info={catalogInfo}
              usageCount={catalogUsageCount}
              onOpenLens={() => onOpenCatalogLens(catalogInfo.listName)}
              onSelectRow={onSelectRow}
              onCloneCatalog={onCloneCatalog}
            />
          )}
        </InspectorBlock>
      )}

      {node.kind === "question" && (
        <InspectorBlock>
          <InspectorField
            label="Valor por defecto"
            hint="Respuesta prellenada al abrir la pregunta. Déjalo vacío si el encuestador debe responder desde cero."
          >
            {(campo) => (
              <input
                id={campo.id}
                aria-describedby={campo.hintId}
                type="text"
                value={(node as BuilderNode & { default?: string }).default ?? ""}
                onChange={(event) => onFieldChange("default", event.target.value)}
                placeholder="Opcional"
              />
            )}
          </InspectorField>
        </InspectorBlock>
      )}
    </div>
  );
}

export function RequiredControl({
  node,
  conditionalContext,
  scope,
  onRequiredChange,
  onFieldChange,
}: {
  node: BuilderNode;
  conditionalContext?: ConditionalContext | null;
  scope: LogicScope;
  onRequiredChange: (checked: boolean) => void;
  onFieldChange: (field: string, value: string) => void;
}) {
  const [conditionExplainOpen, setConditionExplainOpen] = useState(false);
  const hasCondition =
    !!conditionalContext &&
    (conditionalContext.selfRelevant.length > 0 ||
      conditionalContext.ancestorRelevants.length > 0);
  const requiredMessage = node.required_message ?? "";
  const messagePresets = requiredMessagePresetsFor(node, hasCondition);

  return (
    <>
      <label className={`pulso-inspector-toggle pulso-inspector-required-toggle ${node.required ? "is-on" : ""}`}>
        <input
          type="checkbox"
          checked={node.required}
          onChange={(event) => onRequiredChange(event.target.checked)}
        />
        <span className="pulso-inspector-required-icon" aria-hidden="true">
          <IconRequired size={14} strokeWidth={2.4} style={{ opacity: node.required ? 1 : 0.35 }} />
        </span>
        <span>
          <strong>Pregunta obligatoria</strong>
          <em>El encuestador no puede pasar de largo sin responderla.</em>
        </span>
      </label>

      {node.required && hasCondition && (
        <div className="pulso-inspector-conditional-required">
          <button
            type="button"
            className="pulso-inspector-conditional-required-trigger"
            onClick={() => setConditionExplainOpen((value) => !value)}
            aria-expanded={conditionExplainOpen}
          >
            <IconConditionalLogic size={12} />
            <span>Obligatoria condicionada</span>
          </button>
          {conditionExplainOpen && (
            <div className="pulso-inspector-conditional-required-body">
              <p>
                Esta pregunta es obligatoria solo cuando se cumple su regla de
                apertura o la de una sección contenedora.
              </p>
              {conditionalContext?.selfRelevant && (
                <div className="pulso-inspector-conditional-required-rule">
                  <span>Aparece cuando</span>
                  <strong>{describeExpression(conditionalContext.selfRelevant, scope).summary}</strong>
                  <details>
                    <summary>Ver regla XLSForm</summary>
                    <code>{conditionalContext.selfRelevant}</code>
                  </details>
                </div>
              )}
              {conditionalContext?.ancestorRelevants.map((ancestor, index) => (
                <div
                  key={`${ancestor.sectionLabel}-${index}`}
                  className="pulso-inspector-conditional-required-rule"
                >
                  <span>Sección «{ancestor.sectionLabel}» aparece cuando</span>
                  <strong>{describeExpression(ancestor.relevant, scope).summary}</strong>
                  <details>
                    <summary>Ver regla XLSForm</summary>
                    <code>{ancestor.relevant}</code>
                  </details>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {(node.required || requiredMessage) && (
        // Comprimido y opcional: Kobo ya muestra un aviso por defecto; el
        // mensaje propio queda plegado y solo se abre (con presets) si el
        // usuario quiere personalizarlo. Abierto de entrada solo si ya existe.
        <details
          className="pulso-focus-required-message-block"
          open={requiredMessage.trim().length > 0}
        >
          <summary>
            <span>Mensaje si falta respuesta</span>
            <small>{requiredMessage.trim() ? "Personalizado" : "Opcional"}</small>
          </summary>
          <div className="pulso-inspector-field-control">
            <input
              type="text"
              value={requiredMessage}
              onChange={(event) => onFieldChange("required_message", event.target.value)}
              placeholder="Ej. Esta respuesta es necesaria para continuar."
            />
          </div>
          {node.required && (
            <RequiredMessageAssistant
              value={requiredMessage}
              hasCondition={hasCondition}
              presets={messagePresets}
              onApply={(message) => onFieldChange("required_message", message)}
            />
          )}
        </details>
      )}
    </>
  );
}

export type RequiredMessagePreset = {
  id: string;
  label: string;
  hint: string;
  message: string;
};

export function RequiredMessageAssistant({
  value,
  hasCondition,
  presets,
  onApply,
}: {
  value: string;
  hasCondition: boolean;
  presets: RequiredMessagePreset[];
  onApply: (message: string) => void;
}) {
  const cleanValue = value.trim();
  const hasMessage = cleanValue.length > 0;
  const looksTechnical = fieldMessageLooksTechnical(cleanValue);
  const isReady = hasMessage && !looksTechnical;
  const checks = [
    {
      key: "message",
      label: hasMessage ? "Mensaje definido" : "Sin mensaje propio",
      ok: hasMessage,
    },
    {
      key: "field",
      label: "Lenguaje de campo",
      ok: hasMessage && !looksTechnical,
    },
    {
      key: "scope",
      label: hasCondition ? "Solo si aparece" : "Siempre que falte",
      ok: true,
    },
  ];
  const presetGrid = (
    <div className="pulso-focus-message-preset-grid">
      {presets.map((preset) => (
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
  );

  return (
    <div className={`pulso-focus-message-presets pulso-focus-required-message-assistant${isReady ? "" : " is-warning"}`} aria-label="Asistente de mensaje obligatorio">
      <div className="pulso-focus-message-presets-head pulso-focus-required-message-head">
        <span className="pulso-focus-required-message-icon" aria-hidden="true">
          {isReady ? <CheckCircle2 size={14} /> : <IconRequired size={14} />}
        </span>
        <div>
          <span className="pulso-section-eyebrow">Mensaje Kobo</span>
          <strong>{isReady ? "Texto listo para campo" : "Define una frase amable y accionable"}</strong>
          <small>
            {hasCondition
              ? "Kobo lo muestra solo si esta pregunta aparece y queda vacía."
              : "Kobo lo muestra cuando la pregunta obligatoria queda vacía."}
          </small>
        </div>
      </div>

      <div className="pulso-focus-required-message-checks" aria-label="Revisión del mensaje obligatorio">
        {checks.map((check) => (
          <span key={check.key} className={check.ok ? "is-ok" : "is-pending"}>
            {check.ok ? <CheckCircle2 size={11} /> : <Info size={11} />}
            {check.label}
          </span>
        ))}
      </div>

      {isReady ? (
        <details className="pulso-focus-required-message-alternatives">
          <summary>Cambiar por otro texto sugerido</summary>
          {presetGrid}
        </details>
      ) : (
        presetGrid
      )}
    </div>
  );
}


export function requiredMessagePresetsFor(
  node: BuilderNode,
  hasCondition: boolean,
): RequiredMessagePreset[] {
  const typePreset = requiredMessagePresetForType(node.typeInfo.base);
  const presets: RequiredMessagePreset[] = [
    typePreset,
  ];

  if (hasCondition) {
    presets.push({
      id: "conditional",
      label: "Solo si corresponde",
      hint: "Para preguntas que aparecen por una regla o dentro de una sección condicionada.",
      message: "Completa esta respuesta para continuar con esta sección.",
    });
  } else {
    presets.push({
      id: "continue",
      label: "Necesaria para continuar",
      hint: "Para campos obligatorios generales.",
      message: "Esta respuesta es necesaria para continuar.",
    });
  }

  presets.push(
    {
      id: "confirm",
      label: "Confirmar con la persona",
      hint: "Para datos que deben verificarse en campo.",
      message: "Confirma esta información antes de avanzar.",
    },
    {
      id: "analysis",
      label: "Dato clave del análisis",
      hint: "Para variables que no deberían quedar vacías.",
      message: "Necesitamos este dato para completar el análisis.",
    },
  );

  const unique = new Map<string, RequiredMessagePreset>();
  presets.forEach((preset) => unique.set(preset.id, preset));
  return [...unique.values()];
}

export function requiredMessagePresetForType(baseType: string): RequiredMessagePreset {
  switch (baseType) {
    case "integer":
    case "decimal":
    case "range":
      return {
        id: "type-number",
        label: "Número requerido",
        hint: "Para edades, cantidades, montos o puntajes.",
        message: "Ingresa un número para continuar.",
      };
    case "select_one":
      return {
        id: "type-select-one",
        label: "Elegir una opción",
        hint: "Para preguntas de selección única.",
        message: "Selecciona una opción para continuar.",
      };
    case "select_multiple":
      return {
        id: "type-select-multiple",
        label: "Elegir al menos una",
        hint: "Para preguntas donde pueden marcarse varias respuestas.",
        message: "Selecciona al menos una opción para continuar.",
      };
    case "geopoint":
    case "geotrace":
    case "geoshape":
      return {
        id: "type-location",
        label: "Ubicación requerida",
        hint: "Para coordenadas, recorridos o áreas GPS.",
        message: "Registra la ubicación para continuar.",
      };
    case "image":
    case "audio":
    case "video":
    case "file":
      return {
        id: "type-media",
        label: "Evidencia requerida",
        hint: "Para fotos, audios, videos o archivos adjuntos.",
        message: "Adjunta la evidencia solicitada para continuar.",
      };
    default:
      return {
        id: "type-text",
        label: "Respuesta solicitada",
        hint: "Para textos, fechas, nombres o códigos.",
        message: "Completa esta respuesta para continuar.",
      };
  }
}

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

export function FocusedCatalogInfo({
  info,
  usageCount,
  onOpenLens,
  onSelectRow,
  onCloneCatalog,
}: {
  info: CatalogInfo;
  usageCount: number;
  onOpenLens: () => void;
  onSelectRow: (rowIndex: number) => void;
  onCloneCatalog?: () => void;
}) {
  return (
    <div className="pulso-focus-catalog-summary">
      <div className="pulso-focus-catalog-summary-grid">
        <FocusFact label="Lista" value={info.listName} code />
        <FocusFact label="Opciones" value={`${info.choicesCount}`} />
        <FocusFact label="Uso" value={`${usageCount} ${usageCount === 1 ? "pregunta" : "preguntas"}`} />
      </div>

      {info.sharedWith.length > 0 && (
        <div className="pulso-focus-shared-list">
          <span className="pulso-section-eyebrow">También usa esta lista</span>
          {info.sharedWith.map((question) => (
            <button
              key={question.rowIndex}
              type="button"
              onClick={() => onSelectRow(question.rowIndex)}
            >
              {question.label || question.name || `fila ${question.rowIndex + 1}`}
            </button>
          ))}
          {onCloneCatalog && (
            <button type="button" className="pulso-focus-link-action" onClick={onCloneCatalog}>
              Crear copia exclusiva
            </button>
          )}
        </div>
      )}

      <button type="button" className="pulso-focus-link-action" onClick={onOpenLens}>
        Abrir editor de listas
      </button>
    </div>
  );
}

export function choiceFilterColumnsFromWorkbook(workbook: XlsformEditorWorkbook | null): string[] {
  if (!workbook) return [];
  const reservedColumns = new Set([
    "list_name",
    "name",
    "label",
    "image",
    "media::image",
    "audio",
    "media::audio",
    "video",
    "media::video",
    "paper_skip",
  ]);

  const candidates = workbook.choices.columns
    .map((column) => column.trim())
    .filter((column) => {
      const normalized = column.toLowerCase();
      return (
        column.length > 0 &&
        !reservedColumns.has(normalized) &&
        !normalized.startsWith("label::") &&
        !normalized.startsWith("image::") &&
        !normalized.startsWith("media::")
      );
    });

  return Array.from(new Set(candidates));
}
