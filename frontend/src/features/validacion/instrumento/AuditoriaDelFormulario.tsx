/** Paso 2, auditoría: variables fuera de auditoría y el trabajo que corre el plan. Salió de `tabs/InstrumentoTab.tsx` (rebanada V1 de P6). */
import { Play } from "../../../vendor/lucide-react";
import { JobProgress } from "../../../components/JobProgress";
import { PasoDeValidacion } from "../components/PasoDeValidacion";
import { VariableExclusionsPanel } from "./VariablesFueraDeAuditoria";
import type { InstrumentoEstado } from "../types";
import type { Instrumento } from "./useInstrumento";

export default function AuditoriaDelFormulario({
  inst,
  estado,
  onIrAReglas,
}: {
  inst: Instrumento;
  estado: InstrumentoEstado;
  /** Los controles del operativo se editan en Reglas: el aviso de cambios sin aplicar lleva allí. */
  onIrAReglas?: () => void;
}) {
  const { setError, busy, jobId, setJobId, variableQuery, setVariableQuery, operationalDirty, onAudit, onAuditDone, onToggleVariableExcluida, excludedVariableSet, variableExclusionOptions } = inst;
  return (
    <PasoDeValidacion
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
            {onIrAReglas
              ? "Los controles del operativo tienen cambios sin aplicar: aplícalos y reconstruye el plan en Reglas antes de ejecutar la auditoría."
              : "Aplica y reconstruye el plan antes de ejecutar la auditoría con estos controles."}
            {onIrAReglas && (
              <>
                {" "}
                <button type="button" className="pulso-secondary" onClick={onIrAReglas}>
                  Ir a Reglas
                </button>
              </>
            )}
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
