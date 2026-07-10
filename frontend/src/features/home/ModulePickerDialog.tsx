import { PROSECNUR_PRIMARY_ACTIVE_MODULES as MODULES } from "../../lib/modules";
import { ModuleCarousel, type ModulePicker } from "./ModuleCarousel";

export type { ModulePicker };

// Selector de módulos del proyecto: el deck cinematográfico giratorio (el
// mismo del setup, en modo picker) a casi pantalla completa. El deck EXPLICA
// qué hace cada herramienta y permite agregarla o quitarla; el avance y los
// indicadores viven en el home, no aquí.
export function ModulePickerDialog({
  picker,
  onClose,
}: {
  picker: ModulePicker;
  onClose: () => void;
}) {
  const addedCount = MODULES.filter((module) => picker.isAdded(module.slug)).length;

  return (
    <div
      className="home-picker-overlay is-cinema"
      role="dialog"
      aria-modal="true"
      aria-label="Módulos del proyecto"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="home-picker-bar">
        <h2 className="home-picker-title">Módulos del proyecto</h2>
        <span className="home-picker-count">
          {addedCount} {addedCount === 1 ? "módulo" : "módulos"} en el proyecto
        </span>
        <button type="button" className="home-picker-done" onClick={onClose}>Listo</button>
      </div>
      <div className="home-picker-stage">
        <ModuleCarousel picker={picker} />
      </div>
    </div>
  );
}
