import type { ReactNode } from "react";

import { fmt } from "./kpisDeAulas";
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
        <span><i className="aulas-metas-swatch" data-sexo="hombres" />Hombres</span>
        <span><i className="aulas-metas-swatch" data-sexo="mujeres" />Mujeres</span>
        <span><i className="aulas-metas-swatch" data-tramo="meta-contorno" />Meta</span>
      </p>
      {/* **Ocupa el ancho del panel.** Iba con `width` en píxeles y en pantallas
          anchas dejaba un vacío a la derecha; con el viewBox puesto, el 100 %
          escala sin deformar y el scroll horizontal sólo aparece cuando de
          verdad no caben las quince facultades. */}
      <svg
        viewBox={`0 0 ${ancho} ${ALTO}`}
        className="aulas-metas-lienzo"
        preserveAspectRatio="xMinYMid meet"
        style={{ minWidth: `${ancho}px` }}
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
            [f.meta_M, f.obtenidas_M, 0, "hombres"],
            [f.meta_F, f.obtenidas_F, BARRA + HUECO, "mujeres"],
          ] as const;
          // La etiqueta se recorta con puntos suspensivos: «CIENCIAS Y ARTES DE
          // LA COMUN.» a 45° se come el alto entero del pie del gráfico.
          const etiqueta = f.facultad.length > 26 ? `${f.facultad.slice(0, 25)}…` : f.facultad;
          return (
            <g key={f.facultad}>
              {carriles.map(([meta, obtenidas, dx, tono]) => (
                <g key={dx}>
                  <rect
                    x={x0 + dx} y={y(meta)} width={BARRA} height={alto(meta)}
                    className="aulas-metas-barra-meta"
                  />
                  {/* Cada sexo con su tono, el mismo de su chip en las tablas:
                      en verde las dos, el carril de hombres y el de mujeres
                      sólo se distinguían por la posición. */}
                  <rect
                    x={x0 + dx} y={y(obtenidas)} width={BARRA} height={alto(obtenidas)}
                    className="aulas-metas-barra-logro" data-sexo={tono}
                  >
                    <title>
                      {`${f.facultad} · ${tono === "hombres" ? "Hombres" : "Mujeres"}: `}
                      {fmt(Math.round(obtenidas))} de {fmt(Math.round(meta))}
                    </title>
                  </rect>
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
