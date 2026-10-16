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
import { ChoiceFilterPanel } from "./FiltroOpcionesPanel";
import { ConstraintMessageField } from "./MensajeValidacion";
import { CustomValidationPanel, GuidedValidationNotice, RuleInheritancePanel, ValidationSummary } from "./ValidacionPaneles";

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

