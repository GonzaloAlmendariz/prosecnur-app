// Identidad › Fase activa: en qué etapa está el estudio y cuál es su ventana de
// campo, tal como las declara Cronograma. Aquí sólo se leen: se cambian allá.

import { Link } from "react-router-dom";

import type { PlannerCalendario } from "../../../api/planner";
import { parseLocalDate } from "../dateUtils";

const ETAPA = { piloto: "Piloto", campo: "Campo" } as const;

function dia(iso: string) {
  const d = parseLocalDate(iso);
  return d ? d.toLocaleDateString("es-PE", { day: "numeric", month: "short" }).replace(".", "") : "";
}

export function textoVentana(v: PlannerCalendario["ventana"]) {
  if (!v.inicio) return "sin ventana de campo";
  return `${dia(v.inicio)} → ${v.fin ? dia(v.fin) : "sin fin"}`;
}

export function PlannerFaseActiva({ cal }: { cal: PlannerCalendario | null }) {
  if (!cal) return null;
  const etapa = cal.etapa.valor ? ETAPA[cal.etapa.valor] : "Etapa sin declarar";
  return (
    <dl className="planner-calendario-datos planner-fase-activa">
      <div>
        <dt>Fase activa</dt>
        <dd>
          {etapa} · {textoVentana(cal.ventana)}
          <Link className="planner-fase-activa-enlace" to="/planner?seccion=cronograma">Cambiar en Cronograma</Link>
        </dd>
      </div>
    </dl>
  );
}
