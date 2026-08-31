import type { MonitoreoAulasDosTasas } from "../../../../api/monitoreo";
import { fmt } from "./kpisDeAulas";
import { ptsDeBanda, senalesPorAula, tasaEnPct, type AulaMedida } from "./senalesPorAula";
import "./senalesPorAula.css";

/**
 * La señal de cada curso-horario contra SU tasa prevista, con la vara de su
 * facultad en la misma fila (unidad B3, hermana del panel de facultad de ADR
 * 0082 que vive arriba).
 *
 * **Por qué las dos varas juntas.** Un curso-horario bajo su propia meta tuvo
 * un problema; uno bajo la de su facultad pero sobre la suya sólo es más grande
 * que el promedio. Sin las dos tasas en la misma fila los dos casos se ven
 * iguales, y el agregado de la facultad esconde lo que muerde fila a fila.
 *
 * **Qué NO hace.** No veredicta: el mandato es «no descartar algo o catalogarlo
 * simplemente porque la tasa de efectividad no es la esperada». La señal la
 * publica el motor, aquí sólo se ordena la lectura —lo señalado primero, lo
 * conforme agregado, lo sin contraste con su motivo— y ninguna rama esconde un
 * curso-horario por su tasa.
 */

/** La línea secundaria de una fila compacta: sólo lo que esa fila tiene. */
function detalleDeLista(a: AulaMedida): string {
  const partes: string[] = [];
  if (a.tasaObservada != null) partes.push(`va en ${tasaEnPct(a.tasaObservada)}`);
  else if (a.efectivas != null) partes.push(`${fmt(a.efectivas)} efectivas`);
  if (a.facultad) partes.push(a.facultad);
  return partes.join(" · ");
}

export function AulasSenalesPorAula({
  bloque, facultadEnFoco,
}: {
  bloque: MonitoreoAulasDosTasas | null | undefined;
  /** Resalta, no filtra: igual que el resto de listas del perfil. */
  facultadEnFoco?: string;
}) {
  const res = senalesPorAula(bloque);

  // C3: cada vacío es SUYO y nombra su causa; «backend viejo» y «plan sin
  // cursos-horario» se resuelven de maneras distintas.
  if (res.estado === "sin_bloque") {
    return (
      <p className="mon-profile-muted" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
        El estudio todavía no publica las dos tasas por curso-horario: este
        tablero se generó con una versión anterior del cálculo.
      </p>
    );
  }
  if (res.estado === "sin_cursos") {
    return (
      <p className="mon-profile-muted" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
        El plan todavía no trae cursos-horario que medir: entran los titulares
        y las reservas con señal de campo.
      </p>
    );
  }

  const { senalados, conformes, sinMedir, desconocidos } = res;
  const bajo = senalados.filter((a) => a.senal === "bajo").length;
  const sobre = senalados.length - bajo;
  const contrastables = senalados.length + conformes.length;
  const reparto = [
    bajo > 0 ? `${fmt(bajo)} por debajo` : "",
    sobre > 0 ? `${fmt(sobre)} por encima` : "",
  ].filter(Boolean).join(" y ");

  return (
    <div className="aulas-dt" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
      {/* C1: la primera frase dice qué se contó y sobre cuántos, antes de la
          primera cifra suelta. */}
      <p className="aulas-dt-cabeza">
        <span>
          {senalados.length > 0 ? (
            <>
              De los <strong>{fmt(contrastables)}</strong> cursos-horario con
              margen trazado, <strong>{fmt(senalados.length)}</strong>{" "}
              {senalados.length === 1 ? "se sale del suyo" : "se salen del suyo"}: {reparto}.
            </>
          ) : contrastables > 0 ? (
            <>
              Ninguno de los <strong>{fmt(contrastables)}</strong> cursos-horario
              con margen trazado se sale del suyo.
            </>
          ) : (
            <>Ningún curso-horario tiene todavía margen que contrastar; el porqué va abajo, grupo por grupo.</>
          )}
        </span>
        {/* El numerador, dicho donde se leen las cifras: en este perfil conviven
            tres numeradores homónimos y cada tasa declara el suyo. */}
        <span className="aulas-dt-sello">
          se cuenta la efectiva que llegó a la plataforma y pasó los filtros; si
          no hay, respalda el parte de campo y la fila lo dice
        </span>
        <span className="aulas-dt-sello">
          salirse del margen señala qué mirar, no descarta: ningún curso-horario
          sale del cálculo por su tasa
        </span>
      </p>

      {senalados.length > 0 ? (
        <div className="aulas-dt-marco">
          <table className="aulas-dt-tabla">
            <caption className="aulas-dt-caption">
              Cursos-horario fuera de su margen, con su tasa prevista y la vara de su facultad al lado
            </caption>
            <thead>
              <tr>
                <th scope="col">Curso-horario</th>
                <th scope="col">Señal</th>
                {/* Mismos rótulos que la tabla de facultad de arriba a propósito:
                    son la misma pregunta en otro grano, y dos palabras distintas
                    para la misma columna se leerían como dos medidas. */}
                <th scope="col" className="es-num">Se esperaba</th>
                <th scope="col" className="es-num">Va respondiendo</th>
                <th scope="col" className="es-num">Vara de su facultad</th>
              </tr>
            </thead>
            <tbody>
              {senalados.map((a) => (
                <tr
                  key={a.codigo}
                  className={a.facultad === facultadEnFoco ? "es-en-foco" : undefined}
                >
                  <th scope="row" className="aulas-dt-codigo">
                    {a.codigo}
                    <em className="aulas-dt-detalle">
                      {a.facultad}
                      {a.efectivas != null && a.elegibles != null
                        ? ` · ${fmt(a.efectivas)} efectivas de ${fmt(a.elegibles)} alumnos`
                        : ""}
                      {/* El origen sólo cuando NO es el de la cabecera: marcarlo
                          siempre ahogaría la excepción, que es lo que informa. */}
                      {a.numerador === "parte" ? " · del parte" : ""}
                    </em>
                  </th>
                  <td>
                    <span className={`aulas-dt-chip ${a.senal === "bajo" ? "es-aviso" : "es-sobre"}`}>
                      {a.senal === "bajo" ? "Bajo su margen" : "Sobre su margen"}
                    </span>
                  </td>
                  <td className="aulas-dt-cifra es-debil">
                    {tasaEnPct(a.tasaPrevista)}
                    {ptsDeBanda(a.banda) ? (
                      <em className="aulas-dt-margen">{ptsDeBanda(a.banda)}</em>
                    ) : null}
                  </td>
                  <td className="aulas-dt-cifra">{tasaEnPct(a.tasaObservada)}</td>
                  <td className="aulas-dt-cifra es-debil">{tasaEnPct(a.tasaFacultad)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {/* Lo conforme se agrega: es la mayoría, no pide acción, y desplegado
          taparía justo a los señalados. `details` lo deja alcanzable con
          teclado sin costarle alto al panel (C2/C4). */}
      {conformes.length > 0 ? (
        <details className="aulas-dt-conformes">
          <summary>
            <strong>{fmt(conformes.length)}</strong> dentro de su margen · verlos uno a uno
          </summary>
          <ul className="aulas-dt-lista">
            {conformes.map((a) => (
              <li key={a.codigo}>
                {a.codigo} <em>{detalleDeLista(a)}</em>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {/* Los que no se pudieron contrastar, cada grupo con su motivo: un vacío
          que diagnostica, no un hueco (C3). */}
      {sinMedir.map((g) => (
        <details key={g.senal} className="aulas-dt-grupo">
          <summary>
            <strong>{fmt(g.aulas.length)}</strong>{" "}
            {g.aulas.length === 1 ? "curso-horario" : "cursos-horario"} — {g.motivo}
          </summary>
          <ul className="aulas-dt-lista">
            {g.aulas.map((a) => (
              <li key={a.codigo}>
                {a.codigo} <em>{detalleDeLista(a)}</em>
              </li>
            ))}
          </ul>
        </details>
      ))}

      {/* Una señal nueva del motor no se traga en silencio: se enseña con su
          nombre para que la brecha de versiones se vea. */}
      {desconocidos.length > 0 ? (
        <p className="aulas-dt-sello">
          <strong>{fmt(desconocidos.length)}</strong> con una señal que esta
          vista aún no reconoce ({[...new Set(desconocidos.map((a) => a.senal))].join(", ")})
        </p>
      ) : null}
    </div>
  );
}
