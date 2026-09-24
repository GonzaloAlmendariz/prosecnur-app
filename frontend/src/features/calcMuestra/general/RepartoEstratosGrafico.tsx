import { useId, useState, type FocusEvent, type KeyboardEvent, type MouseEvent } from "react";

import { fmtDec, fmtInt, fmtPct } from "../sharedCore";
import { tip, tipAria, useTooltipGrafico } from "../universidad/shared/graficos/TooltipGrafico";
import { formatearPi } from "./modelo";
import {
  dibujarReparto,
  resumenReparto,
  tooltipDeFila,
  type EscalaReparto,
  type FilaReparto,
  type OrigenReparto,
} from "./repartoEstratos";
import "../universidad/shared/tablas.css";
import "./mesa.css";

const ESCALAS: ReadonlyArray<{ id: EscalaReparto; etiqueta: string }> = [
  { id: "tamano", etiqueta: "Tamaño" },
  { id: "fraccion", etiqueta: "Fracción" },
];

/**
 * Reparto de la muestra por estrato (o por actor): barras horizontales con el
 * N de cada fila y, encima, lo que se le lleva. SVG propio y sin Plotly.
 *
 * Accesible por tres caminos: el gráfico es un grupo con un resumen en
 * `aria-label`; cada barra se alcanza con Tab, lleva sus cifras como nombre y
 * abre el mismo tooltip que el mouse (Escape o salir del foco lo cierra); y los
 * datos exactos están en una tabla —visible en la ficha de la corrida, o en el
 * desplegable «Ver como tabla» aquí—. El tooltip nunca es el único lugar de
 * una cifra.
 */
export function RepartoEstratosGrafico({
  titulo,
  filas,
  origen,
  tablaAlternativa = true,
}: {
  titulo: string;
  filas: readonly FilaReparto[];
  origen: OrigenReparto;
  /** `false` cuando la superficie ya muestra la tabla con estos datos. */
  tablaAlternativa?: boolean;
}) {
  const id = useId();
  const [escala, setEscala] = useState<EscalaReparto>("tamano");
  const { manejadores, tooltip } = useTooltipGrafico();
  // El foco abre el tooltip por el mismo camino que el mouse: se le pasa la
  // barra enfocada y un punto bajo ella, así no hay un segundo tooltip.
  const abrirEnFoco = (evento: FocusEvent<HTMLDivElement>) => {
    const barra = evento.currentTarget;
    const caja = barra.getBoundingClientRect();
    const puntero: Pick<MouseEvent<HTMLElement>, "target" | "clientX" | "clientY"> = {
      target: barra,
      clientX: caja.left + Math.min(caja.width / 2, 240),
      clientY: caja.bottom,
    };
    manejadores.onMouseMove(puntero as MouseEvent<HTMLElement>);
  };
  const cerrarConEscape = (evento: KeyboardEvent<HTMLDivElement>) => {
    if (evento.key === "Escape") manejadores.onMouseLeave();
  };
  const dibujo = dibujarReparto(filas, escala);
  const conCompletas = filas.some((f) => f.n != null);
  const conCampo = filas.some((f) => f.nCampo != null);
  const esActores = origen === "actores";
  const tituloId = `${id}-titulo`;

  return (
    <figure className="cmg-reparto" aria-labelledby={tituloId}>
      <figcaption className="cmg-reparto-head">
        <h4 id={tituloId} className="cmg-reparto-titulo">{titulo}</h4>
        <ul className="cmg-reparto-leyenda" aria-label="Leyenda">
          <li data-serie="N">{esActores ? "N del marco" : "N del estrato"}</li>
          {conCampo && <li data-serie="campo">{origen === "corrida" ? "n sorteado" : "n a campo"}</li>}
          {conCompletas && <li data-serie="n">n completas</li>}
        </ul>
        <fieldset className="cmg-reparto-escala">
          <legend className="pulso-sr-only">Escala de las barras</legend>
          {ESCALAS.map((e) => (
            <label key={e.id} className="cmg-reparto-escala-opcion">
              <input
                type="radio"
                name={`${id}-escala`}
                value={e.id}
                checked={escala === e.id}
                onChange={() => setEscala(e.id)}
              />
              <span>{e.etiqueta}</span>
            </label>
          ))}
        </fieldset>
      </figcaption>

      <div
        className="cmg-reparto-grafico"
        role="group"
        aria-label={resumenReparto(filas, origen)}
        data-escala={escala}
        {...manejadores}
      >
        <div
          className="cmg-reparto-filas"
          data-qa-geometry-group="calc-muestra/general-reparto"
          data-qa-geometry-contract="equal"
        >
          {dibujo.map((f) => {
            const datos = tooltipDeFila(f, origen);
            return (
              <div
                key={f.clave}
                className="cmg-reparto-fila"
                data-qa-geometry-member
                role="img"
                aria-label={tipAria(datos)}
                tabIndex={0}
                onFocus={abrirEnFoco}
                onBlur={manejadores.onMouseLeave}
                onKeyDown={cerrarConEscape}
                {...tip(datos)}
              >
                <span className="cmg-reparto-nombre">
                  {f.etiqueta}
                  {f.nota ? <em>{f.nota}</em> : null}
                </span>
                <svg className="cmg-reparto-barra" width="100%" height="18" aria-hidden="true" focusable="false">
                  <rect className="cmg-reparto-rect" data-serie="N" x="0" y="2" width={`${f.anchoN}%`} height="14" rx="3" />
                  {f.anchoCampo != null && (
                    <rect className="cmg-reparto-rect" data-serie="campo" x="0" y="2" width={`${f.anchoCampo}%`} height="14" rx="3" />
                  )}
                  {f.anchoCompletas != null && (
                    <rect className="cmg-reparto-rect" data-serie="n" x="0" y="6" width={`${f.anchoCompletas}%`} height="6" rx="2" />
                  )}
                </svg>
                <span className="cmg-reparto-cifra">
                  {fmtInt(f.nCampo ?? f.n)}
                  <em> de {fmtInt(f.N)}</em>
                </span>
                <span className="cmg-reparto-pi">
                  {esActores
                    ? fmtPct(f.pi)
                    : f.pi != null ? <>π {formatearPi(f.pi)}</> : "π por unidad"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      {tooltip}

      {tablaAlternativa && (
        <details className="cmg-reparto-tabla">
          <summary>Ver como tabla</summary>
          <table className="cmv2-tabla">
            <caption className="pulso-sr-only">{titulo}</caption>
            <thead>
              <tr>
                <th scope="col">{esActores ? "Actor" : "Estrato"}</th>
                <th scope="col" className="cmv2-num">N</th>
                {conCompletas && <th scope="col" className="cmv2-num">n completas</th>}
                {conCampo && <th scope="col" className="cmv2-num">n a campo</th>}
                <th scope="col" className="cmv2-num">{esActores ? "Fracción" : "π"}</th>
                {!esActores && <th scope="col" className="cmv2-num">Peso base</th>}
              </tr>
            </thead>
            <tbody>
              {dibujo.map((f) => (
                <tr key={f.clave}>
                  <th scope="row">{f.etiqueta}</th>
                  <td className="cmv2-num">{fmtInt(f.N)}</td>
                  {conCompletas && <td className="cmv2-num">{fmtInt(f.n)}</td>}
                  {conCampo && <td className="cmv2-num">{fmtInt(f.nCampo)}</td>}
                  <td className="cmv2-num">{esActores ? fmtPct(f.pi) : formatearPi(f.pi)}</td>
                  {!esActores && <td className="cmv2-num">{f.peso != null ? fmtDec(f.peso, 2) : "—"}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </figure>
  );
}
