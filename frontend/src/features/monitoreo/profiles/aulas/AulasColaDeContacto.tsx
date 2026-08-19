import { useMemo } from "react";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { colaDeContacto } from "./colaDeContacto";

/**
 * A quién llamar hoy, y cuánto ha costado agendar.
 *
 * Cuando no queda nadie por llamar, el panel NO se queda vacío: enseña el
 * esfuerzo ya gastado por facultad, que es lo único que el ciclo de contacto
 * todavía puede decir y sirve para la próxima ola.
 */

const fmt = (n: number) => n.toLocaleString("es-PE");

export function AulasColaDeContacto({ filas }: { filas: ReadonlyArray<MonitoreoAulasPlanRow> }) {
  const { pendientes, esfuerzo } = useMemo(() => colaDeContacto(filas), [filas]);

  // **Dos causas, y ninguna era la que decía el mensaje.** Con filas presentes la
  // cola sólo queda vacía si TODAS quedan fuera por una razón buena —banco,
  // reserva dormida, ya citada o ya reemplazada—, no porque «no declaren su ciclo
  // de contacto». Ese texto mandaba a rellenar un campo del libro que está bien.
  if (!pendientes.length && !esfuerzo.length) {
    return (
      <p className="mon-profile-muted">
        {filas.length
          ? `No queda ningún curso-horario a quien llamar: los ${fmt(filas.length)} del plan están citados, en reserva o ya reemplazados.`
          : "El plan todavía no trae cursos-horario a los que contactar."}
      </p>
    );
  }

  return (
    <div className="aulas-cola">
      <p className="aulas-medio-titulo">A quién llamar</p>
      <p className="aulas-cola-lectura">
        {pendientes.length ? (
          <>
            <strong>{fmt(pendientes.length)}</strong>{" "}
            {pendientes.length === 1 ? "curso-horario sigue" : "cursos-horario siguen"} sin cita ·
            el que más lleva va por <strong>{fmt(pendientes[0].intentos)}</strong>{" "}
            {pendientes[0].intentos === 1 ? "intento" : "intentos"}
          </>
        ) : (
          <>Todos los cursos-horario del plan tienen cita: no queda nadie a quien llamar.</>
        )}
      </p>
      {pendientes.length ? (
        <ul className="aulas-cola-lista" data-qa-geometry-capacity="owned" data-qa-geometry-member>
          {pendientes.map((p) => (
            <li key={p.codigo}>
              <span className="aulas-cola-codigo">{p.codigo}</span>
              <span className="aulas-cola-quien" title={`${p.docente} · ${p.facultad}`}>
                {p.docente || "—"}
                <em>{p.facultad}</em>
              </span>
              {/* El teléfono y el medio JUNTOS: es lo que se necesita en la mano
                  para hacer la llamada, y separarlos obliga a cruzar dos
                  columnas. */}
              <span className="aulas-cola-como">
                {p.telefono || "—"}
                {p.medio ? <em> · {p.medio}</em> : null}
              </span>
              <span className="aulas-cola-intentos">
                <strong>{fmt(p.intentos)}</strong>
                {p.ultimaLlamada ? <em> · {p.ultimaLlamada}</em> : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {esfuerzo.length ? (
        <>
          {/* Lo que costó agendar, que es lo que este ciclo puede decir cuando
              ya no queda cola. Una facultad que costó cuatro intentos por aula
              va a costar lo mismo la próxima ola. */}
          <p className="aulas-cola-subtitulo">Lo que costó agendar, por facultad</p>
          <ul className="aulas-cola-esfuerzo" data-qa-geometry-capacity="owned" data-qa-geometry-member>
            {esfuerzo.map((e) => (
              <li key={e.facultad}>
                <span title={e.facultad}>{e.facultad}</span>
                <span>
                  {e.intentos == null ? "—" : `${e.intentos.toLocaleString("es-PE")} med.`}
                  {/* «cursos-horario», que es lo que cuenta el plan y lo que
                      dice el vacío de este mismo componente tres líneas arriba
                      —«Todos los cursos-horario del plan tienen cita»—. Decía
                      «aulas», y en este perfil no son la misma unidad. */}
                  <em> · {fmt(e.aulas)} {e.aulas === 1 ? "curso-horario" : "cursos-horario"}</em>
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
