import type { BuilderNode } from "../../types";
import { parseExpression, type LogicScope } from "../../logic";
import { ConstraintBuilder } from "../../inspector/logic/ConstraintBuilder";
import { matchTextRule } from "../../inspector/logic/textRules";
import { describeValidation } from "../reglasHumanas";
import { ConstraintMessageField } from "./MensajeValidacion";
import { ArmadorFormatoEntrada } from "../../pestanas/armador/ArmadorFormatoEntrada";
import { CustomValidationPanel, GuidedValidationNotice, ValidationSummary } from "./ValidacionPaneles";

// Editor de «qué acepta» una pregunta (constraint + constraint_message) en la pestaña Restricciones.
// La lectura de la regla ya está en la cabecera de la pestaña: el editor no la repite.

export type EditorValidacionProps = {
  node: BuilderNode;
  scope: LogicScope;
  onFieldChange: (field: string, value: string) => void;
  onFieldsChange: (updates: Record<string, string>) => void;
};

export function EditorValidacion({ node, scope, onFieldChange, onFieldsChange }: EditorValidacionProps) {
  const constraintMessage = node.constraint_message ?? "";
  const hasConstraint = node.constraint.trim().length > 0;
  const validation = describeValidation(node.constraint, node, scope);
  // Si el constraint es una receta de texto reconocida, el ConstraintBuilder la muestra en modo humano
  // editable (TextRuleSuite) — eso gana sobre el aviso «Preset claro» legado.
  const constraintTextRule = hasConstraint ? matchTextRule(parseExpression(node.constraint)) : null;
  const isGuidedPreset = validation?.status === "Preset claro" && !constraintTextRule;

  return (
    <>
      {hasConstraint && (
        <ValidationSummary node={node} onFieldChange={onFieldChange} onFieldsChange={onFieldsChange} />
      )}
      {/* Armador de patrones (G2): sólo en preguntas de texto, escribe regex(., '^…$') al aplicar. */}
      {node.typeInfo.base === "text" && (
        <ArmadorFormatoEntrada key={node.rowIndex} constraint={node.constraint} onAplicar={(next) => onFieldChange("constraint", next)} />
      )}
      {isGuidedPreset && validation ? (
        <GuidedValidationNotice
          onClear={() => {
            onFieldChange("constraint", "");
            onFieldChange("constraint_message", "");
          }}
        />
      ) : (
        <ConstraintBuilder
          // Re-monta al cambiar de pregunta: descarta borradores internos de la fila previa.
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
          // Atajos (Cero o más, Edad 18-65, galería de texto…) sólo en el estado vacío.
          showShortcuts={!hasConstraint}
        />
      )}
      {(node.constraint || constraintMessage) && (
        <ConstraintMessageField node={node} validation={validation} value={constraintMessage} onFieldChange={onFieldChange} />
      )}
      {/* Escape hatch para fórmula cruda — al final, plegado por defecto. */}
      <CustomValidationPanel node={node} validation={validation} onFieldChange={onFieldChange} onFieldsChange={onFieldsChange} />
    </>
  );
}
