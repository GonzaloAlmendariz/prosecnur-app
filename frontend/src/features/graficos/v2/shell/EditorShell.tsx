import { usePlanStore } from "../../store";
import { ModeToolbar } from "./ModeToolbar";
import { TimelinePanelV2 } from "../timeline/TimelinePanelV2";
import { InspectorV2 } from "../inspector/InspectorV2";
import { PlanCanvas } from "../canvas/PlanCanvas";
import "../styles/editor-v2.css";

// Orquestadora del editor V2. Layout 2-pane (timeline + inspector) en
// modo Timeline. El modo Canvas toma el ancho completo del area central.
// La aside-mockup-secuencia anterior se eliminó: las cards del timeline
// ya muestran el thumbnail, eran redundantes.

export function EditorShell() {
  const viewMode = usePlanStore((s) => s.viewMode);
  const density = usePlanStore((s) => s.density);

  return (
    <div className={`pulso-gv2-shell is-${density}`} data-density={density}>
      <ModeToolbar />

      <div className={`pulso-gv2-shell-body is-${viewMode}`}>
        {viewMode === "timeline" && (
          <>
            <TimelinePanelV2 />
            <InspectorV2 />
          </>
        )}

        {viewMode === "canvas" && <PlanCanvas />}
      </div>

      {/* Marker invisible: mantiene compatibilidad con reglas/tests previos. */}
      <span data-density={density} hidden aria-hidden="true" />
    </div>
  );
}
