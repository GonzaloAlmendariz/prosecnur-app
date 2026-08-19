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

  if (!r.comparadas && !r.sinComparar) return null;

  return (
    <div className="aulas-cambio-aula">
      <p className="aulas-cambio-aula-lectura">
        {r.cambios.length ? (
          <>
            <strong>{fmt(r.cambios.length)}</strong> de {fmt(r.comparadas)}{" "}
            {r.cambios.length === 1 ? "aula se aplicó" : "aulas se aplicaron"} en un salón distinto
            del agendado
          </>
        ) : (
          <>Las {fmt(r.comparadas)} aulas comparables se aplicaron en el salón agendado.</>
        )}
        {/* Sin salón reconocible se declara: no saber no es lo mismo que
            coincidir, y meterlas en el denominador diría que todo cuadró. */}
        {r.sinComparar ? (
          <> · <strong>{fmt(r.sinComparar)}</strong> sin salón reconocible en una de las dos hojas</>
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
