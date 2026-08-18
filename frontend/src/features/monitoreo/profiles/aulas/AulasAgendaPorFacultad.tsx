import { useMemo } from "react";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { agendaPorFacultad } from "./agendaPorFacultad";
import { EstadoEnCelda } from "./EstadoEnCelda";
import { ESTADOS_OPERATIVOS } from "./aulasPresentation";

/**
 * A dónde hay que ir, facultad por facultad.
 *
 * La tabla de la agenda está en orden de curso-horario, que sirve para BUSCAR
 * una fila cuando ya se sabe el código. Esta vista contesta la otra pregunta,
 * la de campo: «hoy toca esta facultad, ¿qué aulas son, a qué hora y dónde?».
 */

const fmt = (n: number) => n.toLocaleString("es-PE");

const ROTULO = new Map(ESTADOS_OPERATIVOS.map((e) => [e.value, e.label]));

/** «2026-08-11» → «mar 11/08». La fecha larga no cabe y no se lee de un golpe. */
function fechaCorta(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  const dia = d.toLocaleDateString("es-PE", { weekday: "short" }).replace(".", "");
  return `${dia} ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function AulasAgendaPorFacultad({ filas }: { filas: ReadonlyArray<MonitoreoAulasPlanRow> }) {
  const facultades = useMemo(() => agendaPorFacultad(filas), [filas]);

  if (!facultades.length) {
    return (
      <p className="mon-profile-muted">
        No hay agenda de cursos-horario. Importa el plan desde el cálculo de muestra para ver
        a dónde hay que ir.
      </p>
    );
  }

  const total = facultades.reduce((n, f) => n + f.aulas.length, 0);
  const sinFecha = facultades.reduce((n, f) => n + f.aulas.filter((a) => !a.fecha).length, 0);

  return (
    <div className="aulas-ruta">
      <p className="aulas-ruta-lectura">
        <strong>{fmt(total)}</strong> {total === 1 ? "curso-horario" : "cursos-horario"} en{" "}
        <strong>{fmt(facultades.length)}</strong>{" "}
        {facultades.length === 1 ? "facultad" : "facultades"}, por el día en que empieza cada una
        {sinFecha ? <> · <strong>{fmt(sinFecha)}</strong> sin fecha, al final de su facultad</> : null}
      </p>
      {/* Abierta la PRIMERA y cerradas las demás. Con las 20 abiertas la lista
          mide 5 538 px y hay que recorrerla entera para encontrar la facultad
          que toca; cerradas todas, la vista abre sin un solo dato y obliga a un
          click para ver cualquier cosa. Abriendo la primera —la del día que
          viene antes— se entra viendo trabajo real y el resto queda como índice
          de una pantalla. */}
      <div className="aulas-ruta-lista" data-qa-geometry-capacity="owned" data-qa-geometry-member>
        {facultades.map((f, i) => (
          <details key={f.facultad} open={i === 0} className="aulas-ruta-facultad">
            <summary>
              <span className="aulas-ruta-nombre">{f.facultad}</span>
              <span className="aulas-ruta-cuenta">
                {fmt(f.aulas.length)} {f.aulas.length === 1 ? "aula" : "aulas"}
                {f.enMarcha ? <em> · {fmt(f.enMarcha)} en marcha</em> : null}
              </span>
              <span className="aulas-ruta-desde">
                {f.primeraFecha ? `desde ${fechaCorta(f.primeraFecha)}` : "sin fecha"}
              </span>
            </summary>
            <ul>
              {f.aulas.map((a) => (
                <li key={a.codigo}>
                  <span className="aulas-ruta-cuando">
                    {a.fecha ? fechaCorta(a.fecha) : "—"}
                    {a.hora ? <em> {a.hora}</em> : null}
                  </span>
                  <span className="aulas-ruta-codigo">{a.codigo}</span>
                  {/* DÓNDE, que es lo que se viene a buscar: «LUN 08:00 A101»
                      lleva el pabellón y el salón. Sin esta columna la vista
                      diría cuándo y con quién, y no a dónde ir. */}
                  <span className="aulas-ruta-donde" title={a.donde}>{a.donde || "—"}</span>
                  <span className="aulas-ruta-docente" title={a.docente}>{a.docente || "—"}</span>
                  <span className="aulas-ruta-estado">
                    <EstadoEnCelda valor={ROTULO.get(a.estado) ?? a.estado} />
                  </span>
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>
    </div>
  );
}
