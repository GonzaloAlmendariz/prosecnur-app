// =============================================================================
// inspector/MoreTab.tsx — ajustes de datos técnicos y salida impresa
// =============================================================================
// Campos que no son del día a día pero importan: read-only, repeat_count
// (para repeats), parámetros y mensajes (constraint_message, required_message).
//
// Estos eran inputs sueltos en el monolito. Acá los agrupamos con etiquetas
// claras en español + el término técnico entre paréntesis (`TechTerm`).
// =============================================================================

import type { BuilderNode } from "../types";
import TechTerm from "../helpers/TechTerm";
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
            label={<>Cantidad de repeticiones <TechTerm t="repeat_count" /></>}
            hint="Número fijo o referencia. Vacío = decide el encuestador."
          >
            <input
              type="text"
              className="pulso-xfi-mono"
              value={(node as BuilderNode & { repeat_count?: string }).repeat_count ?? ""}
              onChange={(event) => onFieldChange("repeat_count", event.target.value)}
              placeholder='Ej. 5  o  ${num_personas}'
              spellCheck={false}
            />
          </InspectorField>
        </InspectorBlock>
      )}

      {isQuestionLike && (
        <>
          <InspectorBlock>
            <InspectorField
              label={<>Número visible en papel <TechTerm t="paper_number" /></>}
              hint="Vacío = el PDF lo deriva del nombre interno o el orden."
            >
              <input
                type="text"
                value={node.paperNumber ?? ""}
                onChange={(event) => onFieldChange("paper_number", event.target.value)}
                placeholder="Ej. 108"
              />
            </InspectorField>
            <InspectorField
              label={<>Texto alternativo para papel <TechTerm t="paper_label" /></>}
              hint="Reemplaza el texto solo en el PDF impreso."
            >
              <input
                type="text"
                value={node.paperLabel ?? ""}
                onChange={(event) => onFieldChange("paper_label", event.target.value)}
                placeholder="Etiqueta para el PDF"
              />
            </InspectorField>
            <InspectorField
              label={<>Salto impreso <TechTerm t="paper_skip" /></>}
              hint="Instrucción manual; prima sobre la inferencia automática."
            >
              <input
                type="text"
                value={node.paperSkip ?? ""}
                onChange={(event) => onFieldChange("paper_skip", event.target.value)}
                placeholder="Ej. IR A LA PREGUNTA 117"
              />
            </InspectorField>
            <InspectorField
              label={<>Grupo / matriz en papel <TechTerm t="paper_group" /></>}
              hint="Mismo valor en varias filas = se imprimen como matriz."
            >
              <input
                type="text"
                value={node.paperGroup ?? ""}
                onChange={(event) => onFieldChange("paper_group", event.target.value)}
                placeholder="Ej. p104_servicios"
              />
            </InspectorField>
            <InspectorField
              label={<>Layout de papel <TechTerm t="paper_layout" /></>}
              hint="full, wide, matrix o compact. Vacío = automático."
            >
              <input
                type="text"
                value={node.paperLayout ?? ""}
                onChange={(event) => onFieldChange("paper_layout", event.target.value)}
                placeholder="full"
                spellCheck={false}
              />
            </InspectorField>
          </InspectorBlock>

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
                <strong>Solo lectura <TechTerm t="read_only" /></strong>
                <em>Se muestra el valor pero no se puede modificar.</em>
              </span>
            </label>
          </InspectorBlock>

          <InspectorBlock>
            <InspectorField
              label={<>Mensaje cuando es obligatoria <TechTerm t="required_message" /></>}
              hint="Se muestra al intentar avanzar sin responder."
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
          label={<>Parámetros técnicos <TechTerm t="parameters" /></>}
          hint="Atributos crudos del XLSForm; cámbialos solo si hace falta."
        >
          <input
            type="text"
            className="pulso-xfi-mono"
            value={(node as BuilderNode & { parameters?: string }).parameters ?? ""}
            onChange={(event) => onFieldChange("parameters", event.target.value)}
            placeholder="Ej. randomize=true seed=42"
            spellCheck={false}
          />
        </InspectorField>
      </InspectorBlock>
    </div>
  );
}
