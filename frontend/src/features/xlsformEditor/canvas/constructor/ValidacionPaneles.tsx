// Paneles de «Qué acepta» del Constructor: fórmula propia, regla heredada, tarjeta humana y resumen.
// Extraído de constructor/TabReglas.tsx — refactor puro, revamp 2026-10-16.

import { CheckCircle2, Info, ShieldCheck, Trash2 } from "lucide-react";
import { IconConditionalLogic } from "../../../../lib/icons";
import type { BuilderNode } from "../../types";
import { parseExpression, type LogicScope } from "../../logic";
import type { ConditionalContext } from "../../inspector/ContextPanel";
import { InspectorField } from "../../inspector/InspectorPrimitives";
import { ConstraintBuilder } from "../../inspector/logic/ConstraintBuilder";
import { TextRuleSuite } from "../../inspector/logic/TextRuleSuite";
import { describeRuleBreakdown, describeValidation, validationPresetsFor, type HumanizedExpression } from "../reglasHumanas";
import { matchTextRule } from "../../inspector/logic/textRules";
import { TechTerm } from "../../helpers/TechTerm";
import { fieldMessageLooksTechnical } from "../constructor/compartido";

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
