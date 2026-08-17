import { useMemo } from "react";

import type { MonitoreoRow } from "../../../../api/monitoreo";
import { PlotlyChart } from "../../../../lib/PlotlyChart";
import { COLOR_RESULTADO } from "../../coloresDeResultado";
import { brechaPorEstrato } from "./brechaPorEstrato";

/**
 * Dónde falta más, de un vistazo.
 *
 * La tabla de `avance_por_estrato` trae los mismos números, pero contesta mal la
 * pregunta del día siguiente: hay que leer diez filas y restar de cabeza. Aquí
 * el estrato con la barra ámbar más larga es el destino, y la verde de al lado
 * dice cuánto lleva recogido para no confundir «falta mucho» con «no ha
 * empezado».
 */
export function AulasBrechaEstratoChart({ filas }: { filas: ReadonlyArray<MonitoreoRow> }) {
  const resumen = useMemo(() => brechaPorEstrato(filas), [filas]);
  const { estratos, omitidos, brechaOmitida, brechaTotal, cerrados, total } = resumen;

  if (!total) {
    return <p className="mon-profile-muted">El plan no declara estratos que comparar.</p>;
  }
  if (!brechaTotal) {
    // No es un vacío: es la mejor noticia posible del operativo, y decirla como
    // «no hay datos» la haría parecer un fallo.
    return (
      <p className="mon-profile-muted">
        Los {total} estratos alcanzaron su meta: no queda brecha que repartir.
      </p>
    );
  }

  // Plotly dibuja el primer elemento abajo: se invierte para que el estrato con
  // más brecha quede arriba, que es donde cae la vista.
  const orden = [...estratos].reverse();
  const data = [
    {
      type: "bar",
      orientation: "h",
      name: "Recogidas",
      y: orden.map((e) => e.estrato),
      x: orden.map((e) => e.validas),
      marker: { color: COLOR_RESULTADO.efectiva },
      hovertemplate: "%{y}: %{x} válidas<extra></extra>",
    },
    {
      type: "bar",
      orientation: "h",
      name: "Faltan",
      y: orden.map((e) => e.estrato),
      x: orden.map((e) => e.brecha),
      marker: { color: COLOR_RESULTADO.parcial },
      text: orden.map((e) => (e.brecha ? String(e.brecha) : "")),
      textposition: "outside",
      cliponaxis: false,
      hovertemplate: "%{y}: faltan %{x}<extra></extra>",
    },
  ];

  return (
    // Igual que en cobertura: el envoltorio reserva el alto porque el div de
    // Plotly no empuja su fila del grid.
    <div className="aulas-cobertura-chart">
      <PlotlyChart
        data={data}
        height={Math.max(200, 34 * orden.length + 56)}
        ariaLabel="Respuestas recogidas y brecha por estrato"
        layout={{
          barmode: "stack",
          margin: { l: 8, r: 52, t: 30, b: 28 },
          xaxis: { title: { text: "respuestas" }, zeroline: false, fixedrange: true },
          yaxis: { automargin: true, fixedrange: true },
          // `PlotlyChart` esconde la leyenda por defecto —casi todos sus usos
          // tienen una serie— y aquí sin ella el verde no se explica: la barra
          // se leería como una sola magnitud. Va arriba, que es donde se lee
          // antes de mirar las barras.
          showlegend: true,
          // `traceorder: normal`: apilado, Plotly invierte la leyenda y la
          // dejaba como «Faltan · Recogidas», al revés de como se lee la barra.
          legend: { orientation: "h", y: 1.16, x: 0, traceorder: "normal" },
          bargap: 0.3,
        }}
        config={{ displayModeBar: false, responsive: true }}
      />
      <p className="mon-profile-table-recorte">
        Faltan {brechaTotal} respuestas en total.
        {cerrados ? ` ${cerrados} ${cerrados === 1 ? "estrato ya alcanzó" : "estratos ya alcanzaron"} su meta.` : ""}
        {/* El recorte se declara con su brecha: sin decir cuánto suman, la
            última barra se leería como «lo demás está cerrado». */}
        {omitidos ? ` No se dibujan ${omitidos} estratos con menos brecha, que suman ${brechaOmitida}.` : ""}
      </p>
    </div>
  );
}
