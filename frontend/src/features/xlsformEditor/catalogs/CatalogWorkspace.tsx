// =============================================================================
// catalogs/CatalogWorkspace.tsx — editor del catálogo activo dentro del lens
// =============================================================================
// Reemplaza al `CatalogWorkspace` inline del monolito legacy. Mejoras:
//
//   1. Header sticky con renombre, conteo de opciones y botón "+ Opción".
//   2. Búsqueda por label/code para listas largas (RMS tiene 231 opciones).
//   3. Drag-drop con @dnd-kit para reordenar opciones (estandar y accesible).
//   4. Pista de "usado en N preguntas" — refuerza el impacto de cambios.
//   5. Estado vacío explicativo si el catálogo no tiene opciones todavía.
// =============================================================================

import { useMemo, useState } from "react";
import { ListChecks, Plus, Search, Trash2 } from "lucide-react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { CatalogSummary } from "../types";
import { SortableChoiceRow } from "./SortableChoiceRow";

export type CatalogWorkspaceProps = {
  catalog: CatalogSummary | null;
  /** Número de preguntas que usan este catálogo (vía select_one/multiple). */
  usageCount: number;
  onRename: (currentListName: string, nextListName: string) => void;
  onAddChoice: (listName: string) => void;
  onChoiceChange: (rowIndex: number, field: "name" | "label", value: string) => void;
  onChoiceRemove: (rowIndex: number) => void;
  /** Reordena la opción `from` para que quede antes de la opción `to`. */
  onChoiceMove: (listName: string, fromRowIndex: number, toRowIndex: number) => void;
  /** Borra el catálogo completo. Solo habilitado si `usageCount === 0`. */
  onDeleteCatalog: (listName: string) => void;
};

export function CatalogWorkspace({
  catalog,
  usageCount,
  onRename,
  onAddChoice,
  onChoiceChange,
  onChoiceRemove,
  onChoiceMove,
  onDeleteCatalog,
}: CatalogWorkspaceProps) {
  const [query, setQuery] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const filteredItems = useMemo(() => {
    if (!catalog) return [];
    const q = query.trim().toLowerCase();
    if (!q) return catalog.items;
    return catalog.items.filter((item) => {
      return (
        item.label.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q)
      );
    });
  }, [catalog, query]);

  if (!catalog) {
    return (
      <div className="pulso-catalogworkspace pulso-catalogworkspace-empty">
        <ListChecks size={20} />
        <strong>Selecciona un catálogo</strong>
        <span>Elige una lista de la columna izquierda para editar sus opciones.</span>
      </div>
    );
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    onChoiceMove(catalog.listName, Number(active.id), Number(over.id));
  };

  const showSearch = catalog.items.length >= 12;
  const totalCount = catalog.items.length;
  const filteredCount = filteredItems.length;
  const isFiltered = query.trim().length > 0;

  return (
    <div className="pulso-catalogworkspace">
      <header className="pulso-catalogworkspace-header">
        <div className="pulso-catalogworkspace-headertop">
          <input
            type="text"
            value={catalog.listName}
            onChange={(event) => onRename(catalog.listName, event.target.value)}
            className="pulso-catalogworkspace-name"
            spellCheck={false}
            aria-label="Nombre del catálogo"
          />
          <button
            type="button"
            onClick={() => onAddChoice(catalog.listName)}
            className="pulso-catalogworkspace-add"
          >
            <Plus size={13} /> Opción
          </button>
        </div>
        <div className="pulso-catalogworkspace-meta">
          <span>
            {totalCount} {totalCount === 1 ? "opción" : "opciones"}
          </span>
          <span>·</span>
          <span>
            {usageCount === 0
              ? "Sin uso todavía"
              : usageCount === 1
                ? "Usado en 1 pregunta"
                : `Usado en ${usageCount} preguntas`}
          </span>
          {usageCount === 0 && (
            <button
              type="button"
              className="pulso-catalogworkspace-delete"
              onClick={() => onDeleteCatalog(catalog.listName)}
              title="Borrar catálogo (sin uso)"
            >
              <Trash2 size={11} /> Borrar catálogo
            </button>
          )}
        </div>
      </header>

      {showSearch && (
        <div className="pulso-catalogworkspace-search">
          <Search size={13} style={{ color: "var(--pulso-text-soft)" }} />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar opción..."
            spellCheck={false}
          />
          {isFiltered && (
            <span className="pulso-catalogworkspace-search-count">
              {filteredCount} de {totalCount}
            </span>
          )}
        </div>
      )}

      {totalCount === 0 ? (
        <div className="pulso-catalogworkspace-emptylist">
          <strong>Catálogo vacío</strong>
          <span>
            Agrega la primera opción con el botón <code>+ Opción</code> arriba.
            Las opciones aparecen aquí en el mismo orden que verá el encuestado.
          </span>
        </div>
      ) : filteredCount === 0 ? (
        <div className="pulso-catalogworkspace-emptylist">
          <span>
            Ninguna opción coincide con <em>{query}</em>.
          </span>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={filteredItems.map((item) => item.rowIndex)}
            strategy={verticalListSortingStrategy}
          >
            <div className="pulso-catalogworkspace-list">
              {filteredItems.map((choice, index) => {
                // Si no hay filtro, position es el índice + 1 dentro del
                // catálogo. Si hay filtro, mostramos el índice original.
                const realIndex = catalog.items.findIndex(
                  (item) => item.rowIndex === choice.rowIndex,
                );
                const position = realIndex >= 0 ? realIndex + 1 : index + 1;
                return (
                  <SortableChoiceRow
                    key={choice.rowIndex}
                    choice={choice}
                    position={position}
                    onLabelChange={(value) => onChoiceChange(choice.rowIndex, "label", value)}
                    onNameChange={(value) => onChoiceChange(choice.rowIndex, "name", value)}
                    onRemove={() => onChoiceRemove(choice.rowIndex)}
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
