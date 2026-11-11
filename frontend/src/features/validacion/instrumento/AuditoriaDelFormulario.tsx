/** Paso 2, auditoría: variables fuera de auditoría y el trabajo que corre el plan. Salió de `tabs/InstrumentoTab.tsx` (rebanada V1 de P6). */
import { Play } from "../../../vendor/lucide-react";
import { JobProgress } from "../../../components/JobProgress";
import { PasoDeValidacion } from "../components/PasoDeValidacion";
import { VariableExclusionsPanel } from "./VariablesFueraDeAuditoria";
import type { InstrumentoEstado } from "../types";
import type { Instrumento } from "./useInstrumento";

export default function AuditoriaDelFormulario({ inst, estado }: { inst: Instrumento; estado: InstrumentoEstado }) {
  const { setError, busy, jobId, setJobId, variableQuery, setVariableQuery, operationalDirty, onAudit, onAuditDone, onToggleVariableExcluida, excludedVariableSet, variableExclusionOptions } = inst;
  return (
    <PasoDeValidacion
      paso={2}
      de={3}
      titulo="Auditoría"
      detalle="Corre el plan contra la data y encuentra casos inconsistentes."
      listo={estado.auditoria_corrida}
    >
      <VariableExclusionsPanel
        options={variableExclusionOptions}
        excluded={excludedVariableSet}
        query={variableQuery}
        onQuery={setVariableQuery}
        onToggle={(variable, checked, motivo) => void onToggleVariableExcluida(variable, checked, motivo)}
        disabled={!!busy || !!jobId}
      />
      <div>
        <button
          type="button"
          className="pulso-primary"
          onClick={() => void onAudit()}
          disabled={!!busy || !!jobId || operationalDirty}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: "var(--pulso-type-body-size)",
            padding: "8px 14px",
          }}
        >
          <Play size={12} />
          {estado.auditoria_corrida ? "Ejecutar de nuevo" : "Ejecutar auditoría"}
        </button>
        {operationalDirty && (
          <div className="pulso-operational-inline-note" style={{ marginTop: 7 }}>
            Aplica y reconstruye el plan antes de ejecutar la auditoría con estos controles.
          </div>
        )}
      </div>
      {jobId && (
        <JobProgress
          label="Auditando data"
          jobId={jobId}
          onDone={() => void onAuditDone()}
          onError={(msg) => {
            setError(msg);
            setJobId(null);
          }}
          onCancelled={() => setJobId(null)}
        />
      )}
    </PasoDeValidacion>
  );
}
