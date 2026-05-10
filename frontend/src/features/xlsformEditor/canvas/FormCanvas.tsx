// =============================================================================
// canvas/FormCanvas.tsx — lienzo único scrollable con TODO el formulario
// =============================================================================
// El centro del editor. Reemplaza al `PreviewCanvas` (que mostraba una sola
// pregunta) por una vista completa donde se ve la encuesta tal como la verá
// el encuestador, pero con cada pieza editable inline:
//
//   · `SectionHeader` para cada begin_group / begin_repeat — título
//     editable, conteo, toggle colapsar.
//   · `EditableQuestionCard` para cada pregunta — label/hint/opciones
//     editables, sin abrir paneles.
//   · `AddBetween` (botón "+") entre cards y al final del scroll.
//
// La selección activa (`selection`) marca qué card resalta, y al hacer
// click en una card o sección dispara `onSelect` para que el panel
// derecho refleje su contexto (lógica, validación, tipo).
// =============================================================================

import { useEffect, useRef, useState } from "react";
import type { BuilderNode, BuilderStructure, ChoiceItem, XlsformEditorWorkbook } from "../types";
import { extractChoiceItems } from "../parsing/buildIndex";
import { SectionHeader } from "./SectionHeader";
import { EditableQuestionCard } from "./EditableQuestionCard";
import { AddBetween } from "./AddBetween";

export type FormCanvasProps = {
  workbook: XlsformEditorWorkbook;
  structure: BuilderStructure;
  /** rowIndex de la fila seleccionada, si aplica. */
  selectedRow: number | null;
  /** Catalog usage map: cuántas preguntas usan cada listName. */
  catalogUsage: Map<string, number>;
  /** Por cada listName, las preguntas que lo usan. Se usa para el badge
   *  "lista compartida" del card que lista las preguntas afectadas. */
  questionsByCatalog?: Map<string, Array<{ rowIndex: number; label: string; name: string }>>;
  onSelect: (rowIndex: number) => void;
  /** Edits inline. */
  onLabelChange: (rowIndex: number, value: string) => void;
  onHintChange: (rowIndex: number, value: string) => void;
  onSectionLabelChange: (rowIndex: number, value: string) => void;
  /** Choice mutations. */
  onChoiceLabelChange: (listName: string, choiceRowIndex: number, value: string) => void;
  onChoiceNameChange: (listName: string, choiceRowIndex: number, value: string) => void;
  onAddChoice: (listName: string) => void;
  onRemoveChoice: (listName: string, choiceRowIndex: number) => void;
  /** Renombrar la lista entera (catálogo). Toca todas las preguntas
   *  que la usan + la hoja choices. */
  onRenameList: (oldListName: string, nextListName: string) => void;
  onCloneCatalog: (questionRowIndex: number) => void;
  /** Inserciones desde el AddBetween. `reuseListName` solo aplica para
   *  select_one/select_multiple — vincula la pregunta nueva a una lista
   *  existente en lugar de crear una. */
  onAddAfter: (
    rowIndex: number | null,
    kind: "section" | "text" | "select_one" | "select_multiple" | "integer" | "date" | "note" | "calculate",
    reuseListName?: string,
  ) => void;
  /** Listas existentes que el AddBetween ofrece reusar al crear un select. */
  existingLists?: Array<{ listName: string; choicesCount: number; usageCount: number }>;
  /** Acceso al editor avanzado de catálogos. */
  onOpenCatalogLens: (listName: string) => void;
};

export function FormCanvas({
  workbook,
  structure,
  selectedRow,
  catalogUsage,
  questionsByCatalog,
  onSelect,
  onLabelChange,
  onHintChange,
  onSectionLabelChange,
  onChoiceLabelChange,
  onChoiceNameChange,
  onAddChoice,
  onRemoveChoice,
  onRenameList,
  onCloneCatalog,
  onAddAfter,
  existingLists,
  onOpenCatalogLens,
}: FormCanvasProps) {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const toggleSection = (sectionId: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  // Cuando cambia la selección desde fuera (ej. click en outline), scroll a
  // la card correspondiente.
  const cardRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());
  useEffect(() => {
    if (selectedRow == null) return;
    const el = cardRefs.current.get(selectedRow);
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [selectedRow]);

  // Determinar qué nodos del outline están dentro de una sección colapsada.
  // Recorremos el outline y, cuando encontramos un section header colapsado,
  // saltamos hasta su `endRowIndex`.
  const renderItems: Array<{ kind: "node" | "addBetween" | "trailing"; node?: BuilderNode; afterRow?: number | null }> = [];
  const outline = structure.outline;
  let i = 0;
  while (i < outline.length) {
    const node = outline[i];

    // Si este nodo es una sección colapsada, saltar todo su contenido.
    if ((node.kind === "section" || node.kind === "repeat") && collapsedSections.has(node.sectionId)) {
      const span = structure.spans.get(node.rowIndex);
      // Renderizamos el header pero saltamos los hijos.
      renderItems.push({ kind: "node", node });
      // Avanzar `i` hasta saltar todo el span. `outline` puede tener entries
      // entre el begin y el end — encontrar el siguiente índice fuera del rango.
      const endRow = span?.end ?? node.rowIndex;
      let j = i + 1;
      while (j < outline.length && outline[j].rowIndex <= endRow) j++;
      // Antes de avanzar, pongamos un AddBetween después del header colapsado.
      renderItems.push({ kind: "addBetween", afterRow: endRow });
      i = j;
      continue;
    }

    renderItems.push({ kind: "node", node });
    // No metemos AddBetween después de begin_group/begin_repeat — el primer
    // hijo siempre es la primera pregunta de adentro. Sí lo metemos después
    // de question/note/calculate.
    if (node.kind === "question" || node.kind === "note" || node.kind === "calculate") {
      renderItems.push({ kind: "addBetween", afterRow: node.rowIndex });
    }
    i++;
  }

  // Trailing add (al final).
  renderItems.push({ kind: "trailing" });

  // Empty state: si el outline NO tiene contenido editable (solo
  // auto-meta como _start/_end/_today, sin secciones ni preguntas),
  // mostramos un placeholder grande que guía al usuario a crear su
  // primera sección. Mucho mejor que un lienzo en blanco con un solo
  // botón "+" perdido.
  const hasEditableContent = outline.some(
    (n) =>
      n.kind === "section" ||
      n.kind === "repeat" ||
      // questions reales (no auto-meta como _start/_end/today/etc).
      ((n.kind === "question" || n.kind === "note" || n.kind === "calculate") &&
        !["start", "end", "today", "deviceid", "username"].includes(n.typeInfo.base)),
  );

  if (!hasEditableContent) {
    return (
      <div className="pulso-form-canvas">
        <FormCanvasEmptyState onAddSection={() => onAddAfter(null, "section")} />
      </div>
    );
  }

  return (
    <div className="pulso-form-canvas">
      {renderItems.map((it, idx) => {
        if (it.kind === "trailing") {
          return (
            <div key={`trailing-${idx}`} className="pulso-form-canvas-trailing">
              <AddBetween
                onAdd={(k, reuseListName) => onAddAfter(null, k, reuseListName)}
                existingLists={existingLists}
                alwaysVisible
                variant="trailing"
              />
            </div>
          );
        }
        if (it.kind === "addBetween") {
          return (
            <AddBetween
              key={`add-${it.afterRow}`}
              onAdd={(k, reuseListName) => onAddAfter(it.afterRow ?? null, k, reuseListName)}
              existingLists={existingLists}
              variant="between"
            />
          );
        }
        const node = it.node!;
        if (node.kind === "section" || node.kind === "repeat") {
          const meta = structure.sections.get(node.sectionId);
          const childCount = meta?.itemCount ?? 0;
          const collapsed = collapsedSections.has(node.sectionId);
          return (
            <div
              key={`row-${node.rowIndex}`}
              ref={(el) => {
                if (el) cardRefs.current.set(node.rowIndex, el);
              }}
            >
              <SectionHeader
                label={node.label}
                name={node.name}
                kind={node.kind}
                depth={node.depth}
                childCount={childCount}
                hasRelevant={!!node.relevant}
                selected={selectedRow === node.rowIndex}
                collapsed={collapsed}
                onSelect={() => onSelect(node.rowIndex)}
                onToggleCollapsed={() => toggleSection(node.sectionId)}
                onLabelChange={(v) => onSectionLabelChange(node.rowIndex, v)}
              />
            </div>
          );
        }

        const choices: ChoiceItem[] =
          node.typeInfo.listName && workbook.choices
            ? extractChoiceItems(workbook.choices, node.typeInfo.listName)
            : [];
        const usage = node.typeInfo.listName ? catalogUsage.get(node.typeInfo.listName) ?? 1 : 1;
        const sharedWith = node.typeInfo.listName
          ? (questionsByCatalog?.get(node.typeInfo.listName) ?? []).filter(
              (q) => q.rowIndex !== node.rowIndex,
            )
          : [];
        const position = computePosition(structure, node.rowIndex);

        return (
          <div
            key={`row-${node.rowIndex}`}
            ref={(el) => {
              if (el) cardRefs.current.set(node.rowIndex, el);
            }}
            className="pulso-form-canvas-card-wrapper"
            style={{ paddingLeft: 4 + node.depth * 16 }}
          >
            <EditableQuestionCard
              node={node}
              choices={choices}
              position={position ?? undefined}
              selected={selectedRow === node.rowIndex}
              catalogUsageCount={usage}
              sharedWith={sharedWith}
              onSelectSharedQuestion={onSelect}
              onSelect={() => onSelect(node.rowIndex)}
              onLabelChange={(v) => onLabelChange(node.rowIndex, v)}
              onHintChange={(v) => onHintChange(node.rowIndex, v)}
              onChoiceLabelChange={(choiceRow, v) =>
                node.typeInfo.listName && onChoiceLabelChange(node.typeInfo.listName, choiceRow, v)
              }
              onChoiceNameChange={(choiceRow, v) =>
                node.typeInfo.listName && onChoiceNameChange(node.typeInfo.listName, choiceRow, v)
              }
              onAddChoice={() =>
                node.typeInfo.listName && onAddChoice(node.typeInfo.listName)
              }
              onRemoveChoice={(choiceRow) =>
                node.typeInfo.listName && onRemoveChoice(node.typeInfo.listName, choiceRow)
              }
              onRenameList={
                node.typeInfo.listName
                  ? (nextListName) => onRenameList(node.typeInfo.listName, nextListName)
                  : undefined
              }
              onCloneCatalog={() => onCloneCatalog(node.rowIndex)}
              onOpenCatalogLens={
                node.typeInfo.listName
                  ? () => onOpenCatalogLens(node.typeInfo.listName)
                  : undefined
              }
            />
          </div>
        );
      })}
    </div>
  );
}

// -----------------------------------------------------------------------------

function computePosition(structure: BuilderStructure, rowIndex: number): number | null {
  let count = 0;
  for (const n of structure.outline) {
    if (n.kind === "question" || n.kind === "note" || n.kind === "calculate") {
      count += 1;
    }
    if (n.rowIndex === rowIndex) {
      if (n.kind === "question" || n.kind === "note" || n.kind === "calculate") return count;
      return null;
    }
  }
  return null;
}

// -----------------------------------------------------------------------------
// FormCanvasEmptyState — placeholder grande para form sin contenido editable
// -----------------------------------------------------------------------------

function FormCanvasEmptyState({ onAddSection }: { onAddSection: () => void }) {
  return (
    <div className="pulso-form-canvas-empty">
      <svg
        width="120"
        height="120"
        viewBox="0 0 120 120"
        aria-hidden="true"
        className="pulso-form-canvas-empty-illustration"
      >
        {/* Carpeta esquemática con líneas que sugieren secciones — sin
            mostrar Excel, una metáfora limpia de "agrupar preguntas". */}
        <rect
          x="20" y="36" width="80" height="60" rx="6"
          fill="white" stroke="#0f766e" strokeWidth="2"
        />
        <path
          d="M 20 42 L 40 42 L 46 36 L 100 36"
          fill="none" stroke="#0f766e" strokeWidth="2" strokeLinejoin="round"
        />
        {/* Líneas internas que sugieren preguntas */}
        <line x1="32" y1="60" x2="72" y2="60" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="32" y1="72" x2="84" y2="72" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="32" y1="84" x2="60" y2="84" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />
        {/* + flotante en la esquina inferior derecha */}
        <circle cx="100" cy="96" r="14" fill="#0f766e" />
        <line x1="94" y1="96" x2="106" y2="96" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="100" y1="90" x2="100" y2="102" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <h3 className="pulso-form-canvas-empty-title">
        Tu formulario está vacío
      </h3>
      <p className="pulso-form-canvas-empty-text">
        Empieza creando una <strong>sección</strong>. Las secciones agrupan
        preguntas relacionadas — por ejemplo: <em>Datos del informante</em>,
        <em> Composición del hogar</em>, <em>Características de la vivienda</em>.
      </p>
      <p className="pulso-form-canvas-empty-text-secondary">
        Después de crear la sección, agregas las preguntas dentro con el
        botón <code>+ Pregunta</code>.
      </p>
      <button
        type="button"
        className="pulso-form-canvas-empty-cta"
        onClick={onAddSection}
      >
        Crear primera sección
      </button>
    </div>
  );
}
