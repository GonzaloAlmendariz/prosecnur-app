import type { MonitoreoAulasDosTasas } from "../../../../api/monitoreo";
import { pendientesPorFacultad } from "./pendientesPorFacultad";
import { fmt, pctPerfil } from "./kpisDeAulas";
import { ptsDeBanda, senalesPorAula, tasaEnPct, type AulaMedida } from "./senalesPorAula";
import "./senalesPorAula.css";

/**
 * La señal de cada curso-horario contra SU tasa prevista, con la tasa prevista
 * de su facultad en la misma fila (unidad B3, hermana del panel de facultad de
 * ADR 0082 que vive arriba).
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
 *
 * Tras el rechazo metodológico (B1): sólo lo APLICADO se contrasta. El
 * encabezado cuenta a los aplicados fuera de su margen y a nadie más; los
 * pendientes y retirados van en grupos propios con su estado literal, porque
 * sumarlos al «se salen» era prometer rendimiento y entregar agenda.
 */

/** La línea secundaria de una fila compacta: sólo lo que esa fila tiene. */
function detalleDeLista(a: AulaMedida): string {
  const partes: string[] = [];
  if (a.tasaObservada != null) partes.push(`va en ${tasaEnPct(a.tasaObservada)}`);
  else if (a.efectivas != null) partes.push(`${fmt(a.efectivas)} efectivas`);
  if (a.facultad) partes.push(a.facultad);
  return partes.join(" · ");
}

/* `detalleDePendiente()` se retiro el 2026-09-09 con la lista uno-a-uno que
   alimentaba: los pendientes se agrupan por facultad y su detalle lo arma
   `pendientesPorFacultad.ts`. El curso-horario suelto sigue alcanzable en
   «Avance por curso-horario», en Resumen. */

/** La línea de un retirado: el estado literal ES el motivo, y viaja tal cual. */
function detalleDeRetirada(a: AulaMedida): string {
  const partes: string[] = [a.estadoOperativo ?? "sin estado escrito"];
  if (a.facultad) partes.push(a.facultad);
  return partes.join(" · ");
}

/** La línea de un descuadre: los números que no cuadran, no una tasa armada con ellos. */
function detalleDeDescuadre(a: AulaMedida): string {
  const partes: string[] = [];
  if (a.efectivas != null && a.elegibles != null) {
    partes.push(`${fmt(a.efectivas)} efectivas de ${fmt(a.elegibles)} elegibles`);
  }
  if (a.facultad) partes.push(a.facultad);
  if (a.numerador === "parte") partes.push("del parte");
  return partes.join(" · ");
}

/**
 * Sólo presentación: el motor escribe nombres de campo entre acentos graves
 * (`estado_operativo`) y en pantalla ese tic de código es ruido. El TEXTO no
 * se toca — el dueño del idioma del criterio es el motor (M4).
 */
const sinGraves = (s: string) => s.replace(/`/g, "");

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

  const { senalados, descuadres, conformes, sinMedir, pendientes, retiradas, desconocidos, criterio } = res;
  const bajo = senalados.filter((a) => a.senal === "bajo").length;
  const sobre = senalados.length - bajo;
  // SOLO los contrastados (aplicados con banda): ni pendientes ni retirados ni
  // descuadres entran al numerador o al denominador del encabezado (hallazgo
  // 2) — el rótulo viejo prometía rendimiento y entregaba agenda.
  const contrastables = senalados.length + conformes.length;
  const reparto = [
    bajo > 0 ? `${fmt(bajo)} por debajo` : "",
    sobre > 0 ? `${fmt(sobre)} por encima` : "",
  ].filter(Boolean).join(" y ");

  return (
    <div className="aulas-dt" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
      {/* C1: la primera frase dice qué se contó y sobre cuántos, antes de la
          primera cifra suelta. «Aplicados» es la palabra que separa el
          rendimiento de la agenda. */}
      <p className="aulas-dt-cabeza">
        <span>
          {senalados.length > 0 ? (
            <>
              De los <strong>{fmt(contrastables)}</strong> cursos-horario
              aplicados con margen trazado, <strong>{fmt(senalados.length)}</strong>{" "}
              {senalados.length === 1 ? "se sale del suyo" : "se salen del suyo"}: {reparto}.
            </>
          ) : contrastables > 0 ? (
            <>
              Ninguno de los <strong>{fmt(contrastables)}</strong> cursos-horario
              aplicados con margen trazado se sale del suyo.
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

      {/* El descuadre con nombre propio (hallazgo 1): más efectivas que
          elegibles es una inconsistencia de números, no un logro, y no se
          pliega — plegado se leería como un detalle menor. */}
      {descuadres.length > 0 ? (
        <div className="aulas-dt-descuadre">
          <p className="aulas-dt-descuadre-titulo">
            <strong>{fmt(descuadres.length)}</strong> con las cuentas
            descuadradas: más efectivas que elegibles — algún número está mal
            (atribución, aforo o plataforma).
          </p>
          <ul className="aulas-dt-lista">
            {descuadres.map((a) => (
              <li key={a.clave}>
                {a.codigo} <em>{detalleDeDescuadre(a)}</em>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {senalados.length > 0 ? (
        <div className="aulas-dt-marco">
          <table className="aulas-dt-tabla">
            <caption className="aulas-dt-caption">
              Cursos-horario fuera de su margen, con su tasa prevista y la tasa prevista de su facultad al lado
            </caption>
            <thead>
              <tr>
                <th scope="col">Curso-horario</th>
                <th scope="col">Señal</th>
                {/* Mismos rótulos que la tabla de facultad de arriba a propósito:
                    son la misma pregunta en otro grano, y dos palabras distintas
                    para la misma columna se leerían como dos medidas. */}
                <th scope="col" className="es-num">Tasa prevista</th>
                <th scope="col" className="es-num">Tasa observada</th>
                {/* M3: es la tasa de DISEÑO de la facultad. «Vara» a secas era
                    una palabra para dos cosas al lado de un panel que habla en
                    observadas. */}
                <th scope="col" className="es-num">Prevista de su facultad</th>
              </tr>
            </thead>
            <tbody>
              {senalados.map((a) => (
                <tr
                  key={a.clave}
                  className={a.facultad === facultadEnFoco ? "es-en-foco" : undefined}
                >
                  <th scope="row" className="aulas-dt-codigo">
                    {a.codigo}
                    <em className="aulas-dt-detalle">
                      {a.facultad}
                      {/* N6: el denominador son los ELEGIBLES del aula, no sus
                          alumnos — el aforo completo es otro número. */}
                      {a.efectivas != null && a.elegibles != null
                        ? ` · ${fmt(a.efectivas)} efectivas de ${fmt(a.elegibles)} elegibles`
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
              <li key={a.clave}>
                {a.codigo} <em>{detalleDeLista(a)}</em>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {/* Los aplicados que no se pudieron contrastar, cada grupo con su motivo:
          un vacío que diagnostica, no un hueco (C3). */}
      {sinMedir.map((g) => (
        <details key={g.senal} className="aulas-dt-grupo">
          <summary>
            <strong>{fmt(g.aulas.length)}</strong>{" "}
            {g.aulas.length === 1 ? "curso-horario" : "cursos-horario"} — {g.motivo}
          </summary>
          <ul className="aulas-dt-lista">
            {g.aulas.map((a) => (
              <li key={a.clave}>
                {a.codigo} <em>{detalleDeLista(a)}</em>
              </li>
            ))}
          </ul>
        </details>
      ))}

      {/* La agenda, aparte del rendimiento (hallazgo 1): la prevista es
          condicional a aplicarse, así que del pendiente se enseña lo que se
          espera —con su estado literal— y ningún juicio. */}
      {pendientes.length > 0 ? (
        <details className="aulas-dt-grupo">
          <summary>
            <strong>{fmt(pendientes.length)}</strong>{" "}
            {pendientes.length === 1
              ? "curso-horario aún sin aplicar"
              : "cursos-horario aún sin aplicar"}{" "}
            — por facultad, con lo que se espera de cada una; el rendimiento se
            juzga recién cuando se apliquen
          </summary>
          {/* **Agrupados por facultad, no uno a uno.** Eran 161 renglones de
              «CH 1 · planificada · CIENCIAS E INGENIERIA · prevista 51.9 % de 28
              elegibles» en cuatro columnas de texto micro; Gonzalo, el
              2026-09-09: «toda la parte de abajo de aquí también». Una lista de
              161 códigos no se lee, y lo que se busca en un pendiente es DÓNDE
              está y CUÁNTO promete: eso son doce líneas.

              No esconde nada: cada curso-horario suelto sigue alcanzable en
              «Avance por curso-horario», en Resumen, que desde el mismo día trae
              su selector de rol. */}
          <ul className="aulas-dt-lista">
            {pendientesPorFacultad(pendientes).map((f) => (
              <li key={f.facultad}>
                {f.facultad}{" "}
                <em>
                  {fmt(f.cursosHorario)}{" "}
                  {f.cursosHorario === 1 ? "curso-horario" : "cursos-horario"}
                  {" ("}
                  {f.estados.map((e, i) => (
                    <span key={e.estado}>{i > 0 ? ", " : ""}{fmt(e.n)} {e.estado}</span>
                  ))}
                  {")"}
                  {f.elegibles > 0 ? <> · {fmt(f.elegibles)} elegibles</> : null}
                  {f.tasaPrevista != null ? (
                    <> · prevista {pctPerfil(f.tasaPrevista * 100)}</>
                  ) : null}
                </em>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {/* Los retirados: dejarlos en «bajo, 0%» duplicaría el asiento del hueco
          a perpetuidad; su reemplazo o cancelación ya responde por ellos. */}
      {retiradas.length > 0 ? (
        <details className="aulas-dt-grupo">
          <summary>
            <strong>{fmt(retiradas.length)}</strong>{" "}
            {retiradas.length === 1
              ? "ya no se aplicará por esta vía"
              : "ya no se aplicarán por esta vía"}{" "}
            — el estado operativo de cada uno dice por qué
          </summary>
          <ul className="aulas-dt-lista">
            {retiradas.map((a) => (
              <li key={a.clave}>
                {a.codigo} <em>{detalleDeRetirada(a)}</em>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {/* Una señal nueva del motor no se traga en silencio: se enseña con su
          nombre para que la brecha de versiones se vea. */}
      {desconocidos.length > 0 ? (
        <p className="aulas-dt-sello">
          <strong>{fmt(desconocidos.length)}</strong> con una señal que esta
          vista aún no reconoce ({[...new Set(desconocidos.map((a) => a.senal))].join(", ")})
        </p>
      ) : null}

      {/* M4: el criterio lo dice el MOTOR y se enseña tal cual — el mínimo de
          elegibles, la z y la clasificación por estado viven en el payload, no
          tecleados aquí, así que si el motor cambia, este texto cambia solo. */}
      {criterio.estados || criterio.banda ? (
        <details className="aulas-dt-criterio">
          <summary>Cómo se clasifica y se traza el margen, según el motor</summary>
          {criterio.estados ? <p>{sinGraves(criterio.estados)}</p> : null}
          {criterio.banda ? <p>{sinGraves(criterio.banda)}</p> : null}
        </details>
      ) : null}
    </div>
  );
}
