import { useMemo } from "react";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { COLOR_RESULTADO } from "../../coloresDeResultado";
import { difereDeVerdad, medioDeContacto } from "./medioDeContacto";
import { fmt } from "./kpisDeAulas";

/**
 * Qué medio agenda mejor y a qué coste en intentos.
 *
 * La cifra de intentos es la MEDIANA y lo dice: en el libro real la media del
 * correo sale 19,65 por unas fechas de Excel coladas en la columna, y creérsela
 * llevaría a prohibir el correo cuando el dato real dice «prefiere llamar».
 */

export function AulasMedioDeContacto({ filas }: { filas: ReadonlyArray<MonitoreoAulasPlanRow> }) {
  const medios = useMemo(() => medioDeContacto(filas), [filas]);

  // Dos causas distintas: que no haya cursos-horario, o que los haya y ninguno
  // declare medio. La segunda es un aviso sobre el libro; la primera, no.
  if (!medios.length) {
    return (
      <p className="mon-profile-muted" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
        {filas.length
          ? `Ninguno de los ${fmt(filas.length)} cursos-horario declara por qué medio se contactó, así que no se puede comparar.`
          : "El plan todavía no trae cursos-horario que contactar."}
      </p>
    );
  }

  const descartados = medios.reduce((n, m) => n + m.intentosDescartados, 0);
  const mejor = medios[0];
  const peor = medios[medios.length - 1];

  return (
    <div className="aulas-medio">
      {/* Su propio rótulo: el panel contiene dos bloques y el título ya no
          nombra sólo a éste. */}
      <p className="aulas-medio-titulo">Qué medio agenda mejor</p>
      <p className="aulas-medio-lectura">
        {medios.length > 1 ? (
          difereDeVerdad(mejor, peor) ? (
            <>
              <strong>{mejor.medio}</strong> agenda el{" "}
              <strong>{mejor.tasa.toLocaleString("es-PE")} %</strong> y{" "}
              <strong>{peor.medio}</strong> el {peor.tasa.toLocaleString("es-PE")} %
            </>
          ) : (
            // **No se ordena lo que el dato no distingue.** Medido: Llamada
            // 82,3 % (121 de 147) contra Correo 79,6 % (39 de 49) son 2,7 puntos
            // frente a una banda de 13,1. Quien lee «Llamada agenda mejor»
            // cambia cómo se contacta a la gente por una diferencia que sale
            // por casualidad la mitad de las veces.
            <>
              Ningún medio agenda claramente mejor: <strong>{mejor.medio}</strong>{" "}
              {mejor.tasa.toLocaleString("es-PE")} % y <strong>{peor.medio}</strong>{" "}
              {peor.tasa.toLocaleString("es-PE")} %, una diferencia que cabe en el margen de
              estos tamaños
            </>
          )
        ) : (
          <>Todo el contacto se hizo por <strong>{mejor.medio}</strong>, así que no hay con qué comparar.</>
        )}
      </p>
      <ul className="aulas-medio-lista" data-qa-geometry-capacity="owned" data-qa-geometry-member>
        <li className="aulas-medio-cabecera" aria-hidden="true">
          <span>Medio</span>
          <span>{medios.length > 1 ? "Agenda" : "Resultado"}</span>
          {/* **El estadístico va en la cabecera de su columna, no en un pie.**
              Es mediana y no promedio, y eso hay que decirlo siempre: un
              «Intentos: 3» sin apellido se lee como promedio. Dicho aquí ocupa
              dos palabras y está donde se mira el número; el pie queda libre
              para la justificación, que sólo hace falta cuando hay medios que
              comparar y el estadístico decide cuál gana. */}
          <span>Intentos · <em>mediana</em></span>
        </li>
        {medios.map((m) => (
          <li key={m.medio}>
            <span className="aulas-medio-nombre">
              {m.medio}
              <em>{fmt(m.agendadas)} de {fmt(m.aulas)}</em>
            </span>
            {/* **La barra existe para comparar; con un medio no compara nada.**
                Una barra al 100 % ocupando el ancho de la fila se lee como un
                ranking ganado, cuando lo único que dice es que todo el contacto
                se hizo por ese medio —que el texto de arriba ya declara—. Con
                un solo medio queda la cifra sola, que es el dato de verdad: qué
                proporción de lo contactado por ahí llegó a agendarse. */}
            {medios.length > 1 ? (
              <span className="aulas-medio-barra" role="img"
                aria-label={`${m.tasa} % agendadas por ${m.medio}`}>
                <i style={{ width: `${Math.max(4, m.tasa)}%`, background: COLOR_RESULTADO.efectiva }}>
                  {m.tasa.toLocaleString("es-PE")} %
                </i>
              </span>
            ) : (
              <span className="aulas-medio-solo">
                <strong>{m.tasa.toLocaleString("es-PE")} %</strong> agendadas
              </span>
            )}
            {/* MEDIANA, y dicho: la media del correo en el libro real sale 19,65
                por fechas de Excel coladas en la columna.
                **Sin el «med.»**: la columna de arriba ya se llama «Intentos» y el
                pie ya dice que es la mediana, así que la abreviatura no añadía
                unidad —la añadía mal—. En un panel titulado «Medio de contacto»,
                «2 med.» se lee como **2 medios**, que es la lectura natural y es
                falsa: son 2 intentos. */}
            <span className="aulas-medio-intentos">
              {m.intentos == null ? "—" : m.intentos.toLocaleString("es-PE")}
            </span>
          </li>
        ))}
      </ul>
      {/* **La justificación del estadístico sólo cuando cambia una decisión.**
       *
       * El pie explicaba SIEMPRE por qué «Intentos» es la mediana y no el
       * promedio. Es cierto y está bien razonado, pero es metodología en una
       * pantalla de trabajo: con un solo medio no hay nada que comparar, así que
       * ese párrafo era una línea permanente que nadie va a accionar.
       *
       * Se muestra cuando de verdad importa: si hay medios que comparar —ahí la
       * elección del estadístico decide cuál «gana»— o si se descartaron
       * valores, que es un hecho sobre ESTOS datos y no una nota de método. */}
      {medios.length > 1 || descartados ? (
        <p className="mon-profile-muted aulas-medio-pie">
          {medios.length > 1 ? (
            <>
              «Intentos» es la <strong>mediana</strong>, no el promedio: un número absurdo
              —una fecha colada en la columna— dispara el promedio y haría descartar un medio
              que funciona.
            </>
          ) : null}
          {descartados ? (
            <>
              {medios.length > 1 ? " " : ""}
              Se dejaron fuera <strong>{fmt(descartados)}</strong>{" "}
              {descartados === 1 ? "valor imposible" : "valores imposibles"}.
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
