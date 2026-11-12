/**
 * Los dos paneles de la familia "Del operativo" (D-F7b), direccionables:
 *
 *   - `panel=operativo`: el periodo de campo y las respuestas casi iguales.
 *   - `panel=roles`: cómo se identifica un caso y el criterio de caso válido,
 *     hasta que pasen a Carga › Variables (D11).
 *
 * Los dos editan la misma configuración del operativo, que se guarda al
 * reconstruir el plan: lo editado sin aplicar vive en el store por base y
 * bloquea "Auditar" con su causa (revisión de V2, B1). Son los componentes de
 * antes (`InstrumentoOperationalControls`, `RolesDeclarados`), en su panel.
 */
import { Sideover } from "../../../../components/Sideover";
import { PulsoButton } from "../../../../components/PulsoButton";
import InstrumentoOperationalControls from "../../components/InstrumentoOperationalControls";
import RolesDeclarados from "../../components/RolesDeclarados";
import type { Instrumento } from "../../instrumento/useInstrumento";
import { PANEL_OPERATIVO_VALIDACION, PANEL_ROLES_VALIDACION } from "../../panelesValidacion";

function PieDelOperativo({ inst, onReleer }: { inst: Instrumento; onReleer: () => void }) {
  const bloqueado = !!inst.busy || !!inst.jobId;
  return (
    <>
      <span className="pulso-rl-pie-nota">
        {inst.operationalDirty ? "Hay cambios sin aplicar." : "Sin cambios por aplicar."}
      </span>
      <PulsoButton
        variant="primary"
        disabled={bloqueado || !inst.operationalDirty || !inst.operationalValid}
        onClick={onReleer}
      >
        Aplicar y reconstruir el plan
      </PulsoButton>
    </>
  );
}

export function PanelesDelOperativo({ inst, onReleer }: { inst: Instrumento; onReleer: () => void }) {
  const { baseNombre, estado, operationalConfig, setOperationalConfig, operationalDirty, busy, jobId } = inst;
  const bloqueado = !!busy || !!jobId;
  return (
    <>
      <Sideover
        panel={PANEL_OPERATIVO_VALIDACION}
        title="Controles del operativo"
        subtitle="Periodo de campo y respuestas casi iguales"
        closeLabel="Cerrar los controles del operativo"
        footer={<PieDelOperativo inst={inst} onReleer={onReleer} />}
      >
        <div className="pulso-rl-operativo">
          <InstrumentoOperationalControls
            baseNombre={baseNombre}
            value={operationalConfig}
            upstreamUniverse={estado?.upstream_universe}
            dirty={operationalDirty}
            disabled={bloqueado}
            onChange={setOperationalConfig}
            desplegado
          />
        </div>
      </Sideover>
      <Sideover
        panel={PANEL_ROLES_VALIDACION}
        title="Cómo se identifica un caso"
        closeLabel="Cerrar cómo se identifica un caso"
        footer={<PieDelOperativo inst={inst} onReleer={onReleer} />}
      >
        <RolesDeclarados
          baseNombre={baseNombre}
          value={operationalConfig}
          disabled={bloqueado}
          onChange={setOperationalConfig}
        />
      </Sideover>
    </>
  );
}
