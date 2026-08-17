import { useMemo } from "react";

import type { MonitoreoRow } from "../../../../api/monitoreo";
import { PlotlyChart } from "../../../../lib/PlotlyChart";
import { COLOR_RESULTADO } from "../../coloresDeResultado";
import { cuotasSexoFacultad } from "./cuotasSexoFacultad";

/**
 * Qué celda de cuota se va a incumplir.
 *
 * Es la única vista del catálogo que mira dentro de la muestra en vez de contar
 * aulas: dos facultades pueden ir igual de bien en respuestas y una tener la
 * cuota de mujeres a cero. Por eso el eje es el **cumplimiento** y no el volumen
 * —cada celda tiene su propia meta— y por eso la peor va arriba.
 */
export function AulasCuotasChart({ filas }: { filas: ReadonlyArray<MonitoreoRow> }) {
  const { celdas, omitidas, sinMeta, cumplidas, faltanTotal, total } = useMemo(
    () => cuotasSexoFacultad(filas),
    [filas],
  );

  if (!total) {
    return (
      <p className="mon-profile-muted">
        {sinMeta
          // Que existan celdas sin meta no es lo mismo que no haber cuotas: la
          // primera dice que el plan las declaró sin objetivo.
          ? `Las ${sinMeta} celdas de cuota del plan no declaran objetivo.`
          : "El plan no declara composición por sexo para estos cursos-horario."}
      </p>
    );
  }

  // La peor arriba: Plotly dibuja el primer elemento abajo, así que se invierte.
  const orden = [...celdas].reverse();
  const data = [{
    type: "bar",
    orientation: "h",
    y: orden.map((c) => c.etiqueta),
    x: orden.map((c) => c.avance),
    marker: { color: orden.map((c) => c.color) },
    text: orden.map((c) => `${c.observadas} de ${c.meta}`),
    textposition: "outside",
    cliponaxis: false,
    hovertemplate: "%{y}: %{x}% de la meta<extra></extra>",
  }];

  return (
    <div className="aulas-cuotas-chart">
      <PlotlyChart
        data={data}
        height={Math.max(200, 30 * orden.length + 60)}
        ariaLabel="Cumplimiento de cada celda de cuota sexo por facultad"
        layout={{
          margin: { l: 8, r: 84, t: 8, b: 34 },
          xaxis: { title: { text: "% de la meta" }, zeroline: false, fixedrange: true },
          yaxis: { automargin: true, fixedrange: true },
          // La línea del 100 % es la vara: sin ella una barra larga no dice si
          // llegó, y con metas distintas por celda no hay otra referencia.
          // Va en el gris de `revision`, que es el mismo de las etiquetas de
          // eje —el propio `coloresDeResultado` lo documenta como sobrecargado y
          // por eso no lo vigila—: la línea es cromo, no un dato, y pintarla del
          // gris de `pendiente` diría que es una serie más.
          shapes: [{
            type: "line", xref: "x", yref: "paper",
            x0: 100, x1: 100, y0: 0, y1: 1,
            line: { color: COLOR_RESULTADO.revision, width: 1, dash: "dot" },
          }],
          showlegend: false,
          bargap: 0.3,
        }}
        config={{ displayModeBar: false, responsive: true }}
      />
      <p className="mon-profile-table-recorte">
        {cumplidas
          ? `${cumplidas} de ${total} celdas alcanzaron su cuota.`
          : `Ninguna de las ${total} celdas alcanzó su cuota todavía.`}
        {faltanTotal ? ` Faltan ${faltanTotal} respuestas repartidas entre ellas.` : ""}
        {sinMeta ? ` ${sinMeta} ${sinMeta === 1 ? "celda no declara" : "celdas no declaran"} objetivo y ${sinMeta === 1 ? "queda" : "quedan"} fuera del reparto.` : ""}
        {omitidas ? ` No se dibujan ${omitidas} celdas con mejor avance.` : ""}
      </p>
    </div>
  );
}
