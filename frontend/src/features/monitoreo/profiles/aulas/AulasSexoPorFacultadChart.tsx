import { useMemo } from "react";

import type { MonitoreoRow } from "../../../../api/monitoreo";
import { PlotlyChart } from "../../../../lib/PlotlyChart";
import { fuenteDeEjeAulas } from "./ejesDeAulas";
import { COLOR_RESULTADO } from "../../coloresDeResultado";
import { celdasPorFacultad } from "./celdasPorFacultad";
import { fmt } from "./kpisDeAulas";

/**
 * Cuántos hombres y cuántas mujeres lleva cada facultad, y cuántos le faltan.
 *
 * Sustituye en este panel al gráfico de estratos del sorteo, que dibujaba
 * `FACULTAD · mayoría mujeres · 41 alumnos o más`. Gonzalo: «cómo vas a poner
 * mayoría hombres o mayoría mujeres cuando eso no me interesa; lo que me
 * interesa es cuántos hombres y cuántas mujeres, cómo vamos en cada estrato de
 * cada facultad».
 *
 * El estrato del sorteo lleva el sexo DOMINANTE DEL AULA, que es con lo que se
 * repartió la muestra; la cuota es de personas y un aula de mayoría hombres
 * aporta a las dos celdas. Son dos cortes distintos y el panel enseñaba el que
 * no se monitorea. El del sorteo sigue en la tabla de abajo, que es el registro
 * del diseño.
 *
 * Dos filas por facultad —una por sexo— y tres tramos en cada una: lo recogido,
 * lo que traerán las aulas ya agendadas, y el déficit que quedaría aun así. La
 * pregunta operativa no es «cómo va Derecho» sino «de qué lado va corta y si lo
 * agendado basta».
 */
export function AulasSexoPorFacultadChart({ celdas }: { celdas: ReadonlyArray<MonitoreoRow> }) {
  const filas = useMemo(() => celdasPorFacultad(celdas), [celdas]);

  if (!filas.length) {
    return (
      <p className="mon-profile-muted">
        Todavía no hay cuotas por sexo y facultad con las que comparar. Se llenan
        al declarar la cuota del estudio en Cálculo de muestra.
      </p>
    );
  }

  // Plotly dibuja el primero abajo: se invierte para que la facultad a la que
  // más le falta quede arriba, que es donde cae la vista.
  const orden = [...filas].reverse();
  const eje = orden.flatMap((f) => [`${f.facultad} · Mujeres`, `${f.facultad} · Hombres`]);
  const par = <T,>(f: (x: (typeof orden)[number]) => [T, T]) => orden.flatMap(f);

  const data = [
    {
      type: "bar",
      orientation: "h",
      name: "Recogidas",
      y: eje,
      x: par((f) => [f.mujeresLogrado, f.hombresLogrado]),
      marker: { color: COLOR_RESULTADO.efectiva },
      hovertemplate: "%{y}: %{x} recogidas<extra></extra>",
    },
    {
      type: "bar",
      orientation: "h",
      // El tramo que faltaba. Sin él las dos barras no suman la cuota y la
      // ámbar acaba llamándose «faltan» siendo el déficit proyectado.
      name: "Aportarán las aulas agendadas",
      y: eje,
      x: par((f) => [f.mujeresPendiente, f.hombresPendiente]),
      marker: { color: COLOR_RESULTADO.parcial },
      hovertemplate: "%{y}: %{x} de lo agendado<extra></extra>",
    },
    {
      type: "bar",
      orientation: "h",
      name: "Déficit proyectado",
      y: eje,
      x: par((f) => [f.mujeresDeficit, f.hombresDeficit]),
      marker: { color: COLOR_RESULTADO.pendiente },
      // Sin decimales: son personas. Y el cero no se escribe, que en una celda
      // cubierta la etiqueta «0» compite con las que sí piden algo.
      text: par((f) => [
        f.mujeresDeficit ? String(f.mujeresDeficit) : "",
        f.hombresDeficit ? String(f.hombresDeficit) : "",
      ]),
      textposition: "outside",
      cliponaxis: false,
      hovertemplate: "%{y}: déficit proyectado %{x}<extra></extra>",
    },
  ];

  const deficitTotal = filas.reduce((s, f) => s + f.deficit, 0);
  const cubiertas = filas.filter((f) => f.deficit === 0).length;

  return (
    <div className="aulas-cobertura-chart">
      <PlotlyChart
        data={data}
        height={Math.max(240, 22 * eje.length + 56)}
        ariaLabel="Respuestas recogidas y por recoger, por facultad y sexo"
        layout={{
          font: fuenteDeEjeAulas(),
          barmode: "stack",
          margin: { l: 8, r: 52, t: 30, b: 28 },
          xaxis: { title: { text: "respuestas" }, zeroline: false, fixedrange: true },
          yaxis: { automargin: true, fixedrange: true },
          showlegend: true,
          legend: { orientation: "h", y: 1.08, x: 0, traceorder: "normal" },
          bargap: 0.25,
        }}
        config={{ displayModeBar: false, responsive: true }}
      />
      <p className="mon-profile-table-recorte">
        Con todas las aulas agendadas aplicadas quedaría un déficit de{" "}
        {fmt(deficitTotal)} respuestas, repartido en {fmt(filas.length)}{" "}
        {filas.length === 1 ? "facultad" : "facultades"}.
        {cubiertas
          ? ` ${fmt(cubiertas)} ${cubiertas === 1 ? "alcanza" : "alcanzan"} su cuota en los dos sexos.`
          : ""}
      </p>
    </div>
  );
}
