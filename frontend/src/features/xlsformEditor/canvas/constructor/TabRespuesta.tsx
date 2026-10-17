// Pestaña «Respuesta» del Constructor: obligatoria, mensaje, cálculo, repetición y lista de opciones.
// Extraída de canvas/FocusedWorkspace.tsx — refactor puro, revamp 2026-10-16.

import { useEffect, useState } from "react";
import { Calculator, CheckCircle2, Info, Repeat, Trash2 } from "lucide-react";
import { IconConditionalLogic, IconRequired } from "../../../../lib/icons";
import type { BuilderNode, CatalogSummary, SectionMeta, XlsformEditorWorkbook } from "../../types";
import { type LogicScope } from "../../logic";
import type { CatalogInfo, ConditionalContext } from "../../inspector/ContextPanel";
import { plural } from "../../shell/editorMetrics";
import { InspectorBlock, InspectorField } from "../../inspector/InspectorPrimitives";
import { TypePicker } from "../../inspector/TypePicker";
import { CatalogChip } from "../../inspector/CatalogChip";
import { CalculationBuilder } from "../../inspector/logic/CalculationBuilder";
import { describeExpression } from "../reglasHumanas";
import { SectionBoundaryControl, fieldMessageLooksTechnical, variableDisplayLabel, FocusFact } from "../constructor/compartido";
import type { SectionBoundaryState } from "../FocusedWorkspace";
import { RequiredControl } from "./ObligatoriaControl";
import { CalculationRecipePanel, RepeatCountPanel } from "./CalculoRepeticionPaneles";

export function ResponseTab({
  node,
  section,
  catalogs,
  logicScope,
  catalogUsageCount,
  catalogInfo,
  conditionalContext,
  sectionBoundary,
  onTypeChange,
  onFieldChange,
  onRequiredChange,
  onCatalogAssign,
  onCatalogCreate,
  onOpenCatalogLens,
  onCloneCatalog,
  onIncludeNextInSection,
  onReleaseLastFromSection,
  onSelectRow,
}: {
  node: BuilderNode;
  section: SectionMeta | null;
  catalogs: CatalogSummary[];
  logicScope: LogicScope;
  catalogUsageCount: number;
  catalogInfo?: CatalogInfo;
  conditionalContext?: ConditionalContext | null;
  sectionBoundary: SectionBoundaryState | null;
  onTypeChange: (next: string) => void;
  onFieldChange: (field: string, value: string) => void;
  onRequiredChange: (checked: boolean) => void;
  onCatalogAssign: (listName: string) => void;
  onCatalogCreate: () => void;
  onOpenCatalogLens: (focusListName: string) => void;
  onCloneCatalog?: () => void;
  onIncludeNextInSection: () => void;
  onReleaseLastFromSection: () => void;
  onSelectRow: (rowIndex: number) => void;
}) {
  const isSection = node.kind === "section" || node.kind === "repeat";
  const isSelect = node.typeInfo.base === "select_one" || node.typeInfo.base === "select_multiple";

  if (isSection) {
    return (
      <div className="pulso-focus-tab-panel">
        <InspectorBlock>
          <div className="pulso-focus-structure-summary">
            <FocusFact label="Bloque" value={node.kind === "repeat" ? "Repetición" : "Sección"} />
            <FocusFact label="Contenido directo" value={plural(section?.itemCount ?? 0, "elemento", "elementos")} />
            <FocusFact label="Padre" value={section?.parentId && section.parentId !== "root" ? section.parentId : "Formulario"} />
          </div>
          <SectionBoundaryControl
            boundary={sectionBoundary}
            onIncludeNext={onIncludeNextInSection}
            onReleaseLast={onReleaseLastFromSection}
          />
        </InspectorBlock>
        {node.kind === "repeat" && (
          <InspectorBlock>
            <RepeatCountPanel
              node={node}
              scope={logicScope}
              onFieldChange={onFieldChange}
            />
          </InspectorBlock>
        )}
      </div>
    );
  }

  return (
    <div className="pulso-focus-tab-panel">
      {node.kind === "calculate" && (
        <InspectorBlock>
          <CalculationRecipePanel
            expression={node.calculation}
            scope={logicScope}
            onFieldChange={onFieldChange}
          />
          <CalculationBuilder
            expression={node.calculation}
            scope={logicScope}
            fieldLabel="Cómo se calcula"
            hint="Fórmula que completa este campo. Usa ${variable} para referenciar otras preguntas."
            onChange={(next) => onFieldChange("calculation", next)}
          />
        </InspectorBlock>
      )}

      <InspectorBlock>
        <InspectorField label="Tipo de respuesta" hint="Cómo va a contestar el encuestado.">
          <TypePicker value={node.typeInfo.base} onChange={onTypeChange} />
        </InspectorField>
      </InspectorBlock>

      {node.kind === "question" && (
        <InspectorBlock>
          <RequiredControl
            node={node}
            conditionalContext={conditionalContext}
            scope={logicScope}
            onRequiredChange={onRequiredChange}
            onFieldChange={onFieldChange}
          />
        </InspectorBlock>
      )}

      {isSelect && (
        <InspectorBlock>
          <InspectorField
            label="Lista de opciones"
            hint="Lista que alimenta esta pregunta. Puedes reusar listas o abrir el editor de listas."
          >
            <CatalogChip
              assignedListName={node.typeInfo.listName}
              catalogs={catalogs}
              onAssign={onCatalogAssign}
              onCreate={onCatalogCreate}
              onOpenLens={onOpenCatalogLens}
            />
          </InspectorField>
          {catalogInfo && (
            <FocusedCatalogInfo
              info={catalogInfo}
              usageCount={catalogUsageCount}
              onOpenLens={() => onOpenCatalogLens(catalogInfo.listName)}
              onSelectRow={onSelectRow}
              onCloneCatalog={onCloneCatalog}
            />
          )}
        </InspectorBlock>
      )}

      {node.kind === "question" && (
        <InspectorBlock>
          <InspectorField
            label="Valor por defecto"
            hint="Respuesta prellenada al abrir la pregunta. Déjalo vacío si el encuestador debe responder desde cero."
          >
            {(campo) => (
              <input
                id={campo.id}
                aria-describedby={campo.hintId}
                type="text"
                value={(node as BuilderNode & { default?: string }).default ?? ""}
                onChange={(event) => onFieldChange("default", event.target.value)}
                placeholder="Opcional"
              />
            )}
          </InspectorField>
        </InspectorBlock>
      )}
    </div>
  );
}

/** Cuántas preguntas que comparten la lista se muestran antes de «Ver las N restantes» (yesno: 33 en el corpus). */
const MAX_COMPARTIDAS = 6;

export function FocusedCatalogInfo({
  info,
  usageCount,
  onOpenLens,
  onSelectRow,
  onCloneCatalog,
}: {
  info: CatalogInfo;
  usageCount: number;
  onOpenLens: () => void;
  onSelectRow: (rowIndex: number) => void;
  onCloneCatalog?: () => void;
}) {
  const [verTodas, setVerTodas] = useState(false);
  return (
    <div className="pulso-focus-catalog-summary">
      <div className="pulso-focus-catalog-summary-grid">
        <FocusFact label="Lista" value={info.listName} code />
        <FocusFact label="Opciones" value={`${info.choicesCount}`} />
        <FocusFact label="Uso" value={`${usageCount} ${usageCount === 1 ? "pregunta" : "preguntas"}`} />
      </div>

      {info.sharedWith.length > 0 && (
        <div className="pulso-focus-shared-list">
          <span className="pulso-section-eyebrow">También usa esta lista</span>
          {(verTodas ? info.sharedWith : info.sharedWith.slice(0, MAX_COMPARTIDAS)).map((question) => (
            <button
              key={question.rowIndex}
              type="button"
              onClick={() => onSelectRow(question.rowIndex)}
            >
              {question.label || question.name || `fila ${question.rowIndex + 1}`}
            </button>
          ))}
          {info.sharedWith.length > MAX_COMPARTIDAS && (
            <button type="button" className="pulso-focus-shared-more" onClick={() => setVerTodas((v) => !v)}>
              {verTodas ? "Ver menos" : `Ver las ${info.sharedWith.length - MAX_COMPARTIDAS} restantes`}
            </button>
          )}
          {onCloneCatalog && (
            <button type="button" className="pulso-focus-link-action" onClick={onCloneCatalog}>
              Crear copia exclusiva
            </button>
          )}
        </div>
      )}

      <button type="button" className="pulso-focus-link-action" onClick={onOpenLens}>
        Abrir editor de listas
      </button>
    </div>
  );
}

export function choiceFilterColumnsFromWorkbook(workbook: XlsformEditorWorkbook | null): string[] {
  if (!workbook) return [];
  const reservedColumns = new Set([
    "list_name",
    "name",
    "label",
    "image",
    "media::image",
    "audio",
    "media::audio",
    "video",
    "media::video",
    "paper_skip",
  ]);

  const candidates = workbook.choices.columns
    .map((column) => column.trim())
    .filter((column) => {
      const normalized = column.toLowerCase();
      return (
        column.length > 0 &&
        !reservedColumns.has(normalized) &&
        !normalized.startsWith("label::") &&
        !normalized.startsWith("image::") &&
        !normalized.startsWith("media::")
      );
    });

  return Array.from(new Set(candidates));
}
