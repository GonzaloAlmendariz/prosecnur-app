// La franja de Cronograma › Plan: cuándo es el campo y en qué etapa está el
// estudio (ADR 0122 §2). El Planner DECLARA la etapa (decisión de Meta B sobre
// el ADR ratificado): se siembra de Hojas de ruta y Monitoreo si coinciden; si
// no, queda sin valor y lo decide el usuario aquí. Mientras esos módulos no la
// lean del Planner, se dice cuál sigue en otra etapa. La ventana de campo es la
// PROPUESTA del Planner (PlannerVentanaCampo).

import { useEffect, useState } from "react";

import { apiPlannerCalendario, type PlannerCalendario, type PlannerEtapa } from "../../../api/planner";
import { GlidingRadioGroup } from "../../../components/GlidingRadioGroup";
import { PlannerAvisos } from "./PlannerCabecera";
import { PlannerVentanaCampo } from "./PlannerVentanaCampo";
import { textoOrigen } from "./plannerCopia";
import type { ControlPlanner } from "./usePlanner";

const FUENTE: Record<string, string> = { hojas_ruta: "Hojas de ruta", monitoreo: "Monitoreo" };
const ETAPAS: readonly (readonly [PlannerEtapa, string])[] = [["piloto", "Piloto"], ["campo", "Campo"]];

export function PlannerCalendarioResumen({ recarga, control }: { recarga: unknown; control: ControlPlanner }) {
  const [cal, setCal] = useState<PlannerCalendario | null>(null);
  const revision = control.estado?.revision;
  useEffect(() => {
    let vivo = true;
    apiPlannerCalendario().then((c) => { if (vivo) setCal(c); }).catch(() => { if (vivo) setCal(null); });
    return () => { vivo = false; };
  }, [recarga, revision]);
  if (!cal) return null;

  const fuentes = Object.entries(cal.etapa.fuentes);
  const guardando = control.guardando === "etapa";
  const origen = cal.etapa.origen === "declarado"
    ? textoOrigen("declarado", control.estado?.declaradoEn.etapa)
    : !fuentes.length ? "sin declarar"
      : cal.etapa.valor ? `según ${fuentes.map(([k]) => FUENTE[k] ?? k).join(" y ")}`
        : `sin acuerdo entre ${fuentes.map(([k]) => FUENTE[k] ?? k).join(" y ")}`;

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
