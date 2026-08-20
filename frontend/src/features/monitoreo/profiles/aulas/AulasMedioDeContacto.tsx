import { useMemo } from "react";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { COLOR_RESULTADO } from "../../coloresDeResultado";
import { difereDeVerdad, medioDeContacto } from "./medioDeContacto";

/**
 * Qué medio agenda mejor y a qué coste en intentos.
 *
 * La cifra de intentos es la MEDIANA y lo dice: en el libro real la media del
 * correo sale 19,65 por unas fechas de Excel coladas en la columna, y creérsela
 * llevaría a prohibir el correo cuando el dato real dice «prefiere llamar».
 */

const fmt = (n: number) => n.toLocaleString("es-PE");

export function AulasMedioDeContacto({ filas }: { filas: ReadonlyArray<MonitoreoAulasPlanRow> }) {
  const medios = useMemo(() => medioDeContacto(filas), [filas]);

  // Dos causas distintas: que no haya cursos-horario, o que los haya y ninguno
  // declare medio. La segunda es un aviso sobre el libro; la primera, no.
  if (!medios.length) {
    return (
      <p className="mon-profile-muted">
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
          <span>Medio</span><span>Agenda</span><span>Intentos</span>
        </li>
        {medios.map((m) => (
          <li key={m.medio}>
            <span className="aulas-medio-nombre">
              {m.medio}
              <em>{fmt(m.agendadas)} de {fmt(m.aulas)}</em>
            </span>
            <span className="aulas-medio-barra" role="img"
              aria-label={`${m.tasa} % agendadas por ${m.medio}`}>
              <i style={{ width: `${Math.max(4, m.tasa)}%`, background: COLOR_RESULTADO.efectiva }}>
                {m.tasa.toLocaleString("es-PE")} %
              </i>
            </span>
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
      <p className="mon-profile-muted aulas-medio-pie">
        «Intentos» es la <strong>mediana</strong>, no el promedio: un número de intentos absurdo
        —una fecha colada en la columna— dispara el promedio y haría descartar un medio que
        funciona.
        {descartados ? (
          <> Se dejaron fuera <strong>{fmt(descartados)}</strong>{" "}
            {descartados === 1 ? "valor imposible" : "valores imposibles"}.</>
        ) : null}
      </p>
    </div>
  );
}
