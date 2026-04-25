// =============================================================================
// inspector/MoreTab.tsx — tercera tab: ajustes secundarios
// =============================================================================
// Campos que no son del día a día pero importan: read-only, repeat_count
// (para repeats), parámetros y mensajes (constraint_message, required_message).
//
// Estos eran inputs sueltos en el monolito. Acá los agrupamos con etiquetas
// claras y pistas explicativas para que el usuario sin contexto XLSForm los
// entienda.
// =============================================================================

import type { BuilderNode } from "../types";
import { InspectorBlock, InspectorField } from "./InspectorPrimitives";

export type MoreTabProps = {
  node: BuilderNode;
  onFieldChange: (field: string, value: string) => void;
};

export function MoreTab({ node, onFieldChange }: MoreTabProps) {
  const isRepeat = node.kind === "repeat";
  const isQuestionLike =
    node.kind === "question" || node.kind === "note" || node.kind === "calculate";

  return (
    <div className="pulso-inspector-tab">
      {isRepeat && (
        <InspectorBlock>
          <InspectorField
            label="Cantidad de repeticiones"
            hint="Número fijo o referencia a otra pregunta. Vacío = el encuestador decide."
          >
            <input
              type="text"
              value={(node as BuilderNode & { repeat_count?: string }).repeat_count ?? ""}
              onChange={(event) => onFieldChange("repeat_count", event.target.value)}
              placeholder='Ej. 5  o  ${num_personas}'
              spellCheck={false}
              style={{ fontFamily: "ui-monospace, monospace", fontSize: 13 }}
            />
          </InspectorField>
        </InspectorBlock>
      )}

      {isQuestionLike && (
        <>
          <InspectorBlock>
            <label className="pulso-inspector-toggle">
              <input
                type="checkbox"
                checked={Boolean((node as BuilderNode & { read_only?: string }).read_only)}
                onChange={(event) =>
                  onFieldChange("read_only", event.target.checked ? "yes" : "")
                }
              />
              <span>
                <strong>Solo lectura</strong>
                <em>El encuestado ve el valor pero no lo puede modificar.</em>
              </span>
            </label>
          </InspectorBlock>

          <InspectorBlock>
            <InspectorField
              label="Mensaje cuando es obligatoria"
              hint="Se muestra si el encuestado intenta avanzar sin responder. El mensaje de validación vive en la tab Lógica, junto a la regla."
            >
              <input
                type="text"
                value={
                  (node as BuilderNode & { required_message?: string }).required_message ?? ""
                }
                onChange={(event) => onFieldChange("required_message", event.target.value)}
                placeholder="Ej. Por favor responde para continuar."
              />
            </InspectorField>
          </InspectorBlock>
        </>
      )}

      <InspectorBlock>
        <InspectorField
          label="Parámetros avanzados"
          hint="Atributos crudos del XLSForm. Solo modifícalo si sabes qué hace."
        >
          <input
            type="text"
            value={(node as BuilderNode & { parameters?: string }).parameters ?? ""}
            onChange={(event) => onFieldChange("parameters", event.target.value)}
            placeholder="Ej. randomize=true seed=42"
            spellCheck={false}
            style={{ fontFamily: "ui-monospace, monospace", fontSize: 12 }}
          />
        </InspectorField>
      </InspectorBlock>
    </div>
  );
}
