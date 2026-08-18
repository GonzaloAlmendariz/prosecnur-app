import { useMemo } from "react";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { PlotlyChart } from "../../../../lib/PlotlyChart";
import { COLOR_RESULTADO } from "../../coloresDeResultado";
import { coberturaPorAula } from "./coberturaPorAula";

/**
 * Cuántos cursos-horario hay en cada nivel de cobertura.
 *
 * El promedio esconde la forma: sesenta aulas al 50 % y sesenta al 100 % dan el
 * mismo avance global que ciento veinte al 75 %, y piden decisiones opuestas.
 * Este es el único gráfico del catálogo que no existe en los otros perfiles,
 * porque sólo aquí la unidad lleva su propia meta.
 */
export function AulasCoberturaChart({ filas }: { filas: ReadonlyArray<MonitoreoAulasPlanRow> }) {
  const { tramos, sinMeta, total } = useMemo(() => coberturaPorAula(filas), [filas]);

  if (!total) {
    return (
      // La anatomía del vacío del perfil (precedente en `AulasAvanceCuota`):
      // el wrap exento declara su capacidad y sus reglas ciñen el `p`.
      <div className="mon-profile-table-wrap" data-qa-geometry-capacity="owned" data-qa-geometry-member>
        <p className="mon-profile-muted">
          Todavía no hay cursos-horario con meta que repartir en tramos.
        </p>
      </div>
    );
  }

  const data = [{
    type: "bar",
    orientation: "h",
    // De «meta cumplida» arriba a «sin respuestas» abajo: se lee de mejor a
    // peor, y lo que exige acción queda al pie, que es donde cae la vista.
    y: tramos.map((t) => t.etiqueta).reverse(),
    x: tramos.map((t) => t.aulas).reverse(),
    marker: { color: tramos.map((t) => COLOR_RESULTADO[t.tono]).reverse() },
    text: tramos.map((t) => (t.aulas ? String(t.aulas) : "")).reverse(),
    textposition: "auto",
    hovertemplate: "%{y}: %{x} cursos-horario<extra></extra>",
  }];

  return (
    // El envoltorio reserva el alto: el panel es un grid y el div que Plotly
    // monta no empuja su fila, así que sin esto el panel medía 26 px —sólo su
    // cabecera— y el gráfico se dibujaba encima de la tabla de abajo.
    <div className="aulas-cobertura-chart">
      <PlotlyChart
        data={data}
        height={220}
        ariaLabel="Cursos-horario por nivel de cobertura de su meta"
        layout={{
          margin: { l: 110, r: 16, t: 8, b: 28 },
          xaxis: { title: { text: "cursos-horario" }, zeroline: false, fixedrange: true },
          yaxis: { automargin: true, fixedrange: true },
          showlegend: false,
          bargap: 0.28,
        }}
        config={{ displayModeBar: false, responsive: true }}
      />
      {sinMeta ? (
        // No se esconde ni se reparte: un aula sin meta no cabe en una escala
        // relativa, y decir cuántas son es parte de lo que el gráfico informa.
        <p className="mon-profile-table-recorte">
          {sinMeta} {sinMeta === 1 ? "curso-horario no declara" : "cursos-horario no declaran"} su
          meta, así que {sinMeta === 1 ? "queda" : "quedan"} fuera del reparto.
        </p>
      ) : null}
    </div>
  );
}
