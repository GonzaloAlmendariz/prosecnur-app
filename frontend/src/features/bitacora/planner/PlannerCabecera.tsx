// Cabecera de una sección del Planner: qué es, de dónde sale lo que muestra y
// su acción principal. El origen se dice siempre (C1): «leído del proyecto»
// no es lo mismo que «declarado», y confundirlos es justo lo que el Planner
// existe para evitar.

import type { ReactNode } from "react";

import type { PlannerOrigen } from "../../../api/planner";
import { textoOrigen } from "./plannerCopia";

type Props = {
  titulo: string;
  lead: string;
  origen?: PlannerOrigen;
  declaradoEn?: string;
  acciones?: ReactNode;
};

export function PlannerCabecera({ titulo, lead, origen, declaradoEn, acciones }: Props) {
  return (
    <header className="planner-cabecera">
      <div className="planner-cabecera-texto">
        <h2>{titulo}</h2>
        <p>{lead}</p>
      </div>
      <div className="planner-cabecera-lado">
        {origen ? (
          <span className={`planner-origen planner-origen--${origen}`}>{textoOrigen(origen, declaradoEn)}</span>
        ) : null}
        {acciones}
      </div>
    </header>
  );
}

export function PlannerAvisos({ avisos, tono }: { avisos: { mensaje: string }[]; tono: "aviso" | "conflicto" }) {
  if (!avisos.length) return null;
  return (
    <ul className={`planner-avisos planner-avisos--${tono}`} role={tono === "conflicto" ? "alert" : undefined}>
      {avisos.map((a, i) => <li key={`${tono}-${i}`}>{a.mensaje}</li>)}
    </ul>
  );
}
