// =============================================================================
// shell/ExportMenu.tsx — acción primaria de la banda: Exportar, con sus ajustes
// =============================================================================
// Antes la banda tenía un segmentado relleno «Kobo / ODK | Prosecnur» al lado
// de «Exportar .xlsx» y un botón «Documento» suelto: tres controles para una
// sola intención (sacar el instrumento) y dos de ellos en púrpura compitiendo
// con la acción principal. Ahora hay un único botón primario y un desplegable
// pegado a él con el destino del archivo y la salida impresa.
//
//   [ ⤓ Exportar .xlsx | ▾ ]  →  Destino: (•) Kobo / ODK  ( ) Prosecnur
//                                Documento impreso (PDF o Word)
// =============================================================================

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Download, FileText } from "../../../vendor/lucide-react";

export type ExportMenuProps = {
  includeAppColumns: boolean;
  onIncludeAppColumnsChange: (next: boolean) => void;
  onExport: () => void;
  onOpenDocument: () => void;
  disabled: boolean;
};

const TARGETS = [
  {
    key: "kobo",
    appColumns: false,
    label: "Kobo / ODK",
    description: "XLSForm estándar, listo para subir a Kobo u ODK.",
  },
  {
    key: "prosecnur",
    appColumns: true,
    label: "Prosecnur",
    description: "Conserva la hoja paper, la hoja diagnostico y las columnas paper_*.",
  },
] as const;

export function ExportMenu({
  includeAppColumns,
  onIncludeAppColumnsChange,
  onExport,
  onOpenDocument,
  disabled,
}: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
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

  const target = includeAppColumns ? TARGETS[1] : TARGETS[0];

  return (
    <div ref={wrapperRef} className={`pulso-more-views-wrapper pulso-xf-export-split${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="pulso-primary pulso-xlsform-toolbar-button pulso-xf-export-main"
        onClick={onExport}
        disabled={disabled}
        title={`Exportar el XLSForm para ${target.label}`}
      >
        <Download size={14} aria-hidden="true" />
        <span>Exportar</span>
        <span className="pulso-xf-cmd-label">.xlsx</span>
      </button>
      <button
        type="button"
        className="pulso-primary pulso-xf-export-caret"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Opciones de exportación (destino: ${target.label})`}
        title="Destino del archivo y documento impreso"
        disabled={disabled}
      >
        <ChevronDown size={13} aria-hidden="true" />
      </button>
      {open && (
        <div className="pulso-more-views-menu pulso-xf-export-menu" role="menu">
          <span className="pulso-more-views-eyebrow">Destino del .xlsx</span>
          {TARGETS.map((item) => {
            const checked = item.appColumns === includeAppColumns;
            return (
              <button
                key={item.key}
                type="button"
                role="menuitemradio"
                aria-checked={checked}
                className={`pulso-more-views-item${checked ? " is-active" : ""}`}
                onClick={() => {
                  onIncludeAppColumnsChange(item.appColumns);
                  setOpen(false);
                }}
              >
                <span className="pulso-more-views-item-icon">
                  {checked ? <Check size={15} /> : null}
                </span>
                <span className="pulso-more-views-item-text">
                  <strong>{item.label}</strong>
                  <em>{item.description}</em>
                </span>
              </button>
            );
          })}
          <span className="pulso-more-views-eyebrow">Impreso</span>
          <button
            type="button"
            role="menuitem"
            className="pulso-more-views-item"
            onClick={() => {
              setOpen(false);
              onOpenDocument();
            }}
          >
            <span className="pulso-more-views-item-icon">
              <FileText size={15} />
            </span>
            <span className="pulso-more-views-item-text">
              <strong>Documento</strong>
              <em>Configurar y exportar el cuestionario impreso (PDF o Word).</em>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
