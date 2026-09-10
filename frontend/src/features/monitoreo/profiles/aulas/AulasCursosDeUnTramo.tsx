import type { ReactNode } from "react";

import { fmt, pctPerfil } from "./kpisDeAulas";
import { cursosDeUnTramo } from "./cursosDeUnTramo";
import { claseDeFacultad } from "./tonoDeFacultad";
import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import "./aulasCursosDeUnTramo.css";

/**
 * Los cursos-horario de un tramo de cobertura, uno por uno.
 *
 * Gonzalo, 2026-09-10: «sería interesante que yo pudiera hacer clic en uno de
 * ellos —"se quedó a medias"— y que abajo se mostrara de forma profesional y
 * minimalista cuáles son esos CH, y que me muestren el rendimiento del aula, el
 * rendimiento esperado, la cantidad de elegibles, la cantidad obtenida, por cada
 * CH o R que haga referencia».
 *
 * **El orden de las columnas ES la cadena del operativo**, y en ese orden se
 * lee: de los elegibles se esperaba recoger unas cuantas, ese día estaban tantos
 * y respondieron tantas. Ponerlas en otro orden obligaría a reconstruir la
 * cadena de cabeza en cada fila.
 *
 * **Y «elegibles» no son los asistentes.** Los elegibles son los matriculados
 * que cumplen los criterios de inclusión y exclusión —no cambian—; los
 * asistentes son los que aparecieron ese día. Confundirlos es el error que él
 * tuvo que corregirme, y por eso cada columna lleva su palabra.
 */
export function AulasCursosDeUnTramo({ filas, tramo, etiqueta, onCerrar }: {
  filas: ReadonlyArray<MonitoreoAulasPlanRow> | null | undefined;
  tramo: string;
  etiqueta: string;
  onCerrar: () => void;
}): ReactNode {
  const cursos = cursosDeUnTramo(filas, tramo);
  return (
    <div className="aulas-cdt" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
      <p className="aulas-cdt-cabeza">
        <span>
          <strong>{fmt(cursos.length)}</strong>{" "}
          {cursos.length === 1 ? "curso-horario" : "cursos-horario"} en «{etiqueta}»
        </span>
        <button type="button" onClick={onCerrar}>Cerrar</button>
      </p>
      {cursos.length === 0 ? (
        <p className="mon-profile-muted">
          Ninguno cae en este tramo ahora mismo.
        </p>
      ) : (
        <div className="aulas-cdt-marco">
          <table className="aulas-cdt-tabla">
            {/* Anchos declarados: una tabla cuyas columnas se mueven con el dato
                no es una tabla. Misma regla que «Metas y aulas». */}
            <colgroup>
              <col style={{ width: "16rem" }} />
              <col style={{ width: "6rem" }} />
              <col style={{ width: "6.5rem" }} />
              <col style={{ width: "6rem" }} />
              <col style={{ width: "6rem" }} />
              <col style={{ width: "7rem" }} />
            </colgroup>
            <thead>
              <tr>
                <th className="es-izq">Curso-horario</th>
                {/* Cada rótulo dice qué cuenta, porque en este perfil conviven
                    tres denominadores parecidos. */}
                <th title="Matriculados que cumplen los criterios de inclusión y exclusión. No cambian con el día.">
                  Elegibles
                </th>
                <th title="Lo que el diseño esperaba recoger de este curso-horario: elegibles por la tasa prevista para él.">
                  Esperadas
                </th>
                <th title="Los que estaban en el aula el día de la aplicación, según el parte de campo. No son los elegibles.">
                  Asistentes
                </th>
                <th title="Encuestas válidas conseguidas.">Efectivas</th>
                <th title="Efectivas sobre esperadas: es lo que reparte los tramos de este gráfico.">
                  Cumplimiento
                </th>
              </tr>
            </thead>
            <tbody>
              {cursos.map((c) => (
                <tr key={c.codigo}>
                  <th scope="row" className="es-izq">
                    {c.codigo}
                    {c.facultad ? (
                      <em><span className={claseDeFacultad(c.facultad)}>{c.facultad}</span></em>
                    ) : null}
                  </th>
                  {/* «—» y no cero cuando no hay dato: un aula sin parte no tuvo
                      cero asistentes, es que todavía no sabemos cuántos. */}
                  <td className="es-num">{c.elegibles == null ? "—" : fmt(c.elegibles)}</td>
                  <td className="es-num">{c.esperadas == null ? "—" : fmt(Math.round(c.esperadas))}</td>
                  <td className="es-num">{c.asistentes == null ? "—" : fmt(c.asistentes)}</td>
                  <td className="es-num es-fuerte">{fmt(c.efectivas)}</td>
                  <td className="es-num">{c.cumplimiento == null ? "—" : pctPerfil(c.cumplimiento)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {/* **El recorte del payload se declara.** `course_status` viaja con 500 de
          las 1 392 filas del plan. Hoy no muerde —los aplicados son 49 y el
          recorte pone titulares primero— pero decirlo es lo que evita que un día
          el operativo crezca y esta lista se quede corta en silencio. */}
      <p className="mon-profile-table-recorte">
        Sale de los cursos-horario aplicados que viajan al tablero; los
        pendientes no entran porque su previsión es condicional a aplicarse.
      </p>
    </div>
  );
}
