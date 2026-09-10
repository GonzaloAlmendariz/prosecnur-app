import type { ReactNode } from "react";

import { fmt } from "./kpisDeAulas";
import { filasAlfabeticas } from "./metasDeLaPestana";
import type { MonitoreoAulasProyeccionFila } from "../../../../api/monitoreo";
import "./aulasMetas.css";

const GRUPO = 62;
const BARRA = 19;
const HUECO = 5;
/**
 * **Más alto para las barras y menos pie.** Él: «las barras pueden tener más
 * alto». Los 96 px de pie eran para los nombres a 45°, que se comían un tercio
 * del gráfico; con los nombres en dos líneas horizontales bastan 54, y esos 42
 * px van a la barra, que es lo que se compara.
 */
const ALTO_BARRAS = 340;
const MARGEN = { arriba: 22, abajo: 54, izq: 42, der: 8 };

/** Cuántos caracteres caben por línea del rótulo, al ancho de un grupo. */
const POR_LINEA = 13;
/**
 * **Hasta CINCO líneas, no dos** (Gonzalo, 2026-09-10: «el eje puede tener más
 * de dos filas hasta 5 con tal de que entre bien»).
 *
 * Con el tope en dos, «ARQUITECTURA Y URBANISMO» y «GASTRONOMÍA, HOTELERÍA Y
 * TURISMO» salían cortadas con puntos suspensivos y se pisaban con su vecina:
 * el rótulo dejaba de distinguir una facultad de otra, que es para lo único que
 * está. Visto en pantalla ese día.
 */
const MAX_LINEAS = 5;
/** Alto de cada línea del rótulo, en unidades del viewBox. */
const ALTO_LINEA = 11;

/**
 * El nombre de una facultad en dos líneas, cortando por palabras.
 *
 * **Contraer antes de partir.** «CIENCIAS Y ARTES DE LA COMUN.» son veintiséis
 * caracteres y en dos líneas de trece cabe justo; las palabras vacías —«Y»,
 * «DE», «LA»— se van porque no distinguen una facultad de otra, que es para lo
 * que sirve el rótulo. Lo que no cabe se corta con puntos suspensivos y el
 * nombre entero queda en el `title`.
 */
export function enDosLineas(
  nombre: string, porLinea = POR_LINEA, maxLineas = MAX_LINEAS,
): string[] {
  const palabras = String(nombre ?? "").trim().split(/\s+/)
    .filter((p) => p && !["Y", "DE", "LA", "EL", "LAS", "LOS", "DEL"].includes(p.toUpperCase()));
  const lineas: string[] = [];
  let actual = "";
  for (const p of palabras) {
    if (!actual) actual = p;
    else if (`${actual} ${p}`.length <= porLinea) actual = `${actual} ${p}`;
    else { lineas.push(actual); actual = p; }
    if (lineas.length === maxLineas) break;
  }
  if (actual && lineas.length < maxLineas) lineas.push(actual);
  // El techo ya no empuja el pie a ciegas: el gráfico crece lo que ocupen las
  // líneas que de verdad se usan (`altoDelPie` abajo), así que subirlo no le
  // roba alto a las barras — que era el motivo por el que estaba en dos.
  return lineas.slice(0, maxLineas).map((l, i, todas) => (
    l.length > porLinea + 2
      ? `${l.slice(0, porLinea + 1)}…`
      : (i === todas.length - 1 && palabras.join(" ").length > todas.join(" ").length ? `${l}…` : l)
  ));
}

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
  // **El pie crece con los rótulos, y el alto del gráfico con él.** Antes el pie
  // eran 54 px fijos para dos líneas; subir el tope a cinco sin esto le habría
  // robado a las barras justo el alto que se les había devuelto. Se paga sólo lo
  // que ocupan las líneas que de verdad se usan: con facultades de nombre corto
  // el gráfico queda igual que antes.
  const lineasPorFacultad = orden.map((f) => enDosLineas(f.facultad).length);
  const maxLineas = Math.max(2, ...(lineasPorFacultad.length ? lineasPorFacultad : [2]));
  const abajo = MARGEN.abajo + (maxLineas - 2) * ALTO_LINEA;
  const ALTO = ALTO_BARRAS + (maxLineas - 2) * ALTO_LINEA;
  const util = ALTO - MARGEN.arriba - abajo;
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
          // **En dos líneas y horizontal, no en diagonal.** Él: «las etiquetas
          // del eje x pueden tener wrap y tener mayor contracción para que no
          // estén dispuestas de forma diagonal». Un nombre a 45° obliga a girar
          // la cabeza y además se comía 96 px de pie; partido cabe recto y deja
          // ese alto para las barras.
          const lineas = enDosLineas(f.facultad);
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
                  {/* **El porcentaje encima, del color de su barra.** Él: «mostrar
                      mejor los porcentajes de cada barra en su parte superior con
                      el color de su coloreado». Sin él hay que estimar a ojo
                      dónde cae el relleno dentro del hueco de la meta, que es
                      justo la comparación que el gráfico existe para dar. */}
                  {meta > 0 ? (
                    <text
                      x={x0 + dx + BARRA / 2} y={y(meta) - 5} textAnchor="middle"
                      className="aulas-metas-pct" data-sexo={tono}
                    >
                      {Math.round((100 * obtenidas) / meta)}%
                    </text>
                  ) : null}
                </g>
              ))}
              <text
                x={x0 + BARRA + HUECO / 2} y={ALTO - abajo + 14}
                textAnchor="middle" className="aulas-metas-etiqueta"
              >
                {lineas.map((linea, k) => (
                  <tspan key={linea} x={x0 + BARRA + HUECO / 2} dy={k === 0 ? 0 : 11}>{linea}</tspan>
                ))}
                <title>{f.facultad}</title>
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
