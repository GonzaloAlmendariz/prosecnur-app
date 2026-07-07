// =============================================================================
// canvas/EditableQuestionCard.tsx — card editable inline para el lienzo único
// =============================================================================
// Hereda el render visual de `PreviewQuestionCard` pero hace que label, hint
// y opciones sean editables in-place. Cuando el usuario hace click en un
// label tipea y al perder foco dispara `onLabelChange`. Lo mismo para hint.
//
// El switch por tipo vive en `previewInputs.tsx` (compartido con la card de
// solo lectura). Para `select_one`/`select_multiple` esta card inyecta su
// `EditableChoiceList` vía `choiceSlot` — las opciones se editan inline al
// lado de la pregunta, sin abrir el editor de catálogos.
// =============================================================================

import type { CSSProperties, ReactNode } from "react";
import { IconConditionalLogic, IconRequired } from "../../../lib/icons";
import type { BuilderNode, ChoiceItem } from "../types";
import { iconForType } from "../helpers/icons";
import { paletteForType, paletteSoftForType } from "../helpers/paletteForType";
import { RichInline } from "../helpers/RichInline";
import { TechTerm } from "../helpers/TechTerm";
import { typeLabel } from "../parsing/parseType";
import { EditableChoiceList } from "./EditableChoiceList";
import { PreviewInputForType } from "./previewInputs";

export type EditableQuestionCardProps = {
  node: BuilderNode;
  /** Opciones del catálogo asociado (si es select_one/multiple). */
  choices: ChoiceItem[];
  /** Posición de la pregunta dentro del outline (1-indexed). */
  position?: number;
  /** Si true, esta card es la seleccionada (highlight, action bar). */
  selected?: boolean;
  /** Cuántas preguntas comparten el mismo catálogo (incluyendo esta).
   *  >1 indica que el catálogo es compartido — `EditableChoiceList`
   *  muestra el badge correspondiente. */
  catalogUsageCount?: number;
  /** Otras preguntas que usan la misma lista (NO incluye la actual). */
  sharedWith?: Array<{ rowIndex: number; label: string; name: string }>;
  /** Click en una de las preguntas compartidas → seleccionarla. */
  onSelectSharedQuestion?: (rowIndex: number) => void;
  /** Click en cualquier parte de la card → seleccionar. */
  onSelect: () => void;
  /** Edits inline. */
  onLabelChange: (value: string) => void;
  onHintChange: (value: string) => void;
  /** Choice mutations (delegadas a EditableChoiceList). */
  onChoiceLabelChange: (choiceRowIndex: number, value: string) => void;
  onChoiceNameChange: (choiceRowIndex: number, value: string) => void;
  onAddChoice: () => void;
  onRemoveChoice: (choiceRowIndex: number) => void;
  /** Renombrar la lista de opciones asociada a esta pregunta. */
  onRenameList?: (nextListName: string) => void;
  /** Opcional: clonar el catálogo solo para esta pregunta. */
  onCloneCatalog?: () => void;
  /** Acceso al editor de catálogos. */
  onOpenCatalogLens?: () => void;
};

export function EditableQuestionCard({
  node,
  choices,
  position,
  selected,
  catalogUsageCount,
  sharedWith,
  onSelectSharedQuestion,
  onSelect,
  onLabelChange,
  onHintChange,
  onChoiceLabelChange,
  onChoiceNameChange,
  onAddChoice,
  onRemoveChoice,
  onRenameList,
  onCloneCatalog,
  onOpenCatalogLens,
}: EditableQuestionCardProps) {
  const accent = paletteForType(node.typeInfo.base);
  const accentSoft = paletteSoftForType(node.typeInfo.base);
  const Icon = iconForType(node.typeInfo.base);
  const baseType = node.typeInfo.base;
  const baseLabel = typeLabel(baseType);

  // Slot editable: solo para selects locales — el módulo compartido decide
  // dónde ubicarlo (reemplazo de la lista o debajo del mock de appearance).
  const isSelect = baseType === "select_one" || baseType === "select_multiple";
  const choiceSlot: ReactNode = isSelect ? (
    <EditableChoiceList
      items={choices}
      kind={baseType === "select_one" ? "radio" : "check"}
      accent={accent}
      listName={node.typeInfo.listName}
      catalogUsageCount={catalogUsageCount}
      sharedWith={sharedWith}
      onSelectSharedQuestion={onSelectSharedQuestion}
      onLabelChange={onChoiceLabelChange}
      onNameChange={onChoiceNameChange}
      onAdd={onAddChoice}
      onRemove={onRemoveChoice}
      onRenameList={onRenameList}
      onCloneCatalog={onCloneCatalog}
      onOpenCatalogLens={onOpenCatalogLens}
    />
  ) : undefined;

  return (
    <article
      className={`pulso-canvas-card${selected ? " is-selected" : ""}`}
      style={{ "--card-accent": accent, "--card-accent-soft": accentSoft } as CSSProperties}
      onClick={onSelect}
    >
      {/* Header: tipo + posición + obligatoria + condicional */}
      <div className="pulso-canvas-card-header">
        <span className="pulso-canvas-card-typebadge" style={{ color: accent, background: accentSoft }}>
          <Icon size={13} />
          {baseLabel}
          {baseType && baseLabel !== baseType && (
            <TechTerm t={baseType} title={`Tipo XLSForm: ${baseType}`} />
          )}
        </span>
        {position && (
          <span className="pulso-canvas-card-position" title="Posición en el formulario">
            #{position}
          </span>
        )}
        {node.required && (
          <span className="pulso-canvas-card-required" title="Pregunta obligatoria">
            <IconRequired size={11} /> Obligatoria
          </span>
        )}
        {node.relevant && (
          <span className="pulso-canvas-card-conditional" title="Aparece bajo una condición">
            <IconConditionalLogic size={12} /> Condicional
          </span>
        )}
      </div>

      {/* Label + hint editables inline */}
      <div className="pulso-canvas-card-prompt">
        <RichInline
          as="h3"
          className="pulso-canvas-card-label"
          value={node.label}
          onChange={onLabelChange}
          placeholder="Escribe la pregunta…"
          singleLine
          ariaLabel="Texto de la pregunta"
        />
        <RichInline
          as="p"
          className="pulso-canvas-card-hint"
          value={node.hint || ""}
          onChange={onHintChange}
          placeholder="Pista opcional para el encuestador (no obligatoria)"
          singleLine
          ariaLabel="Pista de la pregunta"
        />
      </div>

      {/* Input fiel al tipo */}
      <div className="pulso-canvas-card-input" onClick={(e) => e.stopPropagation()}>
        <PreviewInputForType node={node} choices={choices} accent={accent} choiceSlot={choiceSlot} />
      </div>

      {node.name && (
        <footer className="pulso-canvas-card-footer">
          <span className="pulso-canvas-card-fieldname">
            <code>{node.name}</code>
          </span>
        </footer>
      )}
    </article>
  );
}
