import { useState, type ReactNode } from "react";
import { LayoutList, ListChecks } from "../../vendor/lucide-react";
import type { Pregunta, Seccion } from "../../api/client";
import { GlidingTabList } from "../../components/GlidingTabList";
import PreguntasPanel from "./PreguntasPanel";
import SeccionesPanel from "./SeccionesPanel";

type StructureView = "sections" | "questions";

export function CargaStructureWorkbench({
  estructura,
  schemaSelector,
}: {
  estructura: { secciones: Seccion[]; preguntas: Pregunta[] };
  schemaSelector?: ReactNode;
}) {
  const [activeView, setActiveView] = useState<StructureView>("sections");

  return (
    <section
      className="pulso-carga-structure-workbench"
      data-carga-surface="structure"
      aria-labelledby="carga-structure-title"
    >
      <header className="pulso-carga-structure-head">
        <div className="pulso-carga-structure-copy">
          <h2 id="carga-structure-title" className="pulso-sr-only">
            Estructura del instrumento
          </h2>
          <span className="pulso-carga-structure-count">
            {estructura.secciones.length} secciones · {estructura.preguntas.length} ítems
          </span>
        </div>
        {schemaSelector && (
          <div className="pulso-carga-structure-schema">{schemaSelector}</div>
        )}
        <GlidingTabList
          className="pulso-carga-structure-tabs"
          activeKey={activeView}
          mode="tabs"
          onRovingKeyChange={(key) => setActiveView(key as StructureView)}
          role="tablist"
          aria-label="Vista del instrumento"
        >
          <button
            type="button"
            id="carga-structure-sections-tab"
            role="tab"
            aria-selected={activeView === "sections"}
            aria-controls="carga-structure-sections-panel"
            className={activeView === "sections" ? "is-active" : ""}
            data-gliding-key="sections"
            data-nav-item=""
            data-nav-state={activeView === "sections" ? "selected" : undefined}
            onClick={() => setActiveView("sections")}
          >
            <LayoutList size={14} aria-hidden="true" />
            Secciones
          </button>
          <button
            type="button"
            id="carga-structure-questions-tab"
            role="tab"
            aria-selected={activeView === "questions"}
            aria-controls="carga-structure-questions-panel"
            className={activeView === "questions" ? "is-active" : ""}
            data-gliding-key="questions"
            data-nav-item=""
            data-nav-state={activeView === "questions" ? "selected" : undefined}
            onClick={() => setActiveView("questions")}
          >
            <ListChecks size={14} aria-hidden="true" />
            Preguntas
          </button>
        </GlidingTabList>
      </header>

      {activeView === "sections" ? (
        <div
          id="carga-structure-sections-panel"
          role="tabpanel"
          aria-labelledby="carga-structure-sections-tab"
          className="pulso-carga-structure-panel"
          tabIndex={0}
        >
          <SeccionesPanel secciones={estructura.secciones} />
        </div>
      ) : (
        <div
          id="carga-structure-questions-panel"
          role="tabpanel"
          aria-labelledby="carga-structure-questions-tab"
          className="pulso-carga-structure-panel is-questions"
          tabIndex={0}
        >
          <PreguntasPanel preguntas={estructura.preguntas} secciones={estructura.secciones} />
        </div>
      )}
      <span className="pulso-sr-only" aria-live="polite">Vista activa: {activeView === "sections" ? "Secciones" : "Preguntas"}</span>
    </section>
  );
}
