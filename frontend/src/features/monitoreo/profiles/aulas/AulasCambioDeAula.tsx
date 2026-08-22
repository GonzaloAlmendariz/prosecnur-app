import { useMemo } from "react";

import type { MonitoreoRow } from "../../../../api/monitoreo";
import { aulaRealVsAgendada } from "./aulaRealVsAgendada";

/**
 * Las aulas que se aplicaron en otro salón.
 *
 * Va con el parte de campo porque es lo que anotó quien estuvo allí, y hasta
 * ahora nadie lo cruzaba con el plan.
 */

const fmt = (n: number) => n.toLocaleString("es-PE");

export function AulasCambioDeAula({ partes, plan }: {
  partes: ReadonlyArray<MonitoreoRow>;
  plan: ReadonlyArray<MonitoreoRow>;
}) {
  const r = useMemo(() => aulaRealVsAgendada(partes, plan), [partes, plan]);

  // Sin partes el panel se retira: la tabla de al lado ya dice «Todavía no se
  // ha registrado ningún parte de campo», y repetirlo sería ruido.
  if (!r.comparadas && !r.sinComparar) return null;

  // Hay partes pero el plan no aporta un solo salón agendado. Antes esto salía
  // como «N sin salón reconocible EN UNA DE LAS DOS HOJAS», que manda a revisar
  // el libro de campo cuando el que falta es el plan — y es justo el estado de
  // un proyecto cuyo plan de recolección quedó desfasado del sorteo vigente.
  if (!r.comparadas && !r.planConSalon) {
    return (
      <div className="aulas-cambio-aula">
        <p className="aulas-cambio-aula-lectura">
          No se puede saber si alguna aula se aplicó en otro salón: el plan agendado
          no trae salón para ningún curso-horario, así que no hay contra qué comparar
          los {fmt(r.sinComparar)} {r.sinComparar === 1 ? "parte" : "partes"} de campo.
        </p>
      </div>
    );
  }

  return (
    <div className="aulas-cambio-aula">
      <p className="aulas-cambio-aula-lectura">
        {r.cambios.length ? (
          <>
            {/* «partes» y no «aulas»: el panel cuenta 210 PARTES —filas de la
                hoja— y el plan tiene 196 aulas. Decir «30 de 210 aulas» metía
                la tercera cifra del perfil bajo la misma palabra. */}
            <strong>{fmt(r.cambios.length)}</strong> de {fmt(r.comparadas)}{" "}
            {r.cambios.length === 1 ? "parte declara" : "partes declaran"} un salón distinto
            del agendado
          </>
        ) : (
          <>Los {fmt(r.comparadas)} partes comparables declaran el salón agendado.</>
        )}
        {/* Sin salón reconocible se declara: no saber no es lo mismo que
            coincidir, y meterlas en el denominador diría que todo cuadró. Y se
            nombra CUÁL de las dos hojas falla cuando una sola explica el caso:
            «una de las dos hojas» obliga a abrir ambas para averiguarlo. */}
        {r.sinComparar ? (
          <>
            {" "}· <strong>{fmt(r.sinComparar)}</strong>{" "}
            {!r.sinSalonAgendado
              ? "sin salón anotado en el parte de campo"
              : !r.sinSalonReal
                ? "sin salón agendado en el plan"
                : "sin salón reconocible en una de las dos hojas"}
          </>
        ) : null}
      </p>
      {r.cambios.length ? (
        <ul className="aulas-cambio-aula-lista" data-qa-geometry-capacity="owned" data-qa-geometry-member>
          {r.cambios.map((c) => (
            <li key={c.codigo}>
              <span className="aulas-cambio-aula-codigo">{c.codigo}</span>
              <span className="aulas-cambio-aula-facultad" title={c.facultad}>{c.facultad}</span>
              {/* De → a, en ese orden: lo que importa es a dónde fue, y ponerlo
                  al final es donde el ojo termina. */}
              <span className="aulas-cambio-aula-salones">
                <em>{c.agendada}</em> → <strong>{c.real}</strong>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
