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

import { Star } from "lucide-react";
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

      {/* Las filas `calculate` son campos automáticos: la fórmula es su
          característica principal, no algo "avanzado". Por eso vive en
          Básico (no en Lógica) — coincide con cómo el usuario las piensa
          ("este campo se calcula con X", no "este campo tiene lógica X"). */}
      {node.kind === "calculate" && (
        <InspectorBlock>
          <InspectorField
            label="Cómo se calcula"
            hint="Fórmula que el sistema evalúa para llenar este campo. Usa ${variable} para referenciar otras preguntas."
          >
            <textarea
              rows={3}
              value={node.calculation}
              onChange={(event) => onFieldChange("calculation", event.target.value)}
              placeholder="Ej. ${edad} * 12  ·  if(${respuesta}='si', 1, 0)"
              spellCheck={false}
              style={{ fontFamily: "ui-monospace, monospace", fontSize: 13 }}
            />
          </InspectorField>
        </InspectorBlock>
      )}

      {isQuestionLike && node.kind === "question" && (
        <InspectorBlock>
          <label
            className={`pulso-inspector-toggle pulso-inspector-required-toggle ${
              node.required ? "is-on" : ""
            }`}
          >
            <input
              type="checkbox"
              checked={node.required}
              onChange={(event) => onRequiredChange(event.target.checked)}
            />
            <span className="pulso-inspector-required-icon" aria-hidden="true">
              <Star
                size={14}
                fill={node.required ? "currentColor" : "none"}
                strokeWidth={1.6}
              />
            </span>
            <span>
              <strong>Pregunta obligatoria</strong>
              <em>
                Aparece marcada con <span aria-hidden="true">★</span> en la
                estructura del cuestionario.
              </em>
            </span>
          </label>
        </InspectorBlock>
      )}
    </div>
  );
}
