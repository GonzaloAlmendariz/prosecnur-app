import { GanttChart, LayoutGrid, Rows3, AlignJustify } from "lucide-react";
import { usePlanStore } from "../../store";

// Toolbar de modo: tabs Timeline | Canvas + density toggle.
// Atajos V/T cambian de modo (manejados en useShortcutsV2).

const MODES = [
  { key: "timeline" as const, label: "Timeline", Icon: GanttChart, hint: "Vista lineal con drag & drop · T" },
  { key: "canvas" as const,   label: "Canvas",   Icon: LayoutGrid, hint: "Grilla de slides para reordenar en bloque · V" },
];

export function ModeToolbar() {
  const viewMode = usePlanStore((s) => s.viewMode);
  const setViewMode = usePlanStore((s) => s.setViewMode);
  const density = usePlanStore((s) => s.density);
  const setDensity = usePlanStore((s) => s.setDensity);

  return (
    <div className="pulso-gv2-mode-toolbar" role="toolbar" aria-label="Modo de vista del editor">
      <button
        type="button"
        className={`pulso-gv2-density-toggle ${density === "compact" ? "is-on" : ""}`}
        onClick={() => setDensity(density === "comfortable" ? "compact" : "comfortable")}
        title={density === "compact" ? "Cambiar a vista cómoda" : "Cambiar a vista compacta"}
        aria-pressed={density === "compact"}
      >
        {density === "compact" ? <AlignJustify size={12} /> : <Rows3 size={12} />}
        {density === "compact" ? "Compacto" : "Cómodo"}
      </button>

      <span className="pulso-gv2-mode-spacer" />

      <div className="pulso-gv2-mode-tabs" role="tablist">
        {MODES.map(({ key, label, Icon, hint }) => (
          <button
            key={key}
            role="tab"
            aria-selected={viewMode === key}
            type="button"
            className={`pulso-gv2-mode-tab ${viewMode === key ? "is-active" : ""}`}
            onClick={() => setViewMode(key)}
            title={hint}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
