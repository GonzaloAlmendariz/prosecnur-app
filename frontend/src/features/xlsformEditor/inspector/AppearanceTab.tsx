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
          hint="Imagen, audio o video que acompañan a la consigna. Deben existir en la carpeta media del XLSForm."
        >
          <div className="pulso-inspector-media-fields">
            <input
              type="text"
              value={node.mediaImage ?? ""}
              onChange={(event) => onFieldChange("media::image", event.target.value)}
              placeholder="Imagen: referencia.png"
              spellCheck={false}
            />
            <input
              type="text"
              value={node.mediaAudio ?? ""}
              onChange={(event) => onFieldChange("media::audio", event.target.value)}
              placeholder="Audio: instruccion.mp3"
              spellCheck={false}
            />
            <input
              type="text"
              value={node.mediaVideo ?? ""}
              onChange={(event) => onFieldChange("media::video", event.target.value)}
              placeholder="Video: demostracion.mp4"
              spellCheck={false}
            />
          </div>
        </InspectorField>
      </InspectorBlock>
    </div>
  );
}
