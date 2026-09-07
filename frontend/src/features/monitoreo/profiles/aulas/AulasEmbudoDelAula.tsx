import { useMemo } from "react";

import type { MonitoreoRow } from "../../../../api/monitoreo";
import { COLOR_RESULTADO } from "../../coloresDeResultado";
import { embudoDelAula } from "./embudoDelAula";
import { fmt, pctPerfil } from "./kpisDeAulas";


/**
 * De cuántos estaban en el aula a cuántas respuestas quedaron.
 *
 * El parte recoge la cadena entera y la pestaña la enseñaba fila a fila. Sumada,
 * contesta lo que se pregunta al juzgar el campo: de cada cien personas que
 * estaban en el aula, cuántas respuestas salieron y dónde se perdieron las
 * demás. Leyendo fila a fila no se ve que los duplicados pesen más que los
 * rechazos; aquí sí.
 *
 * Barras en CSS y no Plotly: son tres pasos, y lo que se compara es cuánto
 * angosta cada uno.
 */

export function AulasEmbudoDelAula({ filas }: { filas: ReadonlyArray<MonitoreoRow> }) {
  const e = useMemo(() => embudoDelAula(filas), [filas]);

  if (!e.pasos.length) {
    return (
      // Vacío legítimo: sin partes no hay cadena que angostar, y decirlo evita
      // que un embudo en cero se lea como «se perdió todo».
      //
      // **Y declara lo mismo que la rama con datos**, igual que
      // `AulasControlDelLibro`: sin `member`, el grupo `monitoring-aulas-consultas`
      // se queda sin contenedor de datos declarado y el runner cae a los hijos
      // directos del `section`, donde el encabezado del panel «Partes de campo»
      // entra como si lo fuera → `capacity-drift` con 5 px. Medido en
      // `consultas/parte` sobre el proyecto derivado.
      <p className="mon-profile-muted" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
        Todavía no hay partes de campo con asistentes declarados.
      </p>
    );
  }

  const ultimo = e.pasos[e.pasos.length - 1];

  return (
    <div className="aulas-embudo" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
      {/* **Sin los descuentos no hay cadena que leer.** Con los 152 partes sin
          rechazos ni duplicados la frase decía «De 4.386 personas en el aula
          quedaron 4.386 respuestas · 100 %», que afirma conversión total cuando
          lo que pasa es que nadie anotó esos dos pasos. Se dice cuáles faltan
          en vez de dibujar una cadena que no se midió. */}
      {e.pasosSinDeclarar.length >= 2 ? (
        <p className="aulas-cadenas-lectura">
          <strong>{fmt(e.asistentes)}</strong> personas estaban en el aula. La
          cadena hasta las efectivas no se puede leer: ningún parte declara{" "}
          {e.pasosSinDeclarar.join(" ni ")}.
        </p>
      ) : (
        <p className="aulas-cadenas-lectura">
          De <strong>{fmt(e.asistentes)}</strong> personas en el aula quedaron{" "}
          <strong>{fmt(ultimo.quedan)}</strong> respuestas · <strong>{pctPerfil(ultimo.pct)}</strong>
          {e.pasosSinDeclarar.length ? (
            <em>{" "}· sin contar {e.pasosSinDeclarar[0]}, que ningún parte declara</em>
          ) : null}
        </p>
      )}
      <ol className="aulas-embudo-pasos" role="list">
        {e.pasos.map((p) => (
          <li key={p.clave}>
            <span className="aulas-embudo-rotulo">{p.etiqueta}</span>
            <span
              className="aulas-embudo-carril"
              role="img"
              aria-label={`${p.etiqueta}: quedan ${p.quedan}, ${pctPerfil(p.pct)}`}
            >
              <i style={{ width: `${p.pct}%`, background: COLOR_RESULTADO.efectiva }} />
            </span>
            <span className="aulas-embudo-cifra">
              <strong>{fmt(p.quedan)}</strong>
              {/* Lo que se pierde EN el paso, que es el dato con el que se
                  decide si hay algo que corregir en campo. El primero no pierde
                  nada: es el punto de partida. */}
              {p.pierde ? <em>{" "}−{fmt(p.pierde)}</em> : null}
            </span>
          </li>
        ))}
      </ol>
      {e.descuadre !== 0 ? (
        // El equipo escribió otra cosa. No se corrige ninguno de los dos: el
        // cuadre es suyo y esto sólo lo dice, con el signo, que es lo que
        // distingue «se les pasó contar» de «contaron de más».
        <p className="mon-profile-table-recorte">
          El equipo declaró <strong>{fmt(e.declaradas)}</strong> encuestas aplicadas,{" "}
          {e.descuadre > 0 ? `${fmt(e.descuadre)} más` : `${fmt(Math.abs(e.descuadre))} menos`} de
          lo que implica esta cadena.
        </p>
      ) : null}
    </div>
  );
}
