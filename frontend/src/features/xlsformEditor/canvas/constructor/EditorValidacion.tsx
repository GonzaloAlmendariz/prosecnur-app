import { useState } from "react";
import type { BuilderNode } from "../../types";
import { parseExpression, type LogicScope } from "../../logic";
import { ConstraintBuilder } from "../../inspector/logic/ConstraintBuilder";
import { matchTextRule } from "../../inspector/logic/textRules";
import { describeValidation, validationPresetsFor } from "../reglasHumanas";
import { ConstraintMessageField, constraintMessagePresetsFor } from "./MensajeValidacion";
import { mensajeSugeridoDe } from "../../pestanas/armador/armadorModelo";
import { alAplicarFormato, cambiosAlQuitarAtajo } from "./edicionValidacion";
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
  // Sugerencia de mensaje tras aplicar un formato cuando el vigente es de otra regla. Se descarta al cambiar de fila.
  const [oferta, setOferta] = useState<{ fila: number; mensaje: string } | null>(null);
  const ofrecer = oferta && oferta.fila === node.rowIndex && oferta.mensaje !== constraintMessage.trim() ? oferta.mensaje : null;
  const quitarAtajo = () => {
    const sugeridos = [
      ...validationPresetsFor(node).map((p) => p.message),
      ...constraintMessagePresetsFor(node, validation).map((p) => p.message),
      ...(constraintTextRule ? [constraintTextRule.recipe.buildMessage(constraintTextRule.params)] : []),
      mensajeSugeridoDe(node.constraint) ?? "",
    ].filter(Boolean);
    // Un solo cambio: dos escrituras seguidas leían la fila vieja y la segunda devolvía la regla.
    onFieldsChange(cambiosAlQuitarAtajo(constraintMessage, sugeridos));
  };

  return (
    <>
      {hasConstraint && (
        <ValidationSummary node={node} onFieldChange={onFieldChange} onFieldsChange={onFieldsChange} />
      )}
      {/* Armador de patrones (G2): sólo en preguntas de texto, escribe regex(., '^…$') al aplicar. */}
      {node.typeInfo.base === "text" && (
        <ArmadorFormatoEntrada
          key={node.rowIndex}
          constraint={node.constraint}
          onAplicar={(next) => {
            const r = alAplicarFormato(next, constraintMessage, mensajeSugeridoDe(next));
            onFieldsChange(r.cambios);
            setOferta(r.ofrecer ? { fila: node.rowIndex, mensaje: r.ofrecer } : null);
          }}
        />
      )}
      {isGuidedPreset && validation ? (
        <GuidedValidationNotice onClear={quitarAtajo} />
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
      {ofrecer ? (
        <p className="pulso-focus-aviso-mensaje" role="status">
          El mensaje vigente es de otra regla.
          <button type="button" onClick={() => { onFieldChange("constraint_message", ofrecer); setOferta(null); }}>Usar «{ofrecer}»</button>
        </p>
      ) : null}
      {(node.constraint || constraintMessage) && (
        <ConstraintMessageField node={node} validation={validation} value={constraintMessage} onFieldChange={onFieldChange} />
      )}
      {/* Escape hatch para fórmula cruda — al final, plegado por defecto. */}
      <CustomValidationPanel node={node} validation={validation} onFieldChange={onFieldChange} onFieldsChange={onFieldsChange} />
    </>
  );
}
