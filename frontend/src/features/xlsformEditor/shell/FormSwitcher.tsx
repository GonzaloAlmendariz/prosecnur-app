// =============================================================================
// shell/FormSwitcher.tsx — conmutador rápido de formularios del toolbar
// =============================================================================
// Un proyecto puede alojar varios formularios (biblioteca multi-formulario).
// Este dropdown vive en el grupo `--document` del command bar y permite:
//   - ver el formulario activo (trigger con su nombre),
//   - saltar a cualquier otro formulario de la biblioteca,
//   - crear un formulario nuevo,
//   - volver al hub ("Ver todos") sin perder la colección.
//
// Reusa el patrón de popover y las clases `.pulso-more-views-*` del command
// bar (mismo comportamiento de click-fuera / Escape que MoreViewsMenu).
// =============================================================================

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, FileSpreadsheet, LayoutGrid, Lock, Plus } from "../../../vendor/lucide-react";
import type { LibraryEntry } from "../state/persistence";

export type FormSwitcherProps = {
  forms: LibraryEntry[];
  activeFormId: string | null;
  /** Nombre reactivo del formulario abierto — derivado del workbook vivo, así
   *  el label se refresca en cuanto cambia el `form_title` o se renombra. */
  activeName: string;
  /** `false` cuando el proyecto ya llegó al tope de formularios: la acción
   *  "Nuevo formulario" se deshabilita con una nota sutil. */
  canCreate: boolean;
  onSwitch: (id: string) => void;
  onNew: () => void;
  onViewAll: () => void;
};

export function FormSwitcher({
  forms,
  activeFormId,
  activeName,
  canCreate,
  onSwitch,
  onNew,
  onViewAll,
}: FormSwitcherProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  // El label sale de `activeName` (derivado del workbook vivo en el page), no
  // del índice `forms` — que se refresca en diferido y dejaba el nombre stale
  // tras un rename hasta el siguiente render.
  const label = activeName;

  return (
    <div
      ref={wrapperRef}
      className={`pulso-more-views-wrapper pulso-xf-form-switcher${open ? " is-open" : ""}`}
    >
      <button
        type="button"
        className="pulso-more-views-trigger pulso-xf-form-switcher-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Cambiar de formulario"
      >
        <FileSpreadsheet size={13} />
        <span className="pulso-xf-form-switcher-label">{label}</span>
        <ChevronDown size={13} aria-hidden="true" />
      </button>
      {open && (
        <div className="pulso-more-views-menu pulso-xf-form-switcher-menu" role="menu">
          <span className="pulso-more-views-eyebrow">Formularios del proyecto</span>
          {forms.length === 0 && (
            <span className="pulso-xf-form-switcher-empty">
              Todavía no hay otros formularios en este proyecto.
            </span>
          )}
          {forms.map((form) => {
            const isActive = form.id === activeFormId;
            return (
              <button
                key={form.id}
                type="button"
                role="menuitemradio"
                aria-checked={isActive}
                className={`pulso-more-views-item pulso-xf-form-switcher-item${isActive ? " is-active" : ""}`}
                // El nombre lo escribe el usuario y el item lo recorta con
                // elipsis cuando no cabe. Sin esto el resto del nombre no
                // existiría para nadie: recortar solo es legítimo si el texto
                // completo sigue alcanzable.
                title={form.source?.original_name
                  ? `${form.name} · ${form.source.original_name}`
                  : form.name}
                onClick={() => {
                  setOpen(false);
                  if (!isActive) onSwitch(form.id);
                }}
              >
                <span className="pulso-more-views-item-icon">
                  {isActive ? <Check size={16} /> : <FileSpreadsheet size={16} />}
                </span>
                <span className="pulso-more-views-item-text">
                  <strong>{form.name}</strong>
                  {form.source?.original_name && <em>{form.source.original_name}</em>}
                </span>
              </button>
            );
          })}
          <div className="pulso-xf-form-switcher-divider" aria-hidden="true" />
          <button
            type="button"
            role="menuitem"
            className="pulso-more-views-item pulso-xf-form-switcher-item"
            disabled={!canCreate}
            aria-disabled={!canCreate}
            onClick={() => {
              if (!canCreate) return;
              setOpen(false);
              onNew();
            }}
          >
            <span className="pulso-more-views-item-icon">
              {canCreate ? <Plus size={16} /> : <Lock size={16} />}
            </span>
            <span className="pulso-more-views-item-text">
              <strong>Nuevo formulario</strong>
              <em>
                {canCreate
                  ? "Empieza un formulario en blanco o importa uno."
                  : "Límite de formularios alcanzado. Elimina uno para crear otro."}
              </em>
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="pulso-more-views-item pulso-xf-form-switcher-item"
            onClick={() => {
              setOpen(false);
              onViewAll();
            }}
          >
            <span className="pulso-more-views-item-icon">
              <LayoutGrid size={16} />
            </span>
            <span className="pulso-more-views-item-text">
              <strong>Ver todos</strong>
              <em>Vuelve a la biblioteca de formularios del proyecto.</em>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
