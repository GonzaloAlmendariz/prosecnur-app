// =============================================================================
// outline/OutlineRow.tsx — fila de una pieza en la Estructura del Constructor
// =============================================================================
// Rediseño del Constructor (2026-10-17). La fila vive dentro del contenedor de su sección (ver
// SeccionEstructura): ya no lleva sangría propia ni existen filas de cierre. Se arrastra por el asa (AsaArrastre, la
// única pieza suscrita a dnd-kit); el arrastre lo orquesta SurveyOutline (hueco, filas que se corren y asentado).
//
// La ranura exterior (`data-linea`) es la caja de layout que se mide; la fila de adentro es la que se anima al
// correrse (FLIP), así medir nunca lee una posición a mitad de animación.
//
// Identidad «Señales»: el tipo como sello, el riel fijo de marcas al final y, si la pieza tiene avisos, un punto
// discreto sobre el sello (C22).
// =============================================================================

import { memo, useMemo } from "react";
import { ArrowDown, ArrowUp } from "../../../vendor/lucide-react";
import { AsaArrastre } from "./AsaArrastre";
import type { BuilderNode } from "../types";
import { stripMarkdown } from "../helpers/markdown";
import { TypeIcon } from "../kit/TypeIcon";
import { Riel } from "../kit/Riel";
import { marcasNodo } from "../kit/marcasNodo";
import { useContextoReglas } from "../kit/ContextoReglas";
import { tituloPlano } from "../kit/CuerpoPanelMarca";
import { typeLabel } from "../parsing/parseType";
import { previewKindLabel } from "../parsing/buildIndex";
import { BotonInsertar, type AbrirInsertar } from "./BotonInsertar";
import { PuntoAviso, type AvisoFila } from "./PuntoAviso";

export const ATAJOS_FILA = "Enter abre · Alt+↑ / Alt+↓ mueve · Insert o + agrega debajo";

export function tituloDe(node: BuilderNode): string {
  return stripMarkdown(node.label) || node.name || `fila_${node.rowIndex + 1}`;
}

export type OutlineRowProps = {
  node: BuilderNode;
  /** Apertura de la sección que la contiene (null = el formulario). */
  contenedor: number | null;
  active: boolean;
  /** Es lo que se está arrastrando: la fila se esconde y su lugar lo toma el hueco. */
  origen?: boolean;
  /** La fila que queda en el recorrido con Tab (las demás se alcanzan con las flechas). */
  enRecorrido: boolean;
  arrastrable: boolean;
  avisos?: readonly AvisoFila[];
  canMoveUp: boolean;
  canMoveDown: boolean;
  onElegir: (rowIndex: number) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onInsertar?: AbrirInsertar;
};

export const OutlineRow = memo(function OutlineRow({
  node,
  contenedor,
  active,
  origen,
  enRecorrido,
  arrastrable,
  avisos,
  canMoveUp,
  canMoveDown,
  onElegir,
  onMoveUp,
  onMoveDown,
  onInsertar,
}: OutlineRowProps) {
  const reglas = useContextoReglas();
  const requiredRaw = reglas?.requiredRaw(node.rowIndex);
  const marcas = useMemo(
    () => marcasNodo(node, reglas?.structure, requiredRaw),
    [node, reglas?.structure, requiredRaw],
  );
  const titulo = tituloDe(node);
  const tituloSinRefs = tituloPlano(titulo);

  return (
    <div className={origen ? "xfe-ranura is-origen" : "xfe-ranura"} data-linea={node.rowIndex}>
      <div
        className={`pulso-outline-row xfe-fila${active ? " is-active" : ""}`}
        data-outline-row={node.rowIndex}
        data-depth={node.depth}
      >
        <AsaArrastre id={node.rowIndex} arrastrable={arrastrable} titulo="Arrastra para mover · Alt+↑ / Alt+↓" etiqueta="Arrastra para mover" />

        <div
          role="button"
          tabIndex={enRecorrido ? 0 : -1}
          aria-current={active ? "true" : undefined}
          aria-keyshortcuts="Enter Alt+ArrowUp Alt+ArrowDown Insert"
          title={`${titulo}\n${ATAJOS_FILA}`}
          data-nav={node.rowIndex}
          onClick={() => onElegir(node.rowIndex)}
          className="pulso-outline-body"
        >
          <span className="pulso-outline-typeicon xfe-sello">
            <TypeIcon baseType={node.typeInfo.base} size={14} />
            {avisos?.length ? <PuntoAviso avisos={avisos} /> : null}
          </span>
          <span className="pulso-outline-text">
            <strong className="pulso-outline-title">{titulo}</strong>
            {/* El código va en su propio grupo: si no cabe entero en la línea, salta a una segunda línea que el
                subtítulo recorta. Se lee entero o no se ve, nunca un fragmento con «…». */}
            <span className="pulso-outline-subtitle pulso-outline-subtitle--codigo">
              <span className="pulso-outline-kind">
                {node.kind === "question" ? typeLabel(node.typeInfo.base) : previewKindLabel(node)}
              </span>
              {node.name && node.name !== stripMarkdown(node.label) ? (
                <span className="pulso-outline-codewrap">
                  <span aria-hidden="true">·</span>
                  <code className="pulso-outline-code">{node.name}</code>
                </span>
              ) : null}
            </span>
          </span>
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

        {/* El riel va al final para que su columna no se corra en la fila elegida (las flechas quedan antes). */}
        <Riel nodo={node} marcas={marcas} scope={reglas?.scope} className="pulso-outline-riel" tabIndex={enRecorrido ? undefined : -1} />
      </div>
      {onInsertar ? (
        <BotonInsertar
          destino={{ despuesDeFila: node.rowIndex, seccionFila: contenedor }}
          etiqueta={`Agregar debajo de «${tituloSinRefs}»`}
          onAbrir={onInsertar}
        />
      ) : null}
    </div>
  );
});
