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
export function AulasCoberturaChart({ filas, resumen, sinMetaMotor }: {
  filas: ReadonlyArray<MonitoreoAulasPlanRow>;
  /** El reparto del motor, sobre TODAS las filas y no sobre las 500 que viajan. */
  resumen?: ReadonlyArray<{ clave: string; aulas: number }> | null;
  /** Las aulas sin meta declarada, también del motor. */
  sinMetaMotor?: number;
}) {
  const { tramos, sinMeta, total } = useMemo(() => {
    // El reparto del MOTOR primero, por la misma razón que el de estado: la
    // vista lo sumaba sobre las 500 filas que viajan de 2 615, y ésas están
    // ordenadas por tramo del circuito.
    if (resumen?.length) {
      const porClave = new Map(resumen.map((e) => [e.clave, Number(e.aulas) || 0]));
      const claves = ["sin_respuestas", "hasta_25", "hasta_50", "hasta_99", "cumplida"] as const;
      const base = coberturaPorAula([]);
      const tramosMotor = base.tramos.map((t, i) => ({ ...t, aulas: porClave.get(claves[i]) ?? 0 }));
      const totalMotor = tramosMotor.reduce((n, t) => n + t.aulas, 0);
      if (totalMotor) return { tramos: tramosMotor, sinMeta: sinMetaMotor ?? 0, total: totalMotor };
    }
    return coberturaPorAula(filas);
  }, [filas, resumen, sinMetaMotor]);

  // `sinMeta` ya viene contado del motor: decir CUÁNTOS no declaran meta manda a
  // la columna que hay que rellenar, y distingue ese caso de no tener plan.
  if (!total) {
    return (
      <p className="mon-profile-muted">
        {sinMeta
          ? `Ninguno de los ${sinMeta.toLocaleString("es-PE")} cursos-horario del plan declara cuántas respuestas espera, así que no hay cobertura que repartir en tramos.`
          : "El plan todavía no trae cursos-horario."}
      </p>
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
    // C1: quién posee el espacio interior del panel. Sin declararlo, el gate
    // cae a la cabecera como dueña y reporta sus 4-5 px de holgura como
    // `capacity-drift`, que es un diagnóstico sobre el sitio equivocado: el
    // panel sólo tiene 1 px libre abajo y el hueco está dentro del head.
    <div className="aulas-cobertura-chart" data-qa-geometry-capacity="owned" data-qa-geometry-member>
      <PlotlyChart
        data={data}
        // **Cinco barras en 220 px con 739 de columna muerta al lado.** Se
        // sube para acercarse al panel vecino: Gonzalo, «ambos elementos
        // paralelos deben tener un alto equilibrado». No es estirar el marco
        // dejando hueco —eso ya lo castigo el gate con 380 px de
        // `capacity-drift`—: es que el contenido USE el alto, que es lo que la
        // clausula pide. Plotly no crece con su fila, asi que va en la prop.
        height={360}
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
