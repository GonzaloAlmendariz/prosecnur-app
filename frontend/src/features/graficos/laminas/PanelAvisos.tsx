// Panel «Avisos del informe» (`panel=avisos`, sideover) de la pestaña Láminas (F6.1, parte 2). Separa lo que bloquea
// la exportación (errores del validador del plan) de lo que conviene revisar y de lo que dijo el motor en las láminas
// ya vistas. Cada aviso con lámina lleva a ella.

import { useMemo } from "react";
import { X } from "../../../vendor/lucide-react";
import type { ControlPanel } from "../../../lib/navegacion/paneles";
import type { ValidationIssue } from "../usePlanValidator";
import type { EstructuraInforme } from "./modeloEstructura";
import type { GrupoAvisos } from "./resumenInforme";
import "./panelAvisos.css";

type Props = {
  panel: ControlPanel;
  grupos: GrupoAvisos;
  estructura: EstructuraInforme;
  onIr: (posicion: number) => void;
};

export function PanelAvisos({ panel, grupos, estructura, onIr }: Props) {
  const posicionDe = useMemo(() => new Map(estructura.laminas.map((l) => [l.id, l.posicion])), [estructura]);
  const ir = (slideId: string | undefined) => {
    const p = slideId ? posicionDe.get(slideId) : undefined;
    if (p) onIr(p);
  };
  const fila = (i: ValidationIssue, k: number) => (
    <li key={`${i.code}-${i.slideId ?? ""}-${i.slotName ?? ""}-${k}`}>
      <span>{i.message}</span>
      {i.slideId && posicionDe.has(i.slideId) && (
        <button type="button" className="pulso-f6-texto-boton" onClick={() => ir(i.slideId)}>
          Lámina {posicionDe.get(i.slideId)}
        </button>
      )}
    </li>
  );

  return (
    <aside
      className="pulso-f6-avisos-panel"
      aria-label="Avisos del informe"
      {...panel.props}
      onKeyDown={(e) => { if (e.key === "Escape") panel.cerrar(); }}
    >
      <header className="pulso-f6-col-head">
        <h2>Avisos del informe</h2>
        <span className="pulso-f6-col-sp" />
        <button type="button" className="pulso-f6-icono-boton" aria-label="Cerrar avisos" onClick={panel.cerrar}>
          <X size={16} aria-hidden="true" />
        </button>
      </header>
      <div className="pulso-f6-avisos-cuerpo" data-qa-geometry-group="graficos/f6-avisos-grupos" data-qa-geometry-contract="intrinsic">
        <section className="pulso-f6-avisos-grupo is-bloquea" aria-label="Bloquean la exportación">
          <h3>Bloquean la exportación <span>{grupos.bloquean.length}</span></h3>
          {grupos.bloquean.length ? <ul data-qa-geometry-group="graficos/f6-avisos-bloquean" data-qa-geometry-contract="intrinsic">{grupos.bloquean.map(fila)}</ul> : <p>Nada bloquea la exportación.</p>}
        </section>
        <section className="pulso-f6-avisos-grupo" aria-label="Conviene revisar">
          <h3>Conviene revisar <span>{grupos.revisar.length}</span></h3>
          {grupos.revisar.length ? <ul data-qa-geometry-group="graficos/f6-avisos-revisar" data-qa-geometry-contract="intrinsic">{grupos.revisar.map(fila)}</ul> : <p>Sin advertencias del plan.</p>}
        </section>
        <section className="pulso-f6-avisos-grupo" aria-label="Avisos del motor">
          <h3>Avisos del motor <span>{grupos.motor.reduce((t, m) => t + m.avisos.length, 0)}</span></h3>
          {grupos.motor.length ? (
            <ul data-qa-geometry-group="graficos/f6-avisos-motor" data-qa-geometry-contract="intrinsic">
              {grupos.motor.flatMap((m) => m.avisos.map((a, k) => (
                <li key={`${m.slideId}-${k}`}>
                  <span>{a}</span>
                  <button type="button" className="pulso-f6-texto-boton" onClick={() => ir(m.slideId)}>
                    Lámina {posicionDe.get(m.slideId)}
                  </button>
                </li>
              )))}
            </ul>
          ) : (
            <p>El motor avisa al generar cada lámina; aparecen aquí las de las láminas ya vistas.</p>
          )}
        </section>
      </div>
    </aside>
  );
}
