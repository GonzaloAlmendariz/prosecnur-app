import { useMemo } from "react";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { PlotlyChart } from "../../../../lib/PlotlyChart";
import { COLOR_SEPARADOR_BARRA } from "../../coloresDeResultado";
import { TRAMOS_DE_APLICACION, estadoDeAplicacion } from "./estadoDeAplicacion";

/**
 * El STATUS DE APLICACIÓN en una barra: cuántas cumplen y cuántas ni se han tocado.
 *
 * Va antes que la cobertura porque contesta la pregunta anterior. La cobertura
 * dice cuánto lleva recogido cada aula; ésta dice **cuántas aulas hay en cada
 * punto del circuito**, y sobre todo separa «sin agendar» de «agendada y aún sin
 * empezar», que la cobertura mete en el mismo saco.
 */
export function AulasEstadoChart({ filas, resumen, desconocidasMotor }: {
  filas: ReadonlyArray<MonitoreoAulasPlanRow>;
  /** El reparto del motor, sobre TODAS las filas y no sobre las 500 que viajan. */
  resumen?: ReadonlyArray<{ clave: string; aulas: number }> | null;
  /** Estados que el motor no supo clasificar: se declaran, no se tragan. */
  desconocidasMotor?: number;
}) {
  const { estados, desconocidas, total, sinSalirACampo } = useMemo(
    () => {
      // El reparto del MOTOR primero: la vista lo sumaba sobre `course_status`,
      // que viaja recortado a 500 filas de 2 615, y el recorte no es una muestra
      // al azar —el orden pone `en_aplicacion` primero—, así que el gráfico
      // salía sesgado hacia lo avanzado.
      if (resumen?.length) {
        const porClave = new Map(resumen.map((e) => [e.clave, Number(e.aulas) || 0]));
        const estados = TRAMOS_DE_APLICACION.map((t) => ({
          clave: t.clave, etiqueta: t.etiqueta, color: t.color,
          aulas: porClave.get(t.clave) ?? 0,
        }));
        const total = estados.reduce((n, e) => n + e.aulas, 0);
        if (total) {
          return {
            estados, total,
            desconocidas: desconocidasMotor ?? 0,
            sinSalirACampo: estados
              .filter((e) => e.clave === "pendiente" || e.clave === "lista")
              .reduce((n, e) => n + e.aulas, 0),
          };
        }
      }
      return estadoDeAplicacion(filas);
    },
    [filas, resumen, desconocidasMotor],
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
    // C1: quién posee el espacio interior del panel. Sin declararlo, el gate
    // cae a la cabecera como dueña y reporta sus 4-5 px de holgura como
    // `capacity-drift`, que es un diagnóstico sobre el sitio equivocado: el
    // panel sólo tiene 1 px libre abajo y el hueco está dentro del head.
    <div className="aulas-estado-chart" data-qa-geometry-capacity="owned" data-qa-geometry-member>
      <PlotlyChart
        data={data}
        height={104}
        ariaLabel="Cursos-horario por status de aplicación"
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
        {sinSalirACampo
          // El pie de ESTE gráfico habla de su propio eje. Decía «no han
          // recibido ni una respuesta» y contaba agendamiento: 14 aquí contra
          // los 48 que el panel de cobertura mostraba un dedo más abajo.
          ? `${sinSalirACampo} de ${total} cursos-horario todavía no salen a campo.`
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
