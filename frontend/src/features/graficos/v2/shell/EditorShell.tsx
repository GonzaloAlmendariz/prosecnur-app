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
    <div className="pulso-gv2-shell">
      <ModeToolbar />

      <div className="pulso-gv2-shell-body">
        {viewMode === "timeline" && (
          <>
            <TimelinePanelV2 />
            <InspectorV2 />
          </>
        )}

        {viewMode === "canvas" && <PlanCanvas />}
      </div>

      {/* Marker invisible: density data attr permite reglas CSS extra si se necesitan */}
      <span data-density={density} hidden aria-hidden="true" />
    </div>
  );
}
