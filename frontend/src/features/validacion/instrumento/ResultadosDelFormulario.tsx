/** Paso 3, resultados: cifras, gráficos y reglas agrupadas por lo que les pasó. Salió de `tabs/InstrumentoTab.tsx` (rebanada V1 de P6). */
import PlotlyView from "../components/PlotlyView";
import { PasoDeValidacion } from "../components/PasoDeValidacion";
import { RuleGroupsSection } from "./GruposDeReglas";
import type { InstrumentoResultado } from "../../../api/client";
import type { Instrumento } from "./useInstrumento";

export default function ResultadosDelFormulario({ inst, resultado }: { inst: Instrumento; resultado: InstrumentoResultado }) {
  const { selectedRuleId, onSelectRule, rulesByGroup, relationalRows, relationalSummary } = inst;
  return (
    <PasoDeValidacion titulo="Resultados" listo className="pulso-validacion-paso--resultados">

      {/* KPIs */}
      <div
        data-qa-geometry-group="validacion/hallazgos-indicadores"
        data-qa-geometry-contract="equal"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 12,
        }}
      >
        {resultado.kpis.map((k, i) => (
          <PlotlyView key={i} view={k} />
        ))}
      </div>

      {/* Top reglas + heatmap lado a lado en pantallas grandes */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))",
          gap: 16,
          minWidth: 0,
        }}
      >
        <PlotlyView view={resultado.top_reglas} height={560} />
        <PlotlyView view={resultado.heatmap} height={560} />
      </div>

      <RuleGroupsSection
        groups={rulesByGroup}
        relationalSummary={relationalSummary}
        relationalRows={relationalRows}
        selectedRuleId={selectedRuleId}
        onSelect={onSelectRule}
      />
    </PasoDeValidacion>
  );
}
