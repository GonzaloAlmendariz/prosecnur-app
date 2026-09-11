import { useState, type ReactNode } from "react";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { caminosDelLibro, type CaminoDelLibro } from "./caminosDelLibro";
import { facultadCorta } from "./facultadEnPalabras";
import { fmt, pctPerfil } from "./kpisDeAulas";
import "./aulasTresCaminos.css";

/**
 * **Qué pasó, y por dónde se sale** — la primera sección del ensayo.
 *
 * Gonzalo, 2026-09-10: «ni siquiera estamos diferenciando bien esto de qué nos
 * dieron y las que se metieron, de quizás diferenciando se fue una situación A,
 * se fue una situación B, se fue una situación C, porque son las naturalezas
 * distintas y con lógicas distintas».
 *
 * Los tres se escriben en la misma columna del libro —`STATUS DE APLICACIÓN`— y
 * hasta hace nada el tablero no los distinguía: un aula aplicada de refuerzo se
 * contaba como si nadie la hubiera tocado. **Lo que los separa no es el
 * trámite, es qué le pasó al titular.**
 *
 * Cada camino trae además lo que ya rindió por él, y ahí está la asimetría que
 * el panel existe para enseñar: **A repone y B/C suman**. El plan contaba con
 * las respuestas que A recupera; las de B y C no estaban previstas.
 */
export function AulasTresCaminos({ filas, porTipo }: {
  filas: ReadonlyArray<MonitoreoAulasPlanRow> | null | undefined;
  /** `reemplazos_por_tipo` del payload: el recuento del motor por los dos caminos. */
  porTipo: Record<string, unknown> | null | undefined;
}): ReactNode {
  const [abierto, setAbierto] = useState<string>("");
  const caminos = caminosDelLibro(filas, porTipo);
  const total = caminos.reduce((n, c) => n + c.enCurso, 0);
  const sinDeclarar = caminos.reduce((n, c) => n + Math.max(0, c.enCurso - c.declarados), 0);

  return (
    <div className="aulas-cam" data-qa-geometry-capacity="owned" data-qa-geometry-member>
      <p className="aulas-cam-intro">
        Los tres se escriben en la misma columna del libro y lo que los separa no
        es el trámite, es <strong>qué le pasó al titular</strong>.
        {total ? (
          <>
            {" "}Hay <strong>{fmt(total)}</strong> en curso
            {sinDeclarar ? (
              // El hecho llega antes que el verbo: el estado se teclea al
              // aplicar, así que un camino puede estar andando sin que nadie lo
              // haya escrito. Contar sólo lo declarado daba cero sobre cuatro
              // reemplazos reales.
              <>, <strong>{fmt(sinDeclarar)}</strong> todavía sin declarar en el libro</>
            ) : null}.
          </>
        ) : (
          <> Todavía no se ha abierto ninguno.</>
        )}
      </p>

      <div className="aulas-cam-tres">
        {caminos.map((c) => (
          <Camino
            key={c.letra}
            c={c}
            abierto={abierto === c.letra}
            onAbrir={() => setAbierto((x) => (x === c.letra ? "" : c.letra))}
          />
        ))}
      </div>
    </div>
  );
}

function Camino({ c, abierto, onAbrir }: {
  c: CaminoDelLibro; abierto: boolean; onAbrir: () => void;
}): ReactNode {
  const hayDetalle = c.aplicados.length > 0;
  const repone = c.letra === "A";

  return (
    <article className={`aulas-cam-uno es-${c.letra.toLowerCase()}${abierto ? " es-abierto" : ""}`}>
      <div className="aulas-cam-alto">
        <span className="aulas-cam-letra" aria-hidden="true">{c.letra}</span>
        <h4>{c.nombre}</h4>
        <span className="aulas-cam-cuantos">
          <b>{fmt(c.enCurso)}</b>
          <span>{c.enCurso === 1 ? "en curso" : c.enCurso ? "en curso" : "todavía"}</span>
        </span>
      </div>

      <dl className="aulas-cam-cuando">
        <dt>circunstancia</dt>
        <dd>{c.circunstancia}</dd>
      </dl>

      {/* Lo que ya rindió por este camino, y con qué signo cuenta. Es la
          asimetría del modelo: A recupera lo que el plan ya tenía apuntado; B y
          C no estaban previstos, así que cada respuesta engorda la meta. */}
      {hayDetalle ? (
        <p className={`aulas-cam-aporte${repone ? " es-repone" : " es-suma"}`}>
          <b>{repone ? fmt(c.respuestas) : `+${fmt(c.respuestas)}`}</b>
          <span>
            {repone ? "respuestas repuestas" : "respuestas de más"}
            {c.porSexo ? ` · ${fmt(c.porSexo.mujeres)} mujeres y ${fmt(c.porSexo.hombres)} hombres` : ""}
          </span>
        </p>
      ) : (
        <p className="aulas-cam-aporte es-vacio">
          <span>
            {c.enCurso
              ? "Ninguno ha rendido todavía: están en camino."
              : "Sin casos en este corte."}
          </span>
        </p>
      )}

      <div className="aulas-cam-pie">
        <span className={`aulas-cam-donde es-${c.donde}`}>
          {c.donde === "sheets" ? "Se resuelve en el Sheets de agendación" : "Se decide en la app"}
        </span>
        {hayDetalle ? (
          <button type="button" className="aulas-cam-ver" aria-expanded={abierto} onClick={onAbrir}>
            {abierto ? "Ocultar" : `Ver ${c.aplicados.length === 1 ? "el" : "los"} ${fmt(c.aplicados.length)}`}
          </button>
        ) : null}
      </div>

      {abierto && hayDetalle ? (
        <ul className="aulas-cam-lista">
          {c.aplicados.map((a) => {
            const cumple = a.observada != null && a.prevista != null ? a.observada / a.prevista : null;
            const juicio = cumple == null ? "" : cumple < 0.5 ? " es-bajo" : cumple < 0.85 ? " es-justo" : " es-ok";
            return (
              <li key={a.codigo}>
                <span className="aulas-cam-quien">
                  <b>{a.codigo}</b>
                  <em>{facultadCorta(a.facultad)}</em>
                </span>
                {/* Las dos varas separadas: rindió juzga el trabajo de campo en
                    ese salón, aportó juzga la decisión de meterlo. */}
                <span className={`aulas-cam-rindio${juicio}`}>
                  {a.observada == null ? "—" : pctPerfil(a.observada * 100)}
                </span>
                <span className="aulas-cam-trajo">
                  {a.porSexo
                    ? `${fmt(a.porSexo.mujeres)} M · ${fmt(a.porSexo.hombres)} H`
                    : fmt(a.efectivas)}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </article>
  );
}
