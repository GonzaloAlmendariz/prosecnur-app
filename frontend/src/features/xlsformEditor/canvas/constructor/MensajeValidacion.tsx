// Mensaje para quien no cumple la regla (constraint_message): el campo y, debajo, sugerencias en una línea.

import type { BuilderNode } from "../../types";
import { InspectorField } from "../../inspector/InspectorPrimitives";
import { type HumanizedExpression } from "../reglasHumanas";

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
  const hasConstraint = node.constraint.trim().length > 0;
  const actual = value.trim();
  const sugerencias = hasConstraint ? constraintMessagePresetsFor(node, validation).filter((p) => p.message !== actual) : [];

  return (
    <InspectorField label="Mensaje si no pasa">
      {(campo) => (
        <>
          <input
            id={campo.id}
            type="text"
            value={value}
            onChange={(event) => onFieldChange("constraint_message", event.target.value)}
            placeholder="Ej. Ingresa un correo electrónico válido."
          />
          {sugerencias.length > 0 && (
            <ul className="pulso-focus-message-sugerencias" aria-label="Mensajes sugeridos">
              {sugerencias.map((preset) => (
                <li key={preset.id}>
                  <button type="button" title={preset.message} onClick={() => onFieldChange("constraint_message", preset.message)}>
                    {preset.message}
                  </button>
                </li>
              ))}
            </ul>
          )}
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
