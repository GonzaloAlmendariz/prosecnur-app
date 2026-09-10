import type { ReactNode } from "react";

import type { MonitoreoRow } from "../../../../api/monitoreo";
import { agendacionDeAulas } from "./agendacionDeAulas";
import { etiquetaDeFecha } from "./agendaPorDia";
import { fmt } from "./kpisDeAulas";
import "./aulasAgendacion.css";

/**
 * Cómo va la agendación: el trabajo que decide a qué aulas se va a ir.
 *
 * Gonzalo: «es muy importante tener en Resumen cómo va la agendación de aulas,
 * porque es lo que nos permite decir a estas aulas vamos a ir a aplicar, y eso
 * está en el Sheets».
 *
 * **No repite «Estado de aplicación».** Aquel reparte los titulares por su punto
 * del circuito y contesta dónde está cada uno hoy; éste contesta si el trabajo
 * de agendar va a un ritmo que alcance, que es una pregunta sobre el equipo y no
 * sobre las aulas.
 *
 * **No proyecta.** Él descartó el pronóstico lineal para las aplicaciones y aquí
 * valdría igual: se publican los días medidos y lo que queda, y la cuenta la
 * hace quien lee, que sabe cuántos días de campo le quedan.
 */
export function AulasAgendacion({ agenda }: {
  agenda: ReadonlyArray<MonitoreoRow> | null | undefined;
}): ReactNode {
  const a = agendacionDeAulas(agenda);

  if (!a.titulares) {
    return (
      <div className="mon-profile-table-wrap" data-qa-geometry-capacity="owned" data-qa-geometry-member>
        <p className="mon-profile-muted">
          El plan todavía no trae cursos-horario titulares que agendar.
        </p>
      </div>
    );
  }

  const tope = a.porDia.reduce((m, d) => Math.max(m, d.aulas), 0);

  return (
    <div className="aulas-agd" data-qa-geometry-capacity="owned" data-qa-geometry-member>
      <p className="aulas-agd-lectura">
        {a.sinFecha ? (
          <>
            Quedan <strong>{fmt(a.sinFecha)}</strong> cursos-horario{" "}
            {a.sinFecha === 1 ? "sin fecha" : "sin fecha"}
            {a.ultimosAulas ? (
              <> · en {a.ultimosDias === 1 ? "el último día" : `los últimos ${fmt(a.ultimosDias)} días`}{" "}
              con agendación se pusieron <strong>{fmt(a.ultimosAulas)}</strong></>
            ) : null}
          </>
        ) : (
          <>Todos los cursos-horario titulares tienen fecha.</>
        )}
        {a.hasta ? <> · lo agendado llega hasta el {etiquetaDeFecha(a.hasta)}</> : null}
      </p>

      {a.porDia.length ? (
        <>
          {/* **Barras por día de AGENDACIÓN**, que es cuándo se habló con el
              docente y no cuándo se va al aula. En el corte del 2026-09-10 la
              forma habla sola: 29, 34 y 50 la semana antes del campo, y 4, 13 y
              19 desde que empezó — agendar y aplicar compiten por la misma
              gente. */}
          <ul className="aulas-agd-dias" role="img"
            aria-label={`Cursos-horario agendados por día: ${a.porDia.map((d) => `${d.fecha}: ${d.aulas}`).join(", ")}`}>
            {a.porDia.map((d) => (
              <li key={d.fecha}>
                <span className="aulas-agd-n">{fmt(d.aulas)}</span>
                <span className="aulas-agd-barra">
                  <i style={{ height: `${tope ? (100 * d.aulas) / tope : 0}%` }} />
                </span>
                <span className="aulas-agd-dia">{d.fecha.slice(8, 10)}</span>
              </li>
            ))}
          </ul>
          <p className="aulas-agd-pie">
            cursos-horario agendados cada día · {a.porDia.length === 1 ? "1 día" : `${fmt(a.porDia.length)} días`} con agendación
          </p>
        </>
      ) : null}

      {a.faltanPorFacultad.length ? (
        <p className="aulas-agd-faltan">
          {/* A quién le falta, con nombre: «29 sin fecha» no dice a quién llamar. */}
          Sin fecha:{" "}
          {a.faltanPorFacultad.slice(0, 6).map((f, i) => (
            <span key={f.facultad}>
              {i ? " · " : ""}<strong>{fmt(f.aulas)}</strong> {f.facultad}
            </span>
          ))}
          {a.faltanPorFacultad.length > 6 ? (
            <> · y {fmt(a.faltanPorFacultad.length - 6)} facultades más</>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
