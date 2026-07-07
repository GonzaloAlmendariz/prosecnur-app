// =============================================================================
// inspector/BasicTab.tsx — características de la pregunta
// =============================================================================
// Edita los campos que definen una pregunta:
//   - Tipo de respuesta (TypePicker)
//   - Texto visible (label)
//   - Pista (hint)
//   - Obligatoria (required)
//   - Identificador interno (name)
//   - Catálogo asignado (si es select)
//
// Las opciones de un select_one/multiple se editan en el lienzo
// (`canvas/EditableChoiceList`); aquí solo se muestra el chip del
// catálogo asignado para reasignarlo si hace falta.
// =============================================================================

import { useState } from "react";
import { Info } from "lucide-react";
import { IconRequired } from "../../../lib/icons";
import TechTerm from "../helpers/TechTerm";
import type { BuilderNode, CatalogSummary } from "../types";
import type { LogicScope } from "../logic";
import type { ConditionalContext } from "./ContextPanel";
import { TypePicker } from "./TypePicker";
import { NameField } from "./NameField";
import { CatalogChip } from "./CatalogChip";
import { CalculationBuilder } from "./logic/CalculationBuilder";
import { InspectorField, InspectorBlock } from "./InspectorPrimitives";
import { MarkdownField } from "./MarkdownField";

export type BasicTabProps = {
  node: BuilderNode;
  catalogs: CatalogSummary[];
  /** Scope de lógica — necesario para el `CalculationBuilder` cuando la
   *  fila es `calculate` (la fórmula vive aquí, no en Lógica). */
  logicScope: LogicScope;
  /** Cuántas preguntas usan el catálogo asignado (incluyendo esta). */
  catalogUsageCount?: number;
  /** Relevant propio + relevants heredados de secciones padre. Si la
   *  pregunta tiene `required` Y al menos un relevant en la cadena,
   *  mostramos el aviso "obligatorio condicionado". */
  conditionalContext?: ConditionalContext | null;
  onFieldChange: (field: string, value: string) => void;
  onTypeChange: (next: string) => void;
  onRequiredChange: (checked: boolean) => void;
  onCatalogAssign: (listName: string) => void;
  onCatalogCreate: () => void;
  onOpenCatalogLens: (focusListName: string) => void;
  /** Clona el catálogo asignado a un listName nuevo solo para esta
   *  pregunta. Usado cuando el catálogo compartido debe divergir. */
  onCloneCatalog?: () => void;
};

export function BasicTab({
  node,
  catalogs,
  logicScope,
  catalogUsageCount,
  conditionalContext,
  onFieldChange,
  onTypeChange,
  onRequiredChange,
  onCatalogAssign,
  onCatalogCreate,
  onOpenCatalogLens,
  onCloneCatalog,
}: BasicTabProps) {
  const isSection = node.kind === "section" || node.kind === "repeat";
  const isQuestionLike =
    node.kind === "question" || node.kind === "note" || node.kind === "calculate";
  const isSelect =
    node.typeInfo.base === "select_one" || node.typeInfo.base === "select_multiple";
  const isSharedCatalog = isSelect && (catalogUsageCount ?? 1) > 1;
  const hasCondition =
    !!conditionalContext &&
    (conditionalContext.selfRelevant.length > 0 ||
      conditionalContext.ancestorRelevants.length > 0);
  const [conditionExplainOpen, setConditionExplainOpen] = useState(false);

  return (
    <div className="pulso-inspector-tab">
      {/* Tipo arriba: es lo primero que el usuario decide al crear una
          pregunta nueva. Antes estaba en el segundo bloque, lo que
          hacía que el flujo "creo pregunta → cambio el tipo → escribo
          el label" no fuera lineal. */}
      {!isSection && (
        <InspectorBlock>
          <InspectorField
            label={<>Tipo de respuesta <TechTerm t="type" /></>}
            hint="Cómo va a contestar el encuestado."
          >
            <TypePicker value={node.typeInfo.base} onChange={onTypeChange} />
          </InspectorField>
        </InspectorBlock>
      )}

      <InspectorBlock>
        <InspectorField
          label={
            isSection ? (
              <>Título de la sección <TechTerm t="label" /></>
            ) : (
              <>Texto que ve el encuestado <TechTerm t="label" /></>
            )
          }
          hint={isSection ? "Cabecera del bloque." : "Usa la barra para dar formato."}
        >
          <MarkdownField
            value={node.label}
            onChange={(next) => onFieldChange("label", next)}
            placeholder="Ej. ¿Cuál es tu edad?"
            rows={2}
          />
        </InspectorField>

        {!isSection && (
          <InspectorField
            label={<>Pista o ayuda <TechTerm t="hint" /></>}
            hint="Aclaración corta y opcional bajo el texto."
          >
            <MarkdownField
              value={node.hint}
              onChange={(next) => onFieldChange("hint", next)}
              placeholder="Ej. Indica años cumplidos."
              rows={2}
              compact
            />
          </InspectorField>
        )}
      </InspectorBlock>

      {/* Catálogo: solo aparece si el usuario quiere REASIGNAR la pregunta
          a otra lista existente. Las opciones se editan inline en el
          lienzo (canvas/EditableChoiceList) — sería duplicado mostrarlo
          aquí también. */}

      {/* Calculate sigue en Básico — la fórmula es su característica principal */}
      {node.kind === "calculate" && (
        <InspectorBlock>
          <CalculationBuilder
            expression={node.calculation}
            scope={logicScope}
            fieldLabel={<>Fórmula de cálculo <TechTerm t="calculation" /></>}
            hint={"Usa ${variable} para referenciar otras preguntas."}
            onChange={(next) => onFieldChange("calculation", next)}
          />
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
              <IconRequired
                size={14}
                strokeWidth={2.4}
                style={{ opacity: node.required ? 1 : 0.35 }}
              />
            </span>
            <span>
              <strong>Pregunta obligatoria <TechTerm t="required" /></strong>
              <em>No se puede avanzar sin responderla.</em>
            </span>
          </label>

          {/* Aviso "obligatorio condicionado" — la pregunta es required
              pero solo aplica a quienes cumplan la condición de apertura
              (de la pregunta misma o de una sección padre). Click expande
              la explicación con las condiciones concretas. */}
          {node.required && hasCondition && (
            <div className="pulso-inspector-conditional-required">
              <button
                type="button"
                className="pulso-inspector-conditional-required-trigger"
                onClick={() => setConditionExplainOpen((v) => !v)}
                aria-expanded={conditionExplainOpen}
              >
                <Info size={12} />
                <span>Obligatoria condicionada</span>
              </button>
              {conditionExplainOpen && (
                <div className="pulso-inspector-conditional-required-body">
                  <p>
                    Obligatoria <strong>solo si se cumple la condición de apertura</strong>.
                  </p>
                  {conditionalContext?.selfRelevant && (
                    <div className="pulso-inspector-conditional-required-rule">
                      <span>Aparece cuando</span>
                      <code>{conditionalContext.selfRelevant}</code>
                    </div>
                  )}
                  {conditionalContext?.ancestorRelevants.map((a, i) => (
                    <div
                      key={`${a.sectionLabel}-${i}`}
                      className="pulso-inspector-conditional-required-rule"
                    >
                      <span>Sección «{a.sectionLabel}» aparece cuando</span>
                      <code>{a.relevant}</code>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </InspectorBlock>
      )}

      <InspectorBlock>
        <InspectorField
          label={<>Nombre interno <TechTerm t="name" /></>}
          hint="Identifica a la pregunta en la lógica y el export."
        >
          <NameField
            value={node.name}
            onChange={(next) => onFieldChange("name", next)}
            placeholder="Ej. p1_edad"
          />
        </InspectorField>

        {!isSection && isSelect && (
          <InspectorField
            label={<>Lista de opciones <TechTerm t="list_name" /></>}
            hint="Reasigna para reusar una lista existente."
          >
            <CatalogChip
              assignedListName={node.typeInfo.listName}
              catalogs={catalogs}
              onAssign={onCatalogAssign}
              onCreate={onCatalogCreate}
              onOpenLens={onOpenCatalogLens}
            />
          </InspectorField>
        )}

        {!isSection && isSharedCatalog && onCloneCatalog && (
          <InspectorField
            label="Divergir de la lista compartida"
            hint="Para cuando esta pregunta necesita opciones distintas."
          >
            <button
              type="button"
              className="pulso-inspector-clone-btn"
              onClick={onCloneCatalog}
            >
              Crear copia solo para esta pregunta
            </button>
          </InspectorField>
        )}
      </InspectorBlock>
    </div>
  );
}
