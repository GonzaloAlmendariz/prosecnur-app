import type { ReactNode } from "react";

import { filasAlfabeticas } from "./metasDeLaPestana";
import type { MonitoreoAulasProyeccionFila } from "../../../../api/monitoreo";
import "./aulasMetas.css";

const GRUPO = 62;
const BARRA = 19;
const HUECO = 5;
const ALTO = 300;
const MARGEN = { arriba: 14, abajo: 96, izq: 42, der: 8 };

/**
 * «Metas por facultad»: cada facultad, sus dos cuotas y lo que lleva de cada
 * una. El contorno es la meta; el relleno, lo conseguido.
 *
 * **Escala COMÚN, al revés que el gauge de «Metas y aulas», y a propósito.**
 * Aquí el alto compara el tamaño del trabajo ENTRE facultades —pedir 792
 * encuestas no es lo mismo que pedir 20— y eso sólo se ve si todas miden contra
 * la misma regla. El gauge contesta la otra pregunta —¿esta facultad llega?— y
 * para eso la escala tiene que ser suya. Dos gráficos porque son dos preguntas,
 * no por adorno.
 *
 * SVG y no una librería: son treinta rectángulos y una rejilla. Plotly entraría
 * al bundle por esto.
 */
export function AulasMetasBarras({ filas }: {
  filas: ReadonlyArray<MonitoreoAulasProyeccionFila> | null;
}): ReactNode {
  const orden = filasAlfabeticas(filas);
  if (!orden.length) return null;

  // El techo lo fija la META más alta, no lo conseguido: la barra de contorno
  // es la que tiene que caber entera, y una escala sobre lo logrado recortaría
  // justo la facultad que más pide.
  const techo = Math.max(
    ...orden.map((f) => Math.max(f.meta_M, f.meta_F, f.obtenidas_M, f.obtenidas_F)),
    1,
  ) * 1.08;
  const ancho = MARGEN.izq + MARGEN.der + orden.length * GRUPO;
  const util = ALTO - MARGEN.arriba - MARGEN.abajo;
  const y = (v: number) => MARGEN.arriba + util * (1 - v / techo);
  const alto = (v: number) => Math.max(0, (util * v) / techo);

  return (
    <div className="aulas-metas-scroll">
      <p className="aulas-metas-leyenda">
        <span><i className="aulas-metas-swatch" data-tramo="aplicado" />Conseguido</span>
        <span><i className="aulas-metas-swatch" data-tramo="meta-contorno" />Meta</span>
        <span>Cada facultad, con su carril de hombres a la izquierda</span>
      </p>
      <svg
        viewBox={`0 0 ${ancho} ${ALTO}`}
        width={ancho}
        height={ALTO}
        role="img"
        aria-label="Meta y conseguido de cada facultad, por sexo, en la misma escala"
      >
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const v = techo * t;
          return (
            <g key={t}>
              <line
                x1={MARGEN.izq} x2={ancho - MARGEN.der} y1={y(v)} y2={y(v)}
                className="aulas-metas-rejilla"
              />
              <text
                x={MARGEN.izq - 6} y={y(v) + 3.5} textAnchor="end"
                className="aulas-metas-eje"
              >
                {Math.round(v)}
              </text>
            </g>
          );
        })}
        {orden.map((f, i) => {
          const x0 = MARGEN.izq + i * GRUPO + 8;
          const carriles = [
            [f.meta_M, f.obtenidas_M, 0],
            [f.meta_F, f.obtenidas_F, BARRA + HUECO],
          ] as const;
          // La etiqueta se recorta con puntos suspensivos: «CIENCIAS Y ARTES DE
          // LA COMUN.» a 45° se come el alto entero del pie del gráfico.
          const etiqueta = f.facultad.length > 26 ? `${f.facultad.slice(0, 25)}…` : f.facultad;
          return (
            <g key={f.facultad}>
              {carriles.map(([meta, obtenidas, dx]) => (
                <g key={dx}>
                  <rect
                    x={x0 + dx} y={y(meta)} width={BARRA} height={alto(meta)}
                    className="aulas-metas-barra-meta"
                  />
                  <rect
                    x={x0 + dx} y={y(obtenidas)} width={BARRA} height={alto(obtenidas)}
                    className="aulas-metas-barra-logro"
                  />
                </g>
              ))}
              <text
                transform={`translate(${x0 + BARRA},${ALTO - MARGEN.abajo + 12}) rotate(45)`}
                className="aulas-metas-etiqueta"
              >
                {etiqueta}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
