import { useMemo } from "react";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { colaDeContacto } from "./colaDeContacto";
import { NombreDeFacultad } from "./NombreDeFacultad";
import type { FocoDeCuota } from "./AulasCuotasResumen";
import { fmt } from "./kpisDeAulas";

/**
 * A quién llamar hoy, y cuánto ha costado agendar.
 *
 * Cuando no queda nadie por llamar, el panel NO se queda vacío: enseña el
 * esfuerzo ya gastado por facultad, que es lo único que el ciclo de contacto
 * todavía puede decir y sirve para la próxima ola.
 */

/**
 * La fecha de una cita, en calendario y no en ISO.
 *
 * `scheduled_date` llega como «2026-09-01», que es el formato en que la guarda
 * el libro pero no en el que nadie agenda: para saber si una cita cae en día
 * laborable hay que leer el día de la semana, y ahí no está.
 *
 * **Lo que no parsea se devuelve entero.** Ese campo lo puede escribir a mano
 * quien edita la agendación en el Excel, así que puede traer «1/9», «lunes» o
 * cualquier cosa; enseñarla tal cual deja ver el error, e inventarle una fecha
 * lo escondería.
 */
const CALENDARIO = new Intl.DateTimeFormat("es-PE", { weekday: "short", day: "numeric", month: "short" });

function diaLegible(iso: string): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return iso;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(d.getTime())) return iso;
  return CALENDARIO.format(d).replace(/\.$/, "");
}

export function AulasColaDeContacto({ filas, facultadEnFoco, onFoco }: {
  filas: ReadonlyArray<MonitoreoAulasPlanRow>;
  /**
   * La facultad enfocada. **Resalta, no filtra**, como en las cinco listas de
   * Avance: ésta es la última lista de facultad del perfil que no participaba
   * del foco, y con ella la pregunta «¿cómo va Derecho?» se contesta también
   * desde Modelo, sin volver a buscar su fila a ojo.
   */
  facultadEnFoco?: string;
  /** Pulsar un nombre pone el foco. Sin esto, los nombres son sólo texto. */
  onFoco?: (foco: FocoDeCuota) => void;
}) {
  const { pendientes, citadas, esfuerzo } = useMemo(() => colaDeContacto(filas), [filas]);
  // Los cuatro estados con su conteo, sin los que valen cero: un «0 con cita»
  // permanente entrena a no mirar la banda.
  const resumen = useMemo(() => {
    const insistiendo = pendientes.filter((p) => p.intentos > 0).length;
    const aplicadas = citadas.filter((c) => c.aplicada).length;
    return [
      { clase: "es-sin-empezar", etiqueta: "Sin contactar", n: pendientes.length - insistiendo },
      { clase: "es-insistiendo", etiqueta: "Insistiendo", n: insistiendo },
      { clase: "es-citada", etiqueta: "Con cita", n: citadas.length - aplicadas },
      { clase: "es-aplicada", etiqueta: "Aplicadas", n: aplicadas },
    ].filter((x) => x.n > 0);
  }, [pendientes, citadas]);
  // Hay desglose sólo si algún grupo mezcla estados; si cada grupo es de un
  // solo color, los chips serían los conteos de las tablas repetidos.
  const desglosa = useMemo(() => {
    const insistiendo = pendientes.filter((p) => p.intentos > 0).length;
    const aplicadas = citadas.filter((c) => c.aplicada).length;
    return (insistiendo > 0 && insistiendo < pendientes.length)
      || (aplicadas > 0 && aplicadas < citadas.length);
  }, [pendientes, citadas]);

  // **Dos causas, y ninguna era la que decía el mensaje.** Con filas presentes la
  // cola sólo queda vacía si TODAS quedan fuera por una razón buena —banco,
  // reserva dormida, ya citada o ya reemplazada—, no porque «no declaren su ciclo
  // de contacto». Ese texto mandaba a rellenar un campo del libro que está bien.
  if (!pendientes.length && !esfuerzo.length) {
    return (
      <p className="mon-profile-muted" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
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
      {/* **El reparto por estado, antes de la tabla.**
       *
       * La tabla mide 6.877 px y su ventana 526: para ver las citadas —que van
       * al final, porque delante va lo accionable— hay que bajar 6.500. Lo
       * conseguido quedaba invisible.
       *
       * El resumen usa los MISMOS chips que las filas, así que la vista de
       * conjunto y el detalle se reconocen entre sí; y sólo muestra los estados
       * que existen, para no llenar la banda de ceros.
       *
       * **Y sólo cuando desglosa algo que las dos tablas no dicen ya.** Cada
       * tabla lleva su conteo en el rótulo del grupo —«Citas fijadas 10», «Por
       * contactar 183»—, así que con los dos grupos homogéneos los chips
       * repetían esas mismas dos cifras dos centímetros más arriba. Aparecen
       * cuando dentro de algún grupo hay más de un estado: ahí sí dicen algo
       * nuevo —cuántos de los pendientes ya se están atascando, cuántas citas
       * siguen sin aplicarse—. */}
      {desglosa ? (
        <p className="aulas-cola-resumen">
          {resumen.map(({ clase, etiqueta, n }) => (
            <span key={clase} className={`aulas-cola-estado ${clase}`}>
              {fmt(n)} {etiqueta.toLowerCase()}
            </span>
          ))}
        </p>
      ) : null}
      {/* **Con cabeceras, y el estado en su columna.**
       *
       * La lista pintaba cuatro columnas sin encabezar: código, docente, «—» y
       * «0». Sin decir qué es cada una, el «—» y el «0» no significan nada, y
       * con 193 filas iguales la pantalla no dice en qué punto está la
       * agendación. Gonzalo, 2026-08-24: «formato profesional con los estados
       * adecuados y una interfaz que muestre el estado de la agendación, las
       * llamadas y los horarios fijados».
       *
       * Las citadas entran con su fecha y hora: antes no salían nunca porque el
       * panel enseñaba sólo la cola, y quien agenda necesita ver lo conseguido
       * además de lo que falta. */}
      {/* **Dos tablas, no una con dos naturalezas de fila.**
       *
       * La columna se llamaba «Contacto» y servía dos contenidos distintos: el
       * teléfono en las filas pendientes y la fecha de la cita en las citadas.
       * Un rótulo que promete un contenido y entrega otro es el defecto más
       * repetido de este módulo, y aquí además obligaba a redactar el
       * encabezado en abstracto para que cubriera las dos cosas.
       *
       * Separadas, cada encabezado dice exactamente lo que hay debajo, y el
       * orden pasa a tener sentido: **primero lo comprometido** —una fecha con
       * hora es un compromiso, y son diez— y después la cola de 183. Antes las
       * citadas iban al final, a 6.500 px de scroll de la primera fila. */}
      {citadas.length ? (
        <div className="aulas-cola-bloque">
          <p className="aulas-cola-grupo">
            Citas fijadas <span>{fmt(citadas.length)}</span>
          </p>
          <table className="aulas-cola-tabla" data-qa-geometry-capacity="owned" data-qa-geometry-member>
            <thead>
              <tr>
                <th scope="col">Curso-horario</th>
                <th scope="col">Docente</th>
                <th scope="col">Día y hora</th>
                <th scope="col" className="es-num">Gestiones</th>
                <th scope="col">Estado</th>
              </tr>
            </thead>
            <tbody>
              {citadas.map((c) => (
                <tr key={`c-${c.codigo}`} className="es-citada">
                  <td className="aulas-cola-codigo">{c.codigo}</td>
                  <td className="aulas-cola-quien" title={`${c.docente} · ${c.facultad}`}>
                    {c.docente || "—"}
                    <em>{c.facultad}</em>
                  </td>
                  <td className="aulas-cola-cita">
                    {diaLegible(c.fecha)}
                    {c.hora ? <em> · {c.hora}</em> : null}
                  </td>
                  <td className="aulas-cola-intentos es-num">
                    {c.intentos > 0 ? <strong>{fmt(c.intentos)}</strong> : <span className="es-vacio">—</span>}
                  </td>
                  <td>
                    <span className={`aulas-cola-estado ${c.aplicada ? "es-aplicada" : "es-citada"}`}>
                      {c.aplicada ? "Aplicada" : "Con cita"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {pendientes.length ? (
        <div className="aulas-cola-bloque">
          <p className="aulas-cola-grupo">
            Por contactar <span>{fmt(pendientes.length)}</span>
          </p>
          <table className="aulas-cola-tabla" data-qa-geometry-capacity="owned" data-qa-geometry-member>
            <thead>
              <tr>
                <th scope="col">Curso-horario</th>
                <th scope="col">Docente</th>
                <th scope="col">Teléfono</th>
                <th scope="col" className="es-num">Gestiones</th>
                <th scope="col">Estado</th>
              </tr>
            </thead>
            <tbody>
              {pendientes.map((p) => (
                <tr key={`p-${p.codigo}`}>
                  <td className="aulas-cola-codigo">{p.codigo}</td>
                  <td className="aulas-cola-quien" title={`${p.docente} · ${p.facultad}`}>
                    {p.docente || "—"}
                    <em>{p.facultad}</em>
                  </td>
                  {/* El teléfono y el medio JUNTOS: es lo que se necesita en la
                      mano para hacer la llamada. */}
                  <td className="aulas-cola-como">
                    {p.telefono || "—"}
                    {p.medio ? <em> · {p.medio}</em> : null}
                  </td>
                  <td className="aulas-cola-intentos es-num">
                    {p.intentos > 0 ? <strong>{fmt(p.intentos)}</strong> : <span className="es-vacio">—</span>}
                    {p.ultimaLlamada ? <em>última: {p.ultimaLlamada}</em> : null}
                  </td>
                  <td>
                    {/* Sin gestiones aún no es lo mismo que insistiendo: la
                        primera está sin empezar y la segunda se está atascando. */}
                    <span className={`aulas-cola-estado ${p.intentos > 0 ? "es-insistiendo" : "es-sin-empezar"}`}>
                      {p.intentos > 0 ? "Insistiendo" : "Sin contactar"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {esfuerzo.length ? (
        <>
          {/* Lo que costó agendar, que es lo que este ciclo puede decir cuando
              ya no queda cola. Una facultad que costó cuatro intentos por aula
              va a costar lo mismo la próxima ola. */}
          {/* La unidad, en el subtítulo. Las celdas decían «2 med.» y aquí no hay
              ni cabecera de columna que lo declare: la abreviatura era lo único
              que se leía, y se lee como «medios». */}
          <p className="aulas-cola-subtitulo">
            Lo que costó agendar, por facultad · <em>mediana de intentos</em>
          </p>
          <ul className="aulas-cola-esfuerzo" data-qa-geometry-capacity="owned" data-qa-geometry-member>
            {esfuerzo.map((e) => (
              <li key={e.facultad} className={e.facultad === facultadEnFoco ? "es-en-foco" : undefined}>
                <NombreDeFacultad facultad={e.facultad} className=""
                  enFoco={e.facultad === facultadEnFoco} onFoco={onFoco} />
                <span>
                  {e.intentos == null ? "—" : `${e.intentos.toLocaleString("es-PE")} ${e.intentos === 1 ? "intento" : "intentos"}`}
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
