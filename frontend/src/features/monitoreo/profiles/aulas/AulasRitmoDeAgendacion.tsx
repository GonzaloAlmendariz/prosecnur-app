import { useMemo } from "react";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { colaDeContacto } from "./colaDeContacto";
import { fmt } from "./kpisDeAulas";
import { ritmoDeAgendacion } from "./ritmoDeAgendacion";
import "./aulasRitmoDeAgendacion.css";

/**
 * El ritmo diario de la agendación, EN la pestaña de contacto (dictado
 * 2026-09-03: «no hay forma de poder ver el avance diario de agendación, qué
 * tan rápido se agenda, el ritmo diario»).
 *
 * Barras CSS por jornada —el precedente del embudo—, la lectura del ritmo y
 * la proyección sobre la cola real (`colaDeContacto`, una sola verdad de lo
 * pendiente). El proxy de la fecha se hereda declarado del módulo: la
 * jornada es la de la última gestión tecleada.
 */

const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

/** «2026-09-03» → «mié 3/09», sin locale (el patrón de la casa). */
const etiquetaCorta = (iso: string): string => {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return `${DIAS[d.getDay()]} ${d.getDate()}/${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export function AulasRitmoDeAgendacion({ filas }: {
  filas: ReadonlyArray<MonitoreoAulasPlanRow>;
}) {
  const ritmo = useMemo(() => ritmoDeAgendacion(filas), [filas]);
  const pendientes = useMemo(() => colaDeContacto(filas).pendientes.length, [filas]);

  if (!ritmo.jornadas.length) {
    return (
      <div className="aulas-ritmo" data-qa-geometry-member data-qa-geometry-capacity="owned">
        <p className="aulas-medio-titulo">El ritmo de la agendación</p>
        <p className="mon-profile-muted">
          Todavía no hay citas agendadas con fecha de gestión: el ritmo se
          dibuja con la primera jornada de llamadas.
          {ritmo.sinFechaDeGestion
            ? ` (Hay ${fmt(ritmo.sinFechaDeGestion)} citas agendadas sin fecha de gestión en el libro.)`
            : ""}
        </p>
      </div>
    );
  }

  const max = Math.max(1, ...ritmo.jornadas.map((j) => j.nuevas));
  const faltantes = ritmo.porJornada && ritmo.porJornada > 0
    ? Math.ceil(pendientes / ritmo.porJornada)
    : null;

  return (
    <div className="aulas-ritmo" data-qa-geometry-member data-qa-geometry-capacity="owned">
      <p className="aulas-medio-titulo">El ritmo de la agendación</p>
      <p className="aulas-ritmo-lectura">
        <strong>{fmt(ritmo.conFecha)}</strong> agendadas en{" "}
        <strong>{fmt(ritmo.jornadas.length)}</strong>{" "}
        {ritmo.jornadas.length === 1 ? "jornada" : "jornadas"} de gestión
        {ritmo.porJornada !== null && ritmo.jornadas.length > 1
          ? <> · ~<strong>{ritmo.porJornada.toLocaleString("es-PE")}</strong> por jornada</>
          : null}
        {ritmo.pico
          ? <> · la mejor: {etiquetaCorta(ritmo.pico.fecha)} con <strong>{fmt(ritmo.pico.nuevas)}</strong></>
          : null}
        {/* La proyección dice su denominador: la cola REAL (sin rechazos,
            dormidas ni aplicadas) al ritmo de las jornadas con actividad. */}
        {faltantes !== null && pendientes > 0
          ? <>. A este ritmo, {pendientes === 1 ? "el" : "los"} <strong>{fmt(pendientes)}</strong> de
            la cola {pendientes === 1 ? "tomaría" : "tomarían"} ~<strong>{fmt(faltantes)}</strong>{" "}
            {faltantes === 1 ? "jornada más" : "jornadas más"}</>
          : null}
        {ritmo.sinFechaDeGestion
          ? <em> · {fmt(ritmo.sinFechaDeGestion)}{" "}
            {ritmo.sinFechaDeGestion === 1 ? "cita agendada" : "citas agendadas"} sin fecha de
            gestión no {ritmo.sinFechaDeGestion === 1 ? "entra" : "entran"} al ritmo</em>
          : null}
      </p>
      <ul className="aulas-ritmo-jornadas">
        {ritmo.jornadas.map((j) => (
          <li key={j.fecha}>
            <span className="aulas-ritmo-fecha">{etiquetaCorta(j.fecha)}</span>
            <span className="aulas-ritmo-pista" role="img"
              aria-label={`${etiquetaCorta(j.fecha)}: ${fmt(j.nuevas)} ${j.nuevas === 1 ? "agendada" : "agendadas"}`}>
              <i style={{ width: `${(100 * j.nuevas) / max}%` }} />
            </span>
            <span className="aulas-ritmo-n">{fmt(j.nuevas)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
