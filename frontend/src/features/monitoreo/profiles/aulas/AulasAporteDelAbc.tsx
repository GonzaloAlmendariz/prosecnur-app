import type { ReactNode } from "react";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { aulasQueSeMetieron, repartoDelAporte, type AulaQueSeMetio } from "./aporteDelAbc";
import { facultadCorta } from "./facultadEnPalabras";
import { fmt, pctPerfil } from "./kpisDeAulas";
import "./aulasAporteDelAbc.css";

/**
 * **Qué nos dieron las aulas que se metieron**, con las dos varas separadas.
 *
 * Gonzalo, 2026-09-10: «hay que diferenciar dos cosas: qué tan bien nos fue en
 * esa aula, que es una cosa, pero la otra cosa —y es la que también nos importa
 * sobremanera— es cómo esa aula nos ayudó, porque esa aula no estaba prevista
 * […] los alumnos tanto hombres como mujeres que habíamos recolectado allí son
 * alumnos netos o puros, ingresos completos».
 *
 * El panel las pone una al lado de la otra porque se contestaban con la misma
 * cifra y no son lo mismo: **rindió** juzga el trabajo de campo en ese salón;
 * **aportó** juzga la decisión de meterlo. Un complemento con tasa mediocre
 * puede aportar más que un reemplazo impecable, porque el reemplazo sólo repone
 * lo que el titular caído iba a dar.
 */
export function AulasAporteDelAbc({ filas }: {
  filas: ReadonlyArray<MonitoreoAulasPlanRow> | null | undefined;
}): ReactNode {
  const aulas = aulasQueSeMetieron(filas);

  if (!aulas.length) {
    return (
      <p className="mon-profile-muted" data-qa-geometry-capacity="owned" data-qa-geometry-member>
        Todavía no se ha aplicado ningún curso-horario que no fuera titular: sin
        eso no hay ni rendimiento que juzgar ni ganancia que contar.
      </p>
    );
  }

  const r = repartoDelAporte(aulas);
  const netas = aulas.filter((a) => a.papel === "neta");
  const reponen = aulas.filter((a) => a.papel === "repone");

  return (
    <div className="aulas-abc" data-qa-geometry-capacity="owned" data-qa-geometry-member>
      {/* Las dos cifras, enfrentadas y nunca sumadas: una engorda la meta y la
          otra la sostiene. */}
      <div className="aulas-abc-cabeza">
        <div className="aulas-abc-cifra es-neta">
          <b>{fmt(r.ganancia)}</b>
          <em>respuestas de más</em>
          <span>
            en <strong>{fmt(r.netas)}</strong> {r.netas === 1 ? "curso-horario" : "cursos-horario"}
            {" "}que no estaban previstos
            {r.gananciaPorSexo ? (
              <> · {fmt(r.gananciaPorSexo.mujeres)} mujeres y {fmt(r.gananciaPorSexo.hombres)} hombres</>
            ) : r.sinSexo ? (
              // No saber el reparto y saber que no hubo mujeres son cosas
              // distintas. Con una sola sin sexo, un total por sexo sería una
              // cifra sobre parte de las aulas presentada como sobre todas.
              <> · <i>{fmt(r.sinSexo)} sin reparto por sexo publicado, así que no se suma</i></>
            ) : null}
          </span>
        </div>
        <div className="aulas-abc-cifra es-repone">
          <b>{fmt(r.repuesto)}</b>
          <em>respuestas repuestas</em>
          <span>
            en <strong>{fmt(r.reponen)}</strong> {r.reponen === 1 ? "reemplazo" : "reemplazos"}
            {" "}de un titular que no salió: el plan ya contaba con ellas
          </span>
        </div>
      </div>

      {netas.length ? (
        <>
          <p className="aulas-abc-titulo">
            Lo que sumó — el titular vino igual, o no había titular
          </p>
          <ul className="aulas-abc-lista">
            {netas.map((a) => <Linea key={a.codigo} a={a} />)}
          </ul>
        </>
      ) : null}

      {reponen.length ? (
        <>
          <p className="aulas-abc-titulo es-apagado">
            Lo que repuso — entró en el sitio de un titular que no salió
          </p>
          <ul className="aulas-abc-lista es-apagada">
            {reponen.map((a) => <Linea key={a.codigo} a={a} />)}
          </ul>
        </>
      ) : null}
    </div>
  );
}

function Linea({ a }: { a: AulaQueSeMetio }): ReactNode {
  // «Rindió bien» es contra la prevista de SU facultad, no contra una vara
  // global: un salón de 60 y uno de 18 no se juzgan con el mismo listón.
  const cumple = a.observada != null && a.prevista != null ? a.observada / a.prevista : null;
  const juicio = cumple == null ? "" : cumple < 0.5 ? " es-bajo" : cumple < 0.85 ? " es-justo" : " es-ok";

  return (
    <li className="aulas-abc-fila">
      <span className="aulas-abc-quien">
        <b>{a.codigo}</b>
        <i className={a.deLaReserva ? "es-extra" : "es-cadena"}>
          {a.deLaReserva ? "reserva adicional" : a.titular ? `con ${a.titular}` : "de cadena"}
        </i>
        <em>{facultadCorta(a.facultad)}{a.curso ? ` · ${a.curso}` : ""}</em>
      </span>

      {/* Vara 1: qué tal rindió. */}
      <span className={`aulas-abc-rindio${juicio}`}>
        <b>{a.observada == null ? "—" : pctPerfil(a.observada * 100)}</b>
        <em>{a.prevista == null ? "sin previsión" : `de ${pctPerfil(a.prevista * 100)} previsto`}</em>
      </span>

      {/* Vara 2: cuánto aportó, y de qué sexo. */}
      <span className={`aulas-abc-aporto${a.papel === "neta" ? " es-neta" : ""}`}>
        <b>{a.papel === "neta" ? `+${fmt(a.efectivas)}` : fmt(a.efectivas)}</b>
        <em>
          {a.porSexo
            ? `${fmt(a.porSexo.mujeres)} M · ${fmt(a.porSexo.hombres)} H`
            : "sin reparto por sexo"}
        </em>
      </span>
    </li>
  );
}
