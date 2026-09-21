import { aulaDeLaClase, type ClaseSinCita } from "./clasesSinCita";
import { fmt } from "./kpisDeAulas";

/**
 * A qué clase se puede entrar ese día sin haberla agendado.
 *
 * Gonzalo, 2026-09-21: «el despliegue de las semanas [debe incluir] al lado una
 * tabla con los cursos-horario no agendados que se podrían ir a aplicar […]
 * para que los aplicadores tengan la opción de aplicar a esa sin agendar de ser
 * posible, sólo tendrían que tener bien clara la hora de inicio y fin de la
 * clase y el aula donde se dan». Y acotándolo el mismo día: «son las titulares
 * no agendadas por agendar, no todas; o sea no reemplazos ni extras».
 *
 * El operativo tiene dos velocidades. La cita pactada manda y es la que el
 * motor reparte; pero quien termina a las 10:00 y no tiene nada hasta las 15:00
 * no puede hacer nada con esas cinco horas, y al lado hay titulares del plan
 * cuya clase se dicta igual. Esta tabla es lo que convierte ese hueco en una
 * aplicación posible.
 *
 * **Por qué va DENTRO del día y no en un cuadro aparte.** Las horas sólo
 * significan algo contra las citas de ese mismo día: «10:00-12:00 en J301» se
 * lee para saber si cabe entre la cita de las 9 y la de la 1. En un cuadro
 * propio habría que cruzar dos pantallas, que es el trabajo que la tabla viene
 * a quitar.
 */
export function AulasClasesSinCita({ clases }: { clases: ClaseSinCita[] }) {
  if (!clases.length) return null;
  return (
    <details className="aulas-sincita">
      <summary>
        <strong>{fmt(clases.length)}</strong>{" "}
        {clases.length === 1 ? "clase a la que se puede entrar" : "clases a las que se puede entrar"}{" "}
        sin cita
        <em>titulares por agendar que se dictan ese día; hay que pedir permiso en la puerta</em>
      </summary>
      <table className="aulas-sincita-tabla">
        <thead>
          <tr>
            <th scope="col">Curso-horario</th>
            <th scope="col">Clase</th>
            <th scope="col">Lugar</th>
            <th scope="col">Elegibles</th>
          </tr>
        </thead>
        <tbody>
          {clases.map((c, i) => (
            <tr key={`${c.codigo}\r${c.inicio}\r${i}`}>
              <th scope="row">
                <span className="aulas-sincita-cod">{c.codigo}</span>
                {c.curso ? <span className="aulas-sincita-curso">{c.curso}</span> : null}
                {c.docente ? <span className="aulas-sincita-doc">{c.docente}</span> : null}
              </th>
              <td className="aulas-sincita-hora">
                {c.inicio}–{c.fin}
                {c.modalidad && c.modalidad.toUpperCase() !== "PRESENCIAL" ? (
                  <em>{c.modalidad.toLowerCase()}</em>
                ) : null}
              </td>
              <td className="aulas-sincita-aula" data-incierta={c.aulaIncierta ? "1" : undefined}>
                {aulaDeLaClase(c) || "—"}
                {/* El catálogo entrega días y aulas en dos campos construidos
                    por funciones distintas y su orden no se promete: con varias,
                    elegir una mandaría a alguien a la puerta equivocada. Se
                    dicen las dos y se pide confirmar. */}
                {c.aulaIncierta ? <em>confirma cuál ese día</em> : null}
              </td>
              <td className="aulas-sincita-eleg">{c.elegibles === null ? "—" : fmt(c.elegibles)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
