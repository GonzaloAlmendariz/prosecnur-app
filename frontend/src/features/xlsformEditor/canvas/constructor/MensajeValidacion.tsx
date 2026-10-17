// Mensaje para quien no cumple la regla (constraint_message): campo, asistente y presets por tipo.
// Extraído de constructor/TabReglas.tsx — refactor puro, revamp 2026-10-16.

import { CheckCircle2, Info } from "lucide-react";
import type { BuilderNode } from "../../types";
import { InspectorField } from "../../inspector/InspectorPrimitives";
import { type HumanizedExpression } from "../reglasHumanas";
import { fieldMessageLooksTechnical } from "../constructor/compartido";

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
          <span className="pulso-section-eyebrow">Mensaje al encuestado</span>
          <strong>{isReady ? "Texto listo para campo" : "Completa una indicación clara"}</strong>
          <small>
            El formulario lo muestra cuando la respuesta no cumple
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
