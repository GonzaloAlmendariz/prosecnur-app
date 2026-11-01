// La franja de Cronograma › Plan: cuándo es el campo y en qué etapa está el
// estudio. Las dos son propuestas del Planner (ADR 0123 §6): la etapa se declara
// aquí y no se siembra de Hojas de ruta ni de Monitoreo, que la comparan desde
// su lado y ofrecen «Alinear». La ventana es PlannerVentanaCampo.

import type { PlannerEtapa } from "../../../api/planner";
import { GlidingRadioGroup } from "../../../components/GlidingRadioGroup";
import { PlannerAvisos } from "./PlannerCabecera";
import { PlannerVentanaCampo } from "./PlannerVentanaCampo";
import { textoOrigen } from "./plannerCopia";
import type { ControlPlanner } from "./usePlanner";
import { usePlannerCalendario } from "./usePlannerCalendario";

const ETAPAS: readonly (readonly [PlannerEtapa, string])[] = [["piloto", "Piloto"], ["campo", "Campo"]];

export function PlannerCalendarioResumen({ recarga, control }: { recarga: unknown; control: ControlPlanner }) {
  const cal = usePlannerCalendario(control.estado?.revision, recarga);
  if (!cal) return null;

  const guardando = control.guardando === "etapa";
  const origen = cal.etapa.origen === "declarado" ? textoOrigen("declarado", control.estado?.declaradoEn.etapa) : "sin declarar";

  return (
    <section className="planner-calendario" aria-label="Ventana de campo y etapa del estudio" data-audit-ready="planner-calendario">
      <dl className="planner-calendario-datos">
        <div>
          <dt>Ventana de campo</dt>
          <dd><PlannerVentanaCampo ventana={cal.ventana} control={control} /></dd>
        </div>
        <div>
          <dt>Etapa operativa</dt>
          <dd className="planner-calendario-etapa">
            <GlidingRadioGroup
              value={cal.etapa.valor ?? ""}
              options={ETAPAS}
              getOptionValue={(o) => o[0] as string}
              onValueChange={(v) => { void control.declarar("etapa", { valor: v }); }}
              className="planner-calendario-opciones"
              aria-label="Etapa operativa del estudio"
              getOptionProps={() => ({ disabled: guardando || !control.estado })}
            >
              {(o) => <span>{o[1]}</span>}
            </GlidingRadioGroup>
            <span className="planner-calendario-fuente">{guardando ? "Guardando…" : origen}</span>
          </dd>
        </div>
      </dl>
      <PlannerAvisos avisos={cal.avisos} tono="aviso" />
    </section>
  );
}
