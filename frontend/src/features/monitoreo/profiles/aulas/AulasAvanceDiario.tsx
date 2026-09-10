import type { ReactNode } from "react";

import { fmt } from "./kpisDeAulas";
import type { DiaDeRitmo } from "./AulasRitmoDiario";
import "./aulasAvanceDiario.css";

/**
 * «Avance diario»: las efectivas de cada día en barras y el acumulado en línea,
 * cada uno con su propio eje.
 *
 * **Es el gráfico que Gonzalo dibujó**, y su reclamo del 2026-09-10: «no estás
 * tomando en cuenta mi artefacto donde dejé varios gráficos a utilizar, como el
 * avance diario». El dato ya estaba en la app —`{fecha, validas, acumulado}`—
 * pero se enseñaba como una tabla de diez filas con el acumulado en una celda:
 * la cifra estaba y la CURVA no, que es lo que dice si el ritmo se sostiene.
 *
 * **Por qué dos ejes y no uno.** El acumulado llega a 944 y el mejor día son
 * 341: en un eje común las barras quedarían aplastadas contra el suelo, que es
 * justo lo que este panel no puede permitirse. Cada serie tiene su escala y su
 * rótulo del color de su serie, como en el boceto.
 *
 * SVG a mano y no Plotly: son los días de un operativo —diez en este estudio— y
 * esta pestaña ya carga bastante. Misma decisión que la agenda por día.
 */

const ALTO = 250;
const PAD = { arriba: 22, abajo: 44, izq: 52, der: 56 };

/** «2026-09-08» → «08/09», que es como el boceto rotula el eje. */
const diaMes = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export function AulasAvanceDiario({ dias }: { dias: ReadonlyArray<DiaDeRitmo> }): ReactNode {
  if (!dias.length) {
    return (
      <p className="mon-profile-muted" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
        Todavía no hay ningún día con efectivas.
      </p>
    );
  }

  // Ancho por día, con mínimo: con tres días un SVG estirado deja tres barras
  // gigantes; con quince, las etiquetas se pisan.
  const ancho = Math.max(420, 90 * dias.length + 140);
  const util = { x: ancho - PAD.izq - PAD.der, y: ALTO - PAD.arriba - PAD.abajo };
  // **Los dos techos llevan aire.** Sin el margen, la barra más alta toca el
  // borde y se lee como si el eje se hubiera quedado corto.
  const techoBarra = Math.max(...dias.map((d) => d.validas), 1) * 1.15;
  const techoLinea = Math.max(...dias.map((d) => d.acumulado), 1) * 1.1;
  const ancho1 = Math.min(46, (util.x / dias.length) * 0.5);
  const cx = (i: number) => PAD.izq + (util.x * (i + 0.5)) / dias.length;
  const yBarra = (v: number) => PAD.arriba + util.y * (1 - v / techoBarra);
  const yLinea = (v: number) => PAD.arriba + util.y * (1 - v / techoLinea);
  const suelo = yBarra(0);

  return (
    <div className="aulas-avdia" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
      <svg
        viewBox={`0 0 ${ancho} ${ALTO}`}
        width={ancho}
        height={ALTO}
        role="img"
        aria-label={`Efectivas por día y acumulado. ${dias
          .map((d) => `${diaMes(d.fecha)}: ${d.validas} en el día, ${d.acumulado} acumuladas`)
          .join("; ")}`}
      >
        {/* Tres reglas —0, mitad y techo— con su cifra a cada lado, cada una del
            color de SU serie: es lo único que evita leer la línea contra el eje
            de las barras. */}
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line x1={PAD.izq} x2={ancho - PAD.der} y1={yBarra(techoBarra * t)} y2={yBarra(techoBarra * t)}
              className="aulas-avdia-regla" />
            <text x={PAD.izq - 7} y={yBarra(techoBarra * t) + 3.5} textAnchor="end"
              className="aulas-avdia-eje es-dia">{Math.round(techoBarra * t)}</text>
            <text x={ancho - PAD.der + 7} y={yLinea(techoLinea * t) + 3.5}
              className="aulas-avdia-eje es-acumulado">{Math.round(techoLinea * t)}</text>
          </g>
        ))}
        {dias.map((d, i) => (
          <g key={d.fecha}>
            <rect x={cx(i) - ancho1 / 2} y={yBarra(d.validas)} width={ancho1}
              height={Math.max(0, suelo - yBarra(d.validas))} className="aulas-avdia-barra" />
            {/* La cifra del día ENCIMA de su barra. El boceto no la lleva, pero
                la tabla que este gráfico sustituye sí la tenía, y perderla para
                ganar la curva sería cambiar un dato por otro en vez de sumarlos. */}
            {d.validas > 0 ? (
              <text x={cx(i)} y={yBarra(d.validas) - 5} textAnchor="middle"
                className="aulas-avdia-valor">{fmt(d.validas)}</text>
            ) : null}
            <text x={cx(i)} y={ALTO - PAD.abajo + 16} textAnchor="middle"
              className="aulas-avdia-fecha">{diaMes(d.fecha)}</text>
          </g>
        ))}
        <polyline className="aulas-avdia-linea" fill="none"
          points={dias.map((d, i) => `${cx(i)},${yLinea(d.acumulado)}`).join(" ")} />
        {dias.map((d, i) => (
          <circle key={d.fecha} cx={cx(i)} cy={yLinea(d.acumulado)} r={3.2} className="aulas-avdia-punto" />
        ))}
        <text x={PAD.izq} y={11} className="aulas-avdia-eje es-dia">efectivas del día</text>
        <text x={ancho - PAD.der} y={11} textAnchor="end"
          className="aulas-avdia-eje es-acumulado">acumulado</text>
      </svg>
    </div>
  );
}
