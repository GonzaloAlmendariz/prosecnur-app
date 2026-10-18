// =============================================================================
// outline/SeccionEstructura.tsx — una sección o repetición como contenedor de la Estructura
// =============================================================================
// Rediseño del Constructor (2026-10-17, C2 y C14). La sección es un contenedor con borde lateral y sus piezas
// adentro; su cierre es ese borde, no una fila. La cabecera se ELIGE (abre la ficha de la sección con el `onSelect`
// de siempre) y el chevrón sólo pliega. Si la sección tiene condición propia, la cabecera la marca.
//
// Mover el cierre sigue disponible desde la sección elegida: el pie ofrece «Incluir la siguiente» y «Sacar la
// última» (los mismos `moveSectionBoundary` de la página).
// =============================================================================

import { useId, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronDown } from "../../../vendor/lucide-react";
import { AsaArrastre } from "./AsaArrastre";
import type { BuilderNode } from "../types";
import { TypeIcon } from "../kit/TypeIcon";
import { GlifoMarca } from "../kit/GlifoMarca";
import { tituloPlano } from "../kit/CuerpoPanelMarca";
import { BotonInsertar, type AbrirInsertar } from "./BotonInsertar";
import { PuntoAviso, type AvisoFila } from "./PuntoAviso";
import { ATAJOS_FILA, tituloDe } from "./OutlineRow";

export type LimiteSeccion = {
  puedeIncluir: boolean;
  puedeSacar: boolean;
  onIncluirSiguiente: () => void;
  onSacarUltima: () => void;
};

export type SeccionEstructuraProps = {
  node: BuilderNode;
  contenedor: number | null;
  conteo: number;
  abierta: boolean;
  active: boolean;
  enRecorrido: boolean;
  arrastrable: boolean;
  /** Es lo que se está arrastrando: el contenedor se esconde y su lugar lo toma el hueco. */
  origen: boolean;
  avisos?: readonly AvisoFila[];
  canMoveUp: boolean;
  canMoveDown: boolean;
  limite?: LimiteSeccion;
  onElegir: (rowIndex: number) => void;
  onPlegar: (rowIndex: number) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onInsertar?: AbrirInsertar;
  children: ReactNode;
};

export function SeccionEstructura({
  node,
  contenedor,
  conteo,
  abierta,
  active,
  enRecorrido,
  arrastrable,
  origen,
  avisos,
  canMoveUp,
  canMoveDown,
  limite,
  onElegir,
  onPlegar,
  onMoveUp,
  onMoveDown,
  onInsertar,
  children,
}: SeccionEstructuraProps) {
  const idHijos = useId();
  const titulo = tituloDe(node);
  const tituloSinRefs = tituloPlano(titulo);
  const repite = node.kind === "repeat";
  const nombreTipo = repite ? "repetición" : "sección";
  const conCondicion = node.relevant.trim() !== "";

  return (
    <div
      className={`xfe-seccion${repite ? " is-repeat" : ""}${abierta ? "" : " is-plegada"}${origen ? " is-origen" : ""}${active ? " is-active" : ""}`}
      data-seccion={node.rowIndex}
    >
      <div className="xfe-ranura" data-linea={node.rowIndex}>
        <div
          className={`pulso-outline-row xfe-sec-cab pulso-outline-row--${node.kind}${active ? " is-active" : ""}`}
          data-outline-row={node.rowIndex}
          data-depth={node.depth}
        >
          <AsaArrastre
            id={node.rowIndex}
            arrastrable={arrastrable}
            titulo={`Arrastra para mover la ${nombreTipo} entera · Alt+↑ / Alt+↓`}
            etiqueta={`Arrastra para mover la ${nombreTipo}`}
          />
          <button
            type="button"
            className="xfe-chev"
            tabIndex={-1}
            aria-label={`${abierta ? "Plegar" : "Desplegar"} «${tituloSinRefs}»`}
            title={abierta ? "Plegar · ←" : "Desplegar · →"}
            onClick={(e) => {
              e.stopPropagation();
              onPlegar(node.rowIndex);
            }}
          >
            <ChevronDown size={13} strokeWidth={2.4} aria-hidden="true" />
          </button>
          <div
            role="button"
            tabIndex={enRecorrido ? 0 : -1}
            aria-current={active ? "true" : undefined}
            // El estado plegado va en lo que recibe el foco (el chevrón queda fuera del recorrido con Tab).
            aria-expanded={abierta}
            aria-controls={idHijos}
            aria-keyshortcuts="Enter ArrowLeft ArrowRight Alt+ArrowUp Alt+ArrowDown Insert"
            title={`${titulo}\n${ATAJOS_FILA} · ← → pliega`}
            data-nav={node.rowIndex}
            onClick={() => onElegir(node.rowIndex)}
            className="pulso-outline-body xfe-sec-cab__cuerpo"
          >
            <span className="pulso-outline-typeicon xfe-sello">
              <TypeIcon baseType={node.typeInfo.base} size={14} />
              {avisos?.length ? <PuntoAviso avisos={avisos} /> : null}
            </span>
            <strong className="pulso-outline-title xfe-sec-cab__titulo">{titulo}</strong>
            {conCondicion ? (
              <span
                className="xfe-sec-cond"
                role="img"
                aria-label={`La ${nombreTipo} tiene condición`}
                title={`Con condición: ${node.relevant.trim()}`}
              >
                <GlifoMarca clave="cond" size={11} />
              </span>
            ) : null}
            <small className="xfe-sec-cab__conteo" aria-label={`${conteo} ${conteo === 1 ? "pieza" : "piezas"}`}>
              {conteo}
            </small>
          </div>
          {active && (
            <span className="pulso-outline-actions">
              <button
                type="button"
                className="pulso-icon"
                disabled={!canMoveUp}
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveUp();
                }}
                title="Mover arriba · Alt+↑"
                aria-label="Mover arriba"
              >
                <ArrowUp size={13} />
              </button>
              <button
                type="button"
                className="pulso-icon"
                disabled={!canMoveDown}
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveDown();
                }}
                title="Mover abajo · Alt+↓"
                aria-label="Mover abajo"
              >
                <ArrowDown size={13} />
              </button>
            </span>
          )}
        </div>
        {onInsertar ? (
          <BotonInsertar
            destino={abierta ? { despuesDeFila: null, seccionFila: node.rowIndex } : { despuesDeFila: node.rowIndex, seccionFila: contenedor }}
            etiqueta={abierta ? `Agregar al inicio de «${tituloSinRefs}»` : `Agregar después de «${tituloSinRefs}»`}
            onAbrir={onInsertar}
          />
        ) : null}
      </div>
      <div
        className="xfe-seccion__hijos"
        id={idHijos}
        role="group"
        aria-label={`Contenido de «${tituloSinRefs}»`}
        hidden={!abierta}
        data-qa-geometry-group="xlsform/estructura-seccion"
        data-qa-geometry-contract="intrinsic"
      >
        {children}
      </div>
      {abierta && (active && limite ? (
        <div className="xfe-seccion__limite">
          <button type="button" disabled={!limite.puedeSacar} onClick={limite.onSacarUltima} title="La última pieza queda fuera, después de la sección">
            Sacar la última
          </button>
          <button type="button" disabled={!limite.puedeIncluir} onClick={limite.onIncluirSiguiente} title="La pieza que sigue a la sección pasa adentro">
            Incluir la siguiente
          </button>
        </div>
      ) : null)}
      {abierta && onInsertar ? (
        <div className="xfe-seccion__pie">
          <BotonInsertar
            destino={{ despuesDeFila: node.rowIndex, seccionFila: contenedor }}
            etiqueta={`Agregar después de «${tituloSinRefs}»`}
            onAbrir={onInsertar}
          />
        </div>
      ) : null}
    </div>
  );
}
