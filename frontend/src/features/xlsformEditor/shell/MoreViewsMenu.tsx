// =============================================================================
// shell/MoreViewsMenu.tsx — popover "⋯ Más vistas" del header del editor
// =============================================================================
// Antes el header tenía 4 botones inline (Mapa de lógica / Lógica SM / Vista
// del cuestionario / Catálogos) que abrumaban a un usuario nuevo. Acá los
// agrupamos en un popover descubrible:
//
//   [ Constructor | Hojas ]                    [Sin avisos ✓] [⋯ Más vistas]
//
// Cada item muestra icono + nombre + descripción de una línea para que el
// usuario no necesite recordar qué es cada vista.
// =============================================================================

import { useEffect, useRef, useState } from "react";
import { Layers3, ListChecks, MoreHorizontal, Workflow } from "lucide-react";
import { IconBranching } from "../../../lib/icons";

export type MoreViewsMenuProps = {
  catalogsCount: number;
  onOpenLogicCanvas: () => void;
  onOpenSurveyMonkeyLogic: () => void;
  onOpenQuestionnaireView: () => void;
  onOpenCatalogsLens: () => void;
};

type MenuItem = {
  key: string;
  label: string;
  description: string;
  icon: typeof Workflow;
  onClick: () => void;
  badge?: number;
};

export function MoreViewsMenu({
  catalogsCount,
  onOpenLogicCanvas,
  onOpenSurveyMonkeyLogic,
  onOpenQuestionnaireView,
  onOpenCatalogsLens,
}: MoreViewsMenuProps) {
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

  const items: MenuItem[] = [
    {
      key: "questionnaire-view",
      label: "Vista del cuestionario",
      description: "Recorre el formulario completo, sección por sección, como lo verá el encuestado.",
      icon: Layers3,
      onClick: () => {
        onOpenQuestionnaireView();
        setOpen(false);
      },
    },
    {
      key: "catalogs",
      label: "Listas de opciones",
      description: "Editar las listas que usan tus preguntas de selección.",
      icon: ListChecks,
      onClick: () => {
        onOpenCatalogsLens();
        setOpen(false);
      },
      badge: catalogsCount > 0 ? catalogsCount : undefined,
    },
    {
      key: "logic-canvas",
      label: "Mapa de lógica",
      description: "Diagrama visual de cómo las preguntas dependen unas de otras.",
      icon: Workflow,
      onClick: () => {
        onOpenLogicCanvas();
        setOpen(false);
      },
    },
    {
      key: "survey-monkey-logic",
      label: "Lógica de SurveyMonkey",
      description: "Importar reglas de salto desde un cuestionario de SurveyMonkey.",
      icon: IconBranching,
      onClick: () => {
        onOpenSurveyMonkeyLogic();
        setOpen(false);
      },
    },
  ];

  return (
    <div ref={wrapperRef} className={`pulso-more-views-wrapper${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="pulso-more-views-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Otras vistas y herramientas avanzadas"
      >
        <MoreHorizontal size={14} />
        Más vistas
      </button>
      {open && (
        <div className="pulso-more-views-menu" role="menu">
          <span className="pulso-more-views-eyebrow">Otras vistas</span>
          {items.map(({ key, label, description, icon: Icon, onClick, badge }) => (
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
                <strong>
                  {label}
                  {badge != null && (
                    <span className="pulso-more-views-item-badge">{badge}</span>
                  )}
                </strong>
                <em>{description}</em>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
