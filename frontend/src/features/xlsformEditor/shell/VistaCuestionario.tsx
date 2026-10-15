// =============================================================================
// shell/VistaCuestionario.tsx — pestaña «Vista del cuestionario»
// =============================================================================
// Antes era un overlay a pantalla completa armado dentro de XlsformEditorPage
// («Volver al editor»). Desde el rail de pestañas (2026-10-15) es un espacio de
// trabajo propio: el recorrido completo, sección por sección. Elegir una
// pregunta lleva al Constructor con esa pregunta en foco.
// =============================================================================

import type { BuilderSelection, BuilderStructure } from "../types";
import { QuestionnaireProgressPanel } from "./QuestionnaireProgressPanel";

export type VistaCuestionarioProps = {
  structure: BuilderStructure | null;
  selection: BuilderSelection | null;
  metricas: { fields: number; sections: number; logicRules: number; required: number; catalogs: number };
  onElegir: (seleccion: BuilderSelection) => void;
};

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

export function VistaCuestionario({ structure, selection, metricas, onElegir }: VistaCuestionarioProps) {
  return (
    <div
      className="pulso-graph-overlay pulso-questionnaire-overlay is-embebido"
      role="region"
      aria-label="Vista del cuestionario"
      data-audit-ready="xlsform-cuestionario"
    >
      <header className="pulso-graph-header">
        <div className="pulso-graph-header-left">
          <div className="pulso-graph-header-title">
            <strong>Vista del cuestionario</strong>
            <span>
              {plural(metricas.fields, "campo", "campos")} · {plural(metricas.sections, "sección", "secciones")} ·{" "}
              {plural(metricas.logicRules, "regla", "reglas")}
            </span>
          </div>
        </div>
        <div className="pulso-graph-header-right">
          <div className="pulso-questionnaire-header-stats" aria-label="Resumen del formulario">
            <span>{plural(metricas.required, "obligatoria", "obligatorias")}</span>
            <span>{plural(metricas.catalogs, "catálogo", "catálogos")}</span>
          </div>
        </div>
      </header>
      <div className="pulso-questionnaire-shell">
        <QuestionnaireProgressPanel structure={structure} selection={selection} onSelect={onElegir} />
      </div>
    </div>
  );
}
