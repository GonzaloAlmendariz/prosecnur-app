import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent } from "react";

import { fmtDec, fmtInt, fmtPct } from "../sharedCore";
import { tip, tipAria, useTooltipGrafico } from "../universidad/shared/graficos/TooltipGrafico";
import { formatearPi } from "./modelo";
import {
  anchosPrevios,
  desdeReescala,
  dibujarReparto,
  resumenReparto,
  sostenerTooltipEnFoco,
  tooltipDeFila,
  type EscalaReparto,
  type FilaReparto,
  type OrigenReparto,
} from "./repartoEstratos";
import { useEntradaPorCambio } from "./useEntradaPorCambio";
import "../universidad/shared/tablas.css";
import "./mesa.css";
import "./movimiento.css";

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
 * abre el mismo tooltip que el mouse (Escape o salir del foco lo cierra; el
 * scroll que provoca el foco no); y los
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
  const { onMouseMove, onMouseLeave } = manejadores;
  const filasRef = useRef<HTMLDivElement | null>(null);
  // Escape cierra el tooltip sin mover el foco: un scroll posterior no debe
  // reabrirlo hasta que el foco vuelva a entrar a una barra.
  const cerradoConEscape = useRef(false);
  // El foco abre el tooltip por el mismo camino que el mouse: se le pasa la
  // barra enfocada y un punto bajo ella, así no hay un segundo tooltip.
  const abrirSobre = useCallback(
    (barra: HTMLElement) => {
      const caja = barra.getBoundingClientRect();
      const puntero: Pick<MouseEvent<HTMLElement>, "target" | "clientX" | "clientY"> = {
        target: barra,
        clientX: caja.left + Math.min(caja.width / 2, 240),
        clientY: caja.bottom,
      };
      onMouseMove(puntero as MouseEvent<HTMLElement>);
    },
    [onMouseMove],
  );
  // El foco desplaza el dueño de scroll para mostrar la barra y el tooltip
  // compartido se cierra en todo scroll: mientras la barra tenga el foco, se
  // reabre sobre su geometría nueva (D1).
  useEffect(
    () =>
      sostenerTooltipEnFoco<HTMLElement>({
        objetivo: window,
        enfocada: () => {
          const activo = document.activeElement;
          if (cerradoConEscape.current || !(activo instanceof HTMLElement)) return null;
          return activo.classList.contains("cmg-reparto-fila") && filasRef.current?.contains(activo) ? activo : null;
        },
        reabrir: abrirSobre,
        frame: {
          pedir: (fn) => window.requestAnimationFrame(fn),
          cancelar: (idFrame) => window.cancelAnimationFrame(idFrame),
        },
      }),
    [abrirSobre],
  );
  const cerrarConEscape = (evento: KeyboardEvent<HTMLDivElement>) => {
    if (evento.key !== "Escape") return;
    cerradoConEscape.current = true;
    onMouseLeave();
  };
  const dibujo = dibujarReparto(filas, escala);
  // Al montar, las barras crecen escalonadas; al cambiar Tamaño↔Fracción,
  // cada una cruza desde su ancho anterior (E16 · M3). El `width` es siempre
  // el dato: la animación sólo declara de dónde viene.
  const fase = useEntradaPorCambio(escala);
  const previos = fase === "montaje" ? null : anchosPrevios(filas, escala);
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
        data-reescala={fase === "montaje" ? undefined : fase}
        {...manejadores}
      >
        <div
          ref={filasRef}
          className="cmg-reparto-filas"
          data-qa-geometry-group="calc-muestra/general-reparto"
          data-qa-geometry-contract="equal"
        >
          {dibujo.map((f, fila) => {
            const datos = tooltipDeFila(f, origen);
            const antes = previos?.get(f.clave);
            const desde = (anterior: number | null | undefined, actual: number | null): CSSProperties | undefined =>
              antes ? ({ "--cmg-desde": desdeReescala(anterior ?? null, actual) } as CSSProperties) : undefined;
            return (
              <div
                key={f.clave}
                className="cmg-reparto-fila"
                style={{ "--cmg-fila": fila } as CSSProperties}
                data-qa-geometry-member
                role="img"
                aria-label={tipAria(datos)}
                tabIndex={0}
                onFocus={(evento) => {
                  cerradoConEscape.current = false;
                  abrirSobre(evento.currentTarget);
                }}
                onBlur={onMouseLeave}
                onKeyDown={cerrarConEscape}
                {...tip(datos)}
              >
                <span className="cmg-reparto-nombre">
                  {f.etiqueta}
                  {f.nota ? <em>{f.nota}</em> : null}
                </span>
                <svg className="cmg-reparto-barra" width="100%" height="18" aria-hidden="true" focusable="false">
                  <rect className="cmg-reparto-rect" data-serie="N" x="0" y="2" width={`${f.anchoN}%`} height="14" rx="3" style={desde(antes?.anchoN, f.anchoN)} />
                  {f.anchoCampo != null && (
                    <rect className="cmg-reparto-rect" data-serie="campo" x="0" y="2" width={`${f.anchoCampo}%`} height="14" rx="3" style={desde(antes?.anchoCampo, f.anchoCampo)} />
                  )}
                  {f.anchoCompletas != null && (
                    <rect className="cmg-reparto-rect" data-serie="n" x="0" y="6" width={`${f.anchoCompletas}%`} height="6" rx="2" style={desde(antes?.anchoCompletas, f.anchoCompletas)} />
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
