import { useEffect, useMemo, useState } from "react";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { PlotlyChart } from "../../../../lib/PlotlyChart";
import { fuenteDeEjeAulas } from "./ejesDeAulas";
import { COLOR_RESULTADO } from "../../coloresDeResultado";
import { coberturaPorAula } from "./coberturaPorAula";
import { fmt } from "./kpisDeAulas";

/**
 * Cuántos cursos-horario hay en cada nivel de cobertura.
 *
 * El promedio esconde la forma: sesenta aulas al 50 % y sesenta al 100 % dan el
 * mismo avance global que ciento veinte al 75 %, y piden decisiones opuestas.
 * Este es el único gráfico del catálogo que no existe en los otros perfiles,
 * porque sólo aquí la unidad lleva su propia meta.
 */
/**
 * Alto del grafico segun el sitio que haya.
 *
 * En grande va **al lado** de «Dónde falta más» y sube a 360 para que la pareja
 * quede pareja —antes eran 311 contra 1 050, con 739 px de columna muerta—. En
 * un viewport bajo la pareja **se apila**, asi que no hay nada que equilibrar y
 * 360 px de cinco barras se comen el 60 % de una pantalla de 600.
 *
 * La clausula lo dice: al cambiar de regimen responsive el alto objetivo puede
 * cambiar, pero cambia para todo el grupo. Aqui el grupo se deshace, y con el la
 * razon de ser del alto grande.
 */
const ALTO_COMPACTO = 820;
const ALTO_DEL_GRAFICO = { amplio: 360, compacto: 220 };

export function AulasCoberturaChart({ filas, resumen, sinMetaMotor, bancoMotor = 0 }: {
  filas: ReadonlyArray<MonitoreoAulasPlanRow>;
  /** El reparto del motor, sobre TODAS las filas y no sobre las 500 que viajan. */
  resumen?: ReadonlyArray<{ clave: string; aulas: number }> | null;
  /** Las aulas sin meta declarada, también del motor. */
  sinMetaMotor?: number;
  /**
   * Reservas del banco, que el motor ya NO reparte en tramos: son aulas
   * adicionales esperando en su estrato, no aulas que alguien vaya a visitar, y
   * contarlas como «sin respuestas» convertia el banco en alarma —73 de las 121
   * que salian ahi—. Se recibe para poder NOMBRARLAS: sacarlas del reparto y no
   * decir donde fueron deja al lector con dos totales que no cuadran entre la
   * cabecera del panel y este pie.
   */
  bancoMotor?: number;
}) {
  // Se mide una vez y se escucha el cambio: el usuario redimensiona y el grafico
  // tiene que encogerse con la ventana, no en la siguiente carga.
  const [compacto, setCompacto] = useState(
    () => typeof window !== "undefined" && window.innerHeight <= ALTO_COMPACTO,
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-height: ${ALTO_COMPACTO}px)`);
    const alCambiar = () => setCompacto(mq.matches);
    alCambiar();
    mq.addEventListener("change", alCambiar);
    return () => mq.removeEventListener("change", alCambiar);
  }, []);

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
      <p className="mon-profile-muted" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
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
        // Plotly no crece con su fila: el alto va en la prop, no en el CSS.
        height={compacto ? ALTO_DEL_GRAFICO.compacto : ALTO_DEL_GRAFICO.amplio}
        ariaLabel="Cursos-horario por nivel de cobertura de su meta"
        layout={{
          // La escala de eje del perfil, no el default compartido de Plotly.
          font: fuenteDeEjeAulas(),
          margin: { l: 110, r: 16, t: 8, b: 28 },
          xaxis: { title: { text: "cursos-horario" }, zeroline: false, fixedrange: true },
          yaxis: { automargin: true, fixedrange: true },
          showlegend: false,
          bargap: 0.28,
        }}
        config={{ displayModeBar: false, responsive: true }}
      />
      {sinMeta || bancoMotor ? (
        // No se esconde ni se reparte: un aula sin meta no cabe en una escala
        // relativa, y decir cuántas son es parte de lo que el gráfico informa.
        <p className="mon-profile-table-recorte">
          {sinMeta ? (
            <>
              {sinMeta} {sinMeta === 1 ? "curso-horario no declara" : "cursos-horario no declaran"} su
              meta, así que {sinMeta === 1 ? "queda" : "quedan"} fuera del reparto.
            </>
          ) : null}
          {bancoMotor ? (
            <>
              {sinMeta ? " " : ""}
              {fmt(bancoMotor)} {bancoMotor === 1 ? "es reserva del banco y tampoco entra" : "son reservas del banco y tampoco entran"}:
              {" "}esperan en su estrato y contarlas como «sin respuestas» las volvería una alarma.
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
