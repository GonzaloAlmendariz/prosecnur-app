// =============================================================================
// inspector/CatalogChip.tsx — chip del catálogo asignado a una pregunta select
// =============================================================================
// Reemplaza al editor inline de catálogos del inspector legacy. Refuerza la
// regla del revamp:
//
//   * En el inspector se ASIGNA un catálogo a la pregunta.
//   * En el `CatalogsContextLens` (modal/lens grande) se EDITAN las opciones.
//
// El chip muestra:
//   - Nombre del catálogo asignado.
//   - Cantidad de opciones (fast feedback).
//   - Botón "Editar →" que abre el lens preposicionado en este catálogo.
//   - Selector inline para cambiar a otro catálogo o crear uno nuevo.
//
// Si la pregunta es select pero no tiene catálogo asignado, mostramos un
// estado "Asignar catálogo" como CTA primario.
// =============================================================================

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ListChecks, PencilLine, Plus } from "lucide-react";
import type { CatalogSummary } from "../types";

export type CatalogChipProps = {
  /** Nombre del catálogo actualmente asignado, o vacío si no hay. */
  assignedListName: string;
  /** Catálogos disponibles en el workbook. */
  catalogs: CatalogSummary[];
  /** Asignar otro catálogo (cambia `type` de la fila). */
  onAssign: (listName: string) => void;
  /** Crear un catálogo nuevo y asignarlo automáticamente. */
  onCreate: () => void;
  /** Abrir el ContextLens de catálogos preposicionado en este catálogo. */
  onOpenLens: (focusListName: string) => void;
};

export function CatalogChip({
  assignedListName,
  catalogs,
  onAssign,
  onCreate,
  onOpenLens,
}: CatalogChipProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!pickerOpen) return;
    const onMouseDown = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) setPickerOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPickerOpen(false);
    };
    const t = setTimeout(() => {
      document.addEventListener("mousedown", onMouseDown);
      document.addEventListener("keydown", onKey);
    }, 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [pickerOpen]);

  const assigned = assignedListName
    ? catalogs.find((catalog) => catalog.listName === assignedListName)
    : null;

  return (
    <div ref={containerRef} className="pulso-catalogchip" style={{ position: "relative" }}>
      {assigned ? (
        <div className="pulso-catalogchip-assigned">
          <span className="pulso-catalogchip-icon">
            <ListChecks size={14} />
          </span>
          <div className="pulso-catalogchip-meta">
            <strong>{assigned.listName}</strong>
            <span>
              {assigned.items.length} {assigned.items.length === 1 ? "opción" : "opciones"}
            </span>
          </div>
          <div className="pulso-catalogchip-actions">
            <button
              type="button"
              className="pulso-catalogchip-edit"
              onClick={() => onOpenLens(assigned.listName)}
              title="Abrir el catálogo para editar sus opciones"
            >
              <PencilLine size={12} /> Editar
            </button>
            <button
              type="button"
              className="pulso-catalogchip-switch"
              onClick={() => setPickerOpen((open) => !open)}
              title="Cambiar de catálogo"
              aria-expanded={pickerOpen}
            >
              <ChevronDown size={12} />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="pulso-catalogchip-empty"
          onClick={() => setPickerOpen((open) => !open)}
          aria-expanded={pickerOpen}
        >
          <ListChecks size={14} />
          <span>Asignar catálogo de opciones</span>
          <ChevronDown size={12} />
        </button>
      )}

      {pickerOpen && (
        <div className="pulso-catalogchip-pop" role="listbox">
          <div className="pulso-catalogchip-pop-header">
            <span>Catálogos disponibles</span>
            <button
              type="button"
              className="pulso-catalogchip-pop-create"
              onClick={() => {
                setPickerOpen(false);
                onCreate();
              }}
            >
              <Plus size={12} /> Nuevo
            </button>
          </div>

          {catalogs.length === 0 ? (
            <div className="pulso-catalogchip-pop-empty">
              Todavía no hay catálogos. Crea el primero para asignarlo.
            </div>
          ) : (
            <ul className="pulso-catalogchip-pop-list">
              {catalogs.map((catalog) => {
                const isCurrent = catalog.listName === assignedListName;
                return (
                  <li key={catalog.listName}>
                    <button
                      type="button"
                      className={`pulso-catalogchip-pop-item ${isCurrent ? "is-active" : ""}`}
                      onClick={() => {
                        onAssign(catalog.listName);
                        setPickerOpen(false);
                      }}
                      role="option"
                      aria-selected={isCurrent}
                    >
                      <span className="pulso-catalogchip-pop-item-name">{catalog.listName}</span>
                      <span className="pulso-catalogchip-pop-item-count">
                        {catalog.items.length}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="pulso-catalogchip-pop-footer">
            La edición de opciones vive en el panel de catálogos.
          </div>
        </div>
      )}
    </div>
  );
}
