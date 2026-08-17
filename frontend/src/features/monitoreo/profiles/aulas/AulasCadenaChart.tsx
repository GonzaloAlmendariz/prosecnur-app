import { useMemo } from "react";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { PlotlyChart } from "../../../../lib/PlotlyChart";
import { COLOR_RESULTADO } from "../../coloresDeResultado";
import { consumoDeCadena } from "./consumoDeCadena";

/** De cadena intacta a cadena muy consumida: el color acompaña el desgaste. */
const TONOS = [
  COLOR_RESULTADO.efectiva,
  COLOR_RESULTADO.parcial,
  COLOR_RESULTADO.rechazo,
  COLOR_RESULTADO.rechazo,
];

/**
 * Cuánta reserva lleva gastada el operativo.
 *
 * La tabla de reemplazos dice, aula por aula, cuál entró y por qué. Lo que no
 * dice es si el **plan** aguanta: para eso hay que contar cuántas cadenas siguen
 * intactas y cuántas van por el tercer eslabón. El estudio de 2025 planificó
 * cadenas de hasta once y consumió dos.
 */
export function AulasCadenaChart({ filas }: { filas: ReadonlyArray<MonitoreoAulasPlanRow> }) {
  const { tramos, sinReserva, reservasLibres, reservasGastadas, cadenas } = useMemo(
    () => consumoDeCadena(filas),
    [filas],
  );

  if (!cadenas) {
    return (
      <p className="mon-profile-muted">
        {sinReserva
          // No es lo mismo «no hay plan» que «el plan no dotó reservas»: la
          // segunda es una decisión de la muestra y hay que poder verla (L54).
          ? `Ninguno de los ${sinReserva} cursos-horario titulares tiene reserva en el plan.`
          : "El plan todavía no declara cadenas de reemplazo."}
      </p>
    );
  }

  const data = [{
    type: "bar",
    x: tramos.map((t) => t.etiqueta),
    y: tramos.map((t) => t.cadenas),
    marker: { color: TONOS },
    text: tramos.map((t) => (t.cadenas ? String(t.cadenas) : "")),
    textposition: "outside",
    cliponaxis: false,
    hovertemplate: "%{x}: %{y} cadenas<extra></extra>",
  }];

  return (
    <div className="aulas-cadena-chart">
      <PlotlyChart
        data={data}
        height={200}
        ariaLabel="Cadenas de reemplazo por reservas consumidas"
        layout={{
          margin: { l: 40, r: 12, t: 20, b: 40 },
          xaxis: { fixedrange: true },
          yaxis: { title: { text: "cadenas" }, zeroline: false, fixedrange: true, rangemode: "tozero" },
          showlegend: false,
          bargap: 0.4,
        }}
        config={{ displayModeBar: false, responsive: true }}
      />
      <p className="mon-profile-table-recorte">
        {reservasGastadas
          ? `${reservasGastadas} reservas gastadas y ${reservasLibres} todavía en el banco.`
          : `Ninguna reserva gastada: las ${reservasLibres} del plan siguen en el banco.`}
        {sinReserva
          ? ` ${sinReserva} ${sinReserva === 1 ? "titular no tiene" : "titulares no tienen"} ninguna reserva, así que ${sinReserva === 1 ? "su meta queda" : "sus metas quedan"} sin cubrir si ${sinReserva === 1 ? "cae" : "caen"}.`
          : ""}
      </p>
    </div>
  );
}
