// «Obligatoria» del Constructor: interruptor, mensaje (required_message) y presets por tipo.
// Extraído de constructor/TabRespuesta.tsx — refactor puro, revamp 2026-10-16.

import { useState } from "react";
import { CheckCircle2, Info } from "lucide-react";
import { IconConditionalLogic, IconRequired } from "../../../../lib/icons";
import type { BuilderNode } from "../../types";
import { type LogicScope } from "../../logic";
import type { ConditionalContext } from "../../inspector/ContextPanel";
import { describeExpression } from "../reglasHumanas";
import { fieldMessageLooksTechnical } from "../constructor/compartido";

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
