// Paneles de «Qué acepta» en Restricciones: fórmula escrita a mano, atajo aplicado y atajos comunes.
// La lectura de la regla vive en la cabecera de la pestaña: aquí no se repite.

import { useEffect, useReducer, useState } from "react";
import { CheckCircle2, Trash2 } from "lucide-react";
import { borradorCampo } from "../ficha/modeloFicha";
import type { BuilderNode } from "../../types";
import { InspectorField } from "../../inspector/InspectorPrimitives";
import { validationPresetsFor, type HumanizedExpression } from "../reglasHumanas";

export function CustomValidationPanel({
  node,
  validation,
  onFieldChange,
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
  // El panel no se pliega solo: antes cada tecla reinterpretaba la regla, el panel se cerraba y se perdía el foco.
  const [abierto, setAbierto] = useState(openByDefault);
  // Borrador mientras se escribe: la regla se aplica al salir del campo, con «Aplicar» o con Ctrl/⌘+Enter.
  const [borrador, enviar] = useReducer(borradorCampo, { texto: node.constraint, enFoco: false });
  useEffect(() => enviar({ tipo: "valor", valor: node.constraint }), [node.constraint]);
  const pendiente = borrador.texto.trim() !== node.constraint.trim();
  const aplicar = () => {
    const limpio = borrador.texto.trim();
    enviar({ tipo: "tecleo", texto: limpio });
    if (limpio !== node.constraint.trim()) onFieldChange("constraint", limpio);
  };

  return (
    <details className="pulso-focus-custom-validation" open={abierto} onToggle={(e) => setAbierto(e.currentTarget.open)}>
      <summary>Escribir la regla a mano</summary>
      <InspectorField label="Expresión XLSForm" hint="Acepta la respuesta cuando da verdadero">
        {(campo) => (
          <>
            <textarea
              id={campo.id}
              aria-describedby={campo.hintId}
              value={borrador.texto}
              onFocus={() => enviar({ tipo: "foco" })}
              onBlur={() => { aplicar(); enviar({ tipo: "desenfoque" }); }}
              onChange={(event) => enviar({ tipo: "tecleo", texto: event.target.value })}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) { event.preventDefault(); aplicar(); }
                if (event.key === "Escape" && pendiente) { event.preventDefault(); enviar({ tipo: "tecleo", texto: node.constraint }); }
              }}
              placeholder="Ej. . >= 0 and . <= 120"
              rows={3}
              spellCheck={false}
            />
            {pendiente ? (
              <div className="pulso-focus-custom-validation-pie">
                <button type="button" className="pulso-logic-builder-clear" onMouseDown={(e) => e.preventDefault()} onClick={() => enviar({ tipo: "tecleo", texto: node.constraint })}>Descartar</button>
                <button type="button" className="pulso-focus-custom-validation-aplicar" onMouseDown={(e) => e.preventDefault()} onClick={aplicar}>Aplicar</button>
              </div>
            ) : null}
          </>
        )}
      </InspectorField>
    </details>
  );
}

export function GuidedValidationNotice({ onClear }: { onClear: () => void }) {
  return (
    <div className="pulso-focus-guided-validation">
      <p>Atajo aplicado. Para cambiarlo, quítalo y elige otro.</p>
      <button type="button" className="pulso-logic-builder-clear" onClick={onClear}>
        <Trash2 size={12} /> Quitar
      </button>
    </div>
  );
}

export function ValidationSummary({
  node,
  onFieldChange,
  onFieldsChange,
}: {
  node: BuilderNode;
  onFieldChange: (field: string, value: string) => void;
  onFieldsChange: (updates: Record<string, string>) => void;
}) {
  const presets = validationPresetsFor(node);
  if (!presets.length) return null;

  return (
    <div className="pulso-focus-validation">
      <div className="pulso-focus-validation-presets" aria-label="Validaciones sugeridas">
        <div className="pulso-focus-validation-presets-head">
          <span className="pulso-section-eyebrow">Atajos</span>
        </div>
        <div className="pulso-focus-validation-preset-grid">
          {presets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="pulso-focus-validation-preset"
              onClick={() => {
                if (preset.message) {
                  onFieldsChange({ constraint: preset.expression, constraint_message: preset.message });
                  return;
                }
                onFieldChange("constraint", preset.expression);
              }}
            >
              <span className="pulso-focus-validation-preset-icon">
                <CheckCircle2 size={12} />
              </span>
              <span className="pulso-focus-validation-preset-copy">
                <strong>{preset.label}</strong>
                <small>{preset.hint}</small>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
