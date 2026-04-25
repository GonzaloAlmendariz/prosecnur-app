// =============================================================================
// inspector/BasicTab.tsx — primera tab del inspector: lo esencial
// =============================================================================
// Edita los campos que el 95% de las preguntas necesita:
//   - Texto visible (label)
//   - Pista (hint)
//   - Identificador interno (name)
//   - Tipo de respuesta (TypePicker)
//   - Si es select: chip de catálogo asignado (NO se editan opciones aquí)
//   - Obligatoria (required)
//
// La edición de catálogos no vive acá: el chip lleva al CatalogsContextLens.
// =============================================================================

import type { BuilderNode, CatalogSummary } from "../types";
import { TypePicker } from "./TypePicker";
import { NameField } from "./NameField";
import { CatalogChip } from "./CatalogChip";
import { InspectorField, InspectorBlock } from "./InspectorPrimitives";

export type BasicTabProps = {
  node: BuilderNode;
  catalogs: CatalogSummary[];
  onFieldChange: (field: string, value: string) => void;
  onTypeChange: (next: string) => void;
  onRequiredChange: (checked: boolean) => void;
  onCatalogAssign: (listName: string) => void;
  onCatalogCreate: () => void;
  onOpenCatalogLens: (focusListName: string) => void;
};

export function BasicTab({
  node,
  catalogs,
  onFieldChange,
  onTypeChange,
  onRequiredChange,
  onCatalogAssign,
  onCatalogCreate,
  onOpenCatalogLens,
}: BasicTabProps) {
  const isSection = node.kind === "section" || node.kind === "repeat";
  const isQuestionLike =
    node.kind === "question" || node.kind === "note" || node.kind === "calculate";
  const isSelect =
    node.typeInfo.base === "select_one" || node.typeInfo.base === "select_multiple";

  return (
    <div className="pulso-inspector-tab">
      <InspectorBlock>
        <InspectorField
          label={isSection ? "Título de la sección" : "Texto que ve el encuestado"}
          hint={
            isSection
              ? "Aparece como cabecera del bloque."
              : "Se muestra arriba del control."
          }
        >
          <textarea
            rows={2}
            value={node.label}
            onChange={(event) => onFieldChange("label", event.target.value)}
            placeholder="Ej. ¿Cuál es tu edad?"
          />
        </InspectorField>

        {!isSection && (
          <InspectorField
            label="Pista o ayuda"
            hint="Texto pequeño debajo del label. Opcional."
          >
            <textarea
              rows={2}
              value={node.hint}
              onChange={(event) => onFieldChange("hint", event.target.value)}
              placeholder="Ej. Indica años cumplidos."
            />
          </InspectorField>
        )}
      </InspectorBlock>

      <InspectorBlock>
        <InspectorField
          label="Identificador interno"
          hint="Solo letras, números y guion bajo. Empieza con letra."
        >
          <NameField
            value={node.name}
            onChange={(next) => onFieldChange("name", next)}
            placeholder="Ej. p1_edad"
          />
        </InspectorField>

        {!isSection && (
          <InspectorField
            label="Tipo de respuesta"
            hint="Cómo responderá el encuestado."
          >
            <TypePicker value={node.typeInfo.base} onChange={onTypeChange} />
          </InspectorField>
        )}
      </InspectorBlock>

      {!isSection && isSelect && (
        <InspectorBlock>
          <InspectorField
            label="Catálogo de opciones"
            hint="Asigna una lista de respuestas posibles. Edítala desde el panel de catálogos."
          >
            <CatalogChip
              assignedListName={node.typeInfo.listName}
              catalogs={catalogs}
              onAssign={onCatalogAssign}
              onCreate={onCatalogCreate}
              onOpenLens={onOpenCatalogLens}
            />
          </InspectorField>
        </InspectorBlock>
      )}

      {isQuestionLike && node.kind === "question" && (
        <InspectorBlock>
          <label className="pulso-inspector-toggle">
            <input
              type="checkbox"
              checked={node.required}
              onChange={(event) => onRequiredChange(event.target.checked)}
            />
            <span>
              <strong>Pregunta obligatoria</strong>
              <em>El encuestado no puede avanzar sin responderla.</em>
            </span>
          </label>
        </InspectorBlock>
      )}
    </div>
  );
}
