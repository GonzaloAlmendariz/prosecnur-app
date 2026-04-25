// =============================================================================
// inspector/AppearanceTab.tsx — segunda tab: cómo se ve el control
// =============================================================================
// Edita la apariencia (`appearance`) y atributos visuales auxiliares como
// `default` y media (placeholders en F1; preview real en F2).
//
// El concepto de apariencia está oculto en ODK Build pero es el responsable
// directo de cómo se ve la pregunta — exponerlo aquí con pills predefinidos
// hace que el usuario no tenga que memorizar strings.
// =============================================================================

import type { BuilderNode } from "../types";
import { AppearancePicker } from "./AppearancePicker";
import { InspectorBlock, InspectorField } from "./InspectorPrimitives";

export type AppearanceTabProps = {
  node: BuilderNode;
  onFieldChange: (field: string, value: string) => void;
};

export function AppearanceTab({ node, onFieldChange }: AppearanceTabProps) {
  const isSection = node.kind === "section" || node.kind === "repeat";
  const isQuestionLike =
    node.kind === "question" || node.kind === "note" || node.kind === "calculate";

  return (
    <div className="pulso-inspector-tab">
      <InspectorBlock>
        <InspectorField
          label="Apariencia"
          hint="Cómo se renderiza el control en el dispositivo. Puedes combinar varias."
        >
          <AppearancePicker
            baseType={node.typeInfo.base}
            value={node.appearance}
            onChange={(next) => onFieldChange("appearance", next)}
          />
        </InspectorField>
      </InspectorBlock>

      {isQuestionLike && !isSection && (
        <InspectorBlock>
          <InspectorField
            label="Valor por defecto"
            hint="Se mostrará prellenado al abrir la pregunta."
          >
            <input
              type="text"
              value={(node as BuilderNode & { default?: string }).default ?? ""}
              onChange={(event) => onFieldChange("default", event.target.value)}
              placeholder="Opcional"
            />
          </InspectorField>
        </InspectorBlock>
      )}

      <InspectorBlock>
        <InspectorField
          label="Multimedia adjunta"
          hint="Imagen, audio o video que acompañan a la pregunta. Próximamente."
        >
          <div className="pulso-inspector-placeholder">
            La carga de archivos llega en una próxima iteración. Por ahora puedes
            seguir editando los campos `media::image`, `media::audio` y
            `media::video` directamente en el .xlsx — Pulso los conserva al
            exportar.
          </div>
        </InspectorField>
      </InspectorBlock>
    </div>
  );
}
