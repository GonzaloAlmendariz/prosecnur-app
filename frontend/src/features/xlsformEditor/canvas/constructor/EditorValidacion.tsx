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
import { OpcionesSolasEntrada } from "../../pestanas/armador/OpcionesSolasEntrada";
import { CuantasOpcionesEntrada } from "../../pestanas/armador/CuantasOpcionesEntrada";
import { CondicionadaEntrada } from "../../pestanas/armador/CondicionadaEntrada";
import { escribirCondicionada, leerCondicionada } from "../../pestanas/armador/condicionadaModelo";
import { CustomValidationPanel, GuidedValidationNotice, ValidationSummary } from "./ValidacionPaneles";

// Editor de «qué acepta» una pregunta (constraint + constraint_message) en la pestaña Restricciones.
// La lectura de la regla ya está en la cabecera de la pestaña: el editor no la repite.

export type EditorValidacionProps = {
  node: BuilderNode;
  scope: LogicScope;
  onFieldChange: (field: string, value: string) => void;
  onFieldsChange: (updates: Record<string, string>) => void;
};

export function EditorValidacion({ node: nodoCompleto, scope, onFieldChange: escribirCampo, onFieldsChange: escribirCampos }: EditorValidacionProps) {
  // E19 paso 4: una regla condicionada `if(<cond>, <regla>, true())` se edita por partes. Todos los armadores de abajo
  // ven y escriben sólo la regla interior; al escribir se vuelve a envolver con la condición vigente.
  const { condicion, regla } = leerCondicionada(nodoCompleto.constraint);
  const envolver = (c: string) => escribirCondicionada(c, condicion);
  const node = condicion ? { ...nodoCompleto, constraint: regla } : nodoCompleto;
  const onFieldChange = (field: string, value: string) => escribirCampo(field, field === "constraint" ? envolver(value) : value);
  const onFieldsChange = (updates: Record<string, string>) =>
    escribirCampos(updates.constraint !== undefined ? { ...updates, constraint: envolver(updates.constraint) } : updates);
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
      {/* E18: opciones que van solas (Ninguno, No sabe…) en selección múltiple, sin escribir la fórmula. */}
      {node.typeInfo.base === "select_multiple" && (
        <OpcionesSolasEntrada
          key={`solas-${node.rowIndex}`}
          constraint={node.constraint}
          opciones={scope.catalogsByListName.get(node.typeInfo.listName)?.items ?? []}
          onAplicar={(next, mensaje) => onFieldsChange(constraintMessage.trim() || !next ? { constraint: next } : { constraint: next, constraint_message: mensaje })}
        />
      )}
      {/* E19 paso 2: cuántas opciones puede marcar, con número propio (el atajo traía el 3 fijo). */}
      {node.typeInfo.base === "select_multiple" && (
        <CuantasOpcionesEntrada
          key={`cuantas-${node.rowIndex}`}
          constraint={node.constraint}
          totalOpciones={scope.catalogsByListName.get(node.typeInfo.listName)?.items.length ?? 0}
          onAplicar={(next, mensaje) => onFieldsChange(constraintMessage.trim() || !next ? { constraint: next } : { constraint: next, constraint_message: mensaje })}
        />
      )}
      {/* E19 paso 4: la regla puede exigirse sólo cuando se cumple una condición sobre otra respuesta. */}
      {hasConstraint && (
        <CondicionadaEntrada
          key={`cond-${node.rowIndex}`}
          condicion={condicion}
          scope={scope}
          onCondicion={(c) => escribirCampo("constraint", escribirCondicionada(regla, c))}
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
          <button type="button" onClick={() => { onFieldChange("constraint_message", ofrecer); setOferta(null); }}>Usar "{ofrecer}"</button>
        </p>
      ) : null}
      {(node.constraint || constraintMessage) && (
        <ConstraintMessageField node={node} validation={validation} value={constraintMessage} onFieldChange={onFieldChange} />
      )}
      {/* Escape hatch para fórmula cruda — al final, plegado por defecto. */}
      {/* La fórmula a mano edita la restricción entera, con su condición si la tiene. */}
      <CustomValidationPanel node={nodoCompleto} validation={validation} onFieldChange={escribirCampo} onFieldsChange={escribirCampos} />
    </>
  );
}
