import { AlertTriangle, CheckCircle2, GanttChart, LayoutGrid, Rows3, AlignJustify } from "lucide-react";
import { usePlanStore } from "../../store";
import { usePlanValidator } from "../../usePlanValidator";

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
  const slides = usePlanStore((s) => s.plan.slides);
  const selectedSlideId = usePlanStore((s) => s.selectedSlideId);
  const { issues } = usePlanValidator();
  const selectedIndex = selectedSlideId ? slides.findIndex((slide) => slide.id === selectedSlideId) : -1;
  const issueCount = issues.length;

  return (
    <div className="pulso-gv2-mode-toolbar" role="toolbar" aria-label="Modo de vista del editor">
      <div className="pulso-gv2-suite-status" aria-label="Estado del constructor">
        <span className="pulso-gv2-suite-mark" aria-hidden="true">
          <LayoutGrid size={14} />
        </span>
        <span className="pulso-gv2-suite-copy">
          <strong>Constructor</strong>
          <span>
            {slides.length === 0
              ? "sin slides"
              : selectedIndex >= 0
                ? `slide ${selectedIndex + 1} de ${slides.length}`
                : `${slides.length} ${slides.length === 1 ? "slide" : "slides"}`}
          </span>
        </span>
        <span className={`pulso-gv2-suite-chip ${issueCount > 0 ? "is-warn" : "is-ok"}`}>
          {issueCount > 0 ? <AlertTriangle size={11} /> : <CheckCircle2 size={11} />}
          {issueCount > 0 ? `${issueCount} incidencia${issueCount === 1 ? "" : "s"}` : "listo"}
        </span>
      </div>

      <div className="pulso-gv2-mode-tabs pulso-gv2-segmented" role="tablist" aria-label="Vista del constructor">
        {MODES.map(({ key, label, Icon, hint }) => (
          <button
            key={key}
            role="tab"
            aria-selected={viewMode === key}
            type="button"
            className={`pulso-gv2-mode-tab ${viewMode === key ? "is-active" : ""}`}
            onClick={() => setViewMode(key)}
            aria-label={`${label}. ${hint}`}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      <button
        type="button"
        className={`pulso-gv2-density-toggle pulso-gv2-pill-button ${density === "compact" ? "is-on" : ""}`}
        onClick={() => setDensity(density === "comfortable" ? "compact" : "comfortable")}
        aria-label={density === "compact" ? "Cambiar a vista cómoda" : "Cambiar a vista compacta"}
        aria-pressed={density === "compact"}
      >
        {density === "compact" ? <AlignJustify size={12} /> : <Rows3 size={12} />}
        {density === "compact" ? "Compacto" : "Cómodo"}
      </button>
    </div>
  );
}
