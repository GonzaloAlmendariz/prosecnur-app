import { useMemo } from "react";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { PlotlyChart } from "../../../../lib/PlotlyChart";
import { COLOR_SEPARADOR_BARRA } from "../../coloresDeResultado";
import { estadoDeAplicacion } from "./estadoDeAplicacion";

/**
 * El circuito entero en una barra: cuántas cerradas y cuántas ni se han tocado.
 *
 * Va antes que la cobertura porque contesta la pregunta anterior. La cobertura
 * dice cuánto lleva recogido cada aula; ésta dice **cuántas aulas hay en cada
 * punto del circuito**, y sobre todo separa «sin agendar» de «agendada y aún sin
 * empezar», que la cobertura mete en el mismo saco.
 */
export function AulasEstadoChart({ filas }: { filas: ReadonlyArray<MonitoreoAulasPlanRow> }) {
  const { estados, desconocidas, total, sinEmpezar } = useMemo(
    () => estadoDeAplicacion(filas),
    [filas],
  );

  if (!total) {
    return <p className="mon-profile-muted">Todavía no hay cursos-horario en el plan.</p>;
  }

  const data = estados.map((estado) => ({
    type: "bar",
    orientation: "h",
    name: estado.etiqueta,
    y: ["Cursos-horario"],
    x: [estado.aulas],
    marker: {
      color: estado.color,
      // El trazo blanco es lo que deja ver la frontera entre dos segmentos
      // contiguos cuando uno de ellos es muy corto.
      line: { color: COLOR_SEPARADOR_BARRA, width: 1 },
    },
    text: [estado.aulas ? String(estado.aulas) : ""],
    textposition: "inside",
    insidetextanchor: "middle",
    hovertemplate: `${estado.etiqueta}: %{x} de ${total}<extra></extra>`,
  }));

  return (
    <div className="aulas-estado-chart">
      <PlotlyChart
        data={data}
        height={104}
        ariaLabel="Cursos-horario por estado del circuito"
        layout={{
          barmode: "stack",
          margin: { l: 8, r: 8, t: 30, b: 8 },
          xaxis: { visible: false, fixedrange: true },
          yaxis: { visible: false, fixedrange: true },
          // Igual que en brecha por estrato: `PlotlyChart` esconde la leyenda
          // por defecto, y aquí sin ella los cuatro colores no dicen nada.
          showlegend: true,
          legend: { orientation: "h", y: 1.5, x: 0, traceorder: "normal" },
          bargap: 0.35,
        }}
        config={{ displayModeBar: false, responsive: true }}
      />
      <p className="mon-profile-table-recorte">
        {sinEmpezar
          ? `${sinEmpezar} de ${total} cursos-horario no han recibido ni una respuesta.`
          : `Los ${total} cursos-horario ya recibieron respuestas.`}
        {/* Un estado que el motor no declare se dice, no se descarta: es el
            mismo patrón de lista cerrada que ya costó doce ítems. */}
        {desconocidas
          ? ` ${desconocidas} en un estado que esta vista no reconoce.`
          : ""}
      </p>
    </div>
  );
}
