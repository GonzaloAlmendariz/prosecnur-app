import type { ReactNode } from "react";

import { fmt } from "./kpisDeAulas";
import { resumenPorFacultad } from "./resumenPorFacultad";
import { claseDeFacultad } from "./tonoDeFacultad";
import type {
  MonitoreoAulasPorFacultad,
  MonitoreoAulasRespuestasCuenta,
} from "../../../../api/monitoreo";
import "./aulasResumenPorFacultad.css";

/**
 * El primer alcance de Avance: las quince facultades de un vistazo.
 *
 * Contesta las tres cosas que Gonzalo pide de esta pestaña —«las respuestas
 * efectivas de las facultades, las aulas, cuántas se han aplicado»— y ninguna
 * estaba: el bloque de respuestas daba el total y filtraba de una en una.
 *
 * **La barra mide AULAS, no respuestas.** Las efectivas van como cifra porque
 * su escala la fija la cuota de cada facultad y no se comparan entre sí; las
 * aulas sí tienen un denominador propio y comparable —lo planificado— y su
 * avance es lo que dice si el trabajo de campo de esa facultad está hecho.
 */
export function AulasResumenPorFacultad({ respuestas, aulas }: {
  respuestas: ReadonlyArray<MonitoreoAulasRespuestasCuenta & { facultad: string }> | null | undefined;
  aulas: ReadonlyArray<MonitoreoAulasPorFacultad> | null | undefined;
}): ReactNode {
  const filas = resumenPorFacultad(respuestas, aulas);
  if (!filas.length) return null;
  return (
    <div className="aulas-rpf">
      <ul className="aulas-rpf-lista" role="table"
        aria-label="Respuestas efectivas y aulas de cada facultad">
        <li role="row" className="aulas-rpf-cab">
          <span role="columnheader">Facultad</span>
          <span role="columnheader">Efectivas</span>
          <span role="columnheader">Cursos-horario aplicados</span>
          <span role="columnheader">Aplicados</span>
          <span role="columnheader">Planificados</span>
        </li>
        {filas.map((f) => {
          const avance = f.planificadas && f.planificadas > 0
            ? Math.min(100, (100 * (f.aplicadas ?? 0)) / f.planificadas)
            : null;
          return (
            <li key={f.facultad} role="row">
              <span role="cell">
                <span className={claseDeFacultad(f.facultad)}>{f.facultad}</span>
              </span>
              <span role="cell" className="aulas-rpf-num aulas-rpf-efectivas">
                {fmt(f.efectivas)}
              </span>
              <span role="cell" className="aulas-rpf-barra">
                {/* Sin plan no hay denominador y la barra no se dibuja: una
                    barra vacía se leería como «no ha empezado», que es otra
                    cosa que «no sé cuántas tenía que hacer». */}
                {avance === null ? (
                  <em className="aulas-rpf-sindato">sin plan declarado</em>
                ) : (
                  <i style={{ width: `${Math.max(2, avance)}%` }} />
                )}
              </span>
              <span role="cell" className="aulas-rpf-num">
                {f.aplicadas === null ? "—" : fmt(f.aplicadas)}
              </span>
              <span role="cell" className="aulas-rpf-num aulas-rpf-debil">
                {f.planificadas === null ? "—" : fmt(f.planificadas)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
