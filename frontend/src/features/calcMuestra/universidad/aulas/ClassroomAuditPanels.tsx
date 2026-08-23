import type {
  CalcMuestraAulasMethodComparison,
  CalcMuestraAulasReplacementSimulation,
  CalcMuestraAulasReplacementSuggestion,
  CalcMuestraAulasSelection,
} from "../../../../api/client";
import { AulasApplicationFlow } from "../../../aulasFlow/AulasApplicationFlow";
import { fmtInt, rowsFrom } from "../../sharedCore";
import { classroomRowText } from "../shared/format";
import {
  classroomMethodLabel,
  classroomProbabilitySourceLabel,
} from "./classroomLabels";

export function ClassroomOperationalHandoffPanel({
  selection,
  replacementSimulation,
}: {
  selection: CalcMuestraAulasSelection | null;
  replacementSimulation?: CalcMuestraAulasReplacementSimulation | null;
}) {
  const selectionRows = rowsFrom<Record<string, unknown>>(selection?.selection);
  const titulares = selectionRows.filter((row) => classroomRowText(row, ["sample_role"]) === "titular" || classroomRowText(row, ["wave"]) === "M1").length;
  const reservas = selectionRows.filter((row) => classroomRowText(row, ["sample_role"]) === "chain_reserve" || (classroomRowText(row, ["wave"]) !== "M1" && classroomRowText(row, ["sample_role"]) !== "extra_reserve_pool")).length;
  const reservaExtra = selectionRows.filter((row) => classroomRowText(row, ["sample_role"]) === "extra_reserve_pool").length;
  const sugerencias = rowsFrom<CalcMuestraAulasReplacementSuggestion>(replacementSimulation?.suggestions).length;
  const hasSelection = selectionRows.length > 0;
  return (
    <div className="cmv2-handoff-map">
      <div className="cmv2-subhead">
        <strong>Aplicación por cursos-horario</strong>
      </div>
      <AulasApplicationFlow
        tone="calc-muestra"
        current="muestra"
        compact
        title="Del diseño de cursos-horario al campo del estudio"
        summary="El cálculo de muestra de cursos-horario produce titulares, reservas, pesos y códigos. El generador QR/PDF convierte esa agenda en fichas y el monitoreo de cursos-horario registra aplicación, caídas y reemplazos."
        metrics={[
          { label: "Titulares", value: fmtInt(titulares), tone: titulares ? "ready" : "warning" },
          { label: "Reservas", value: fmtInt(reservas + reservaExtra), tone: reservas || reservaExtra ? "ready" : "neutral" },
          { label: "Sugerencias", value: fmtInt(sugerencias), tone: sugerencias ? "current" : "neutral" },
        ]}
        secondaryAction={{ to: "/monitoreo", label: "Ver monitoreo de cursos-horario" }}
        // A la sección donde se preparan las fichas, no al módulo a secas:
        // «/recopiladores» aterriza en el plan de recolección y el botón promete
        // fichas. Medido el 2026-08-23: llevaba a la lista de las 193 aulas.
        action={{ to: "/recopiladores?seccion=materiales", label: "Abrir fichas QR", disabled: !hasSelection }}
      />
    </div>
  );
}

export function ClassroomMethodSources({
  selection,
  comparison,
}: {
  selection: CalcMuestraAulasSelection | null;
  comparison: CalcMuestraAulasMethodComparison | null;
}) {
  const sourceRows = [
    { label: "Fuente oficial", value: selection?.official_reference ?? "OECD/PISA, NCES/NAEP, UN, Eurostat, AAPOR" },
    { label: "Fuente académica", value: selection?.academic_reference ?? "Deville & Tillé; Statistics Canada; Groves & Heeringa" },
    { label: "Implementación", value: selection?.implementation_reference ?? "sampling::samplecube(); BalancedSampling::lcube/lpm2" },
    { label: "Probabilidades", value: selection ? classroomProbabilitySourceLabel(selection.probability_source) : classroomMethodLabel(comparison?.recommendation?.method_id ?? "") || "pendiente" },
    { label: "Pesos", value: selection?.weight_source ?? "peso del curso-horario = 1 / probabilidad final; probabilidad estudiantil agregada" },
    { label: "No respuesta", value: selection?.nonresponse_policy ?? "códigos de disposición y ajuste posterior por dominio" },
  ];
  return (
    <div className="cmv2-classroom-source-grid">
      {sourceRows.map((row) => (
        <div key={row.label}>
          <small>{row.label}</small>
          <span>{row.value}</span>
        </div>
      ))}
    </div>
  );
}
