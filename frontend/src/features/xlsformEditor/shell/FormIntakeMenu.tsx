// =============================================================================
// shell/FormIntakeMenu.tsx — popover "+ Nuevo formulario" del header del editor
// =============================================================================
// La banda de comandos tenía seis controles del mismo peso en una sola zona
// —Nuevo formulario, Importar como nuevo, SurveyMonkey, Columnas de plataforma,
// Exportar .xlsx y Documento— y se leía como un mosaico: nada indicaba qué era
// la acción principal ni qué cosas iban juntas.
//
// Las tres primeras responden a la misma intención (traer un formulario nuevo
// al proyecto, con distinto origen), así que viven acá y dejan la zona de
// acciones para lo que de verdad se hace a diario: exportar.
//
//   [ + Nuevo formulario ▾ ]        [ ☐ Columnas · Exportar .xlsx ] [Documento]
//
// Mismo patrón visual que MoreViewsMenu: icono + nombre + una línea que explica
// el origen, para no obligar a recordar qué hace cada opción.
// =============================================================================

import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  Cloud,
  Upload,
  type LucideIcon,
} from "../../../vendor/lucide-react";
import { IconNew } from "../../../lib/icons";

export type FormIntakeMenuProps = {
  /** Falso cuando el proyecto llegó al límite de formularios. */
  canCreate: boolean;
  /** Límite de formularios por proyecto, para explicar por qué está bloqueado. */
  maxForms: number;
  onNewBlank: () => void;
  onImportXlsform: () => void;
  onImportSurveyMonkey: () => void;
};

type IntakeItem = {
  key: string;
  label: string;
  description: string;
  icon: LucideIcon;
  onClick: () => void;
};

export function FormIntakeMenu({
  canCreate,
  maxForms,
  onNewBlank,
  onImportXlsform,
  onImportSurveyMonkey,
}: FormIntakeMenuProps) {
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

  const items: IntakeItem[] = [
    {
      key: "blank",
      label: "Empezar de cero",
      description: "Un formulario vacío para construirlo pregunta por pregunta.",
      icon: IconNew,
      onClick: () => {
        onNewBlank();
        setOpen(false);
      },
    },
    {
      key: "xlsform",
      label: "Importar un XLSForm",
      description: "Trae un .xlsx existente como formulario nuevo del proyecto.",
      icon: Upload,
      onClick: () => {
        onImportXlsform();
        setOpen(false);
      },
    },
    {
      key: "surveymonkey",
      label: "Traducir de SurveyMonkey",
      description: "Convierte una encuesta de SurveyMonkey en XLSForm editable.",
      icon: Cloud,
      onClick: () => {
        onImportSurveyMonkey();
        setOpen(false);
      },
    },
  ];

  return (
    <div ref={wrapperRef} className={`pulso-more-views-wrapper${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="pulso-more-views-trigger pulso-xf-intake-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={!canCreate}
        title={
          canCreate
            ? "Agregar un formulario al proyecto"
            : `Límite de ${maxForms} formularios por proyecto`
        }
      >
        <IconNew size={14} />
        Nuevo formulario
        <ChevronDown size={13} aria-hidden="true" />
      </button>
      {open && (
        <div className="pulso-more-views-menu" role="menu">
          <span className="pulso-more-views-eyebrow">Agregar al proyecto</span>
          {items.map(({ key, label, description, icon: Icon, onClick }) => (
            <button
              key={key}
              type="button"
              role="menuitem"
              className="pulso-more-views-item"
              onClick={onClick}
            >
              <span className="pulso-more-views-item-icon">
                <Icon size={16} />
              </span>
              <span className="pulso-more-views-item-text">
                <strong>{label}</strong>
                <em>{description}</em>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
