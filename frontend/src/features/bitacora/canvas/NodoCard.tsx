import { memo, useEffect, useRef } from "react";

import type { CanvasNodo } from "../../../api/bitacora";
import type { Ancla } from "./aristaPath";

const ANCLAS: readonly Ancla[] = ["t", "r", "b", "l"];

/**
 * Un nodo del lienzo.
 *
 * `memo` con comparador explícito: con 200 nodos en pantalla, re-renderizar
 * todos porque uno se movió es la diferencia entre fluido y no. Solo se
 * compara lo que afecta al render.
 *
 * DOM y no SVG a propósito. `LogicCanvas` dibuja sus nodos como `<g>` y eso
 * cuesta por nodo; además un `<g>` no recibe foco ni entra en el orden de
 * tabulación, y este lienzo tiene que operarse sin ratón.
 */
export const NodoCard = memo(
  function NodoCard({
    nodo,
    seleccionado,
    enfocado,
    editando,
    conectando,
    registrarRef,
    onPointerDown,
    onAnclaPointerDown,
    onTexto,
    onTerminarEdicion,
  }: {
    nodo: CanvasNodo;
    seleccionado: boolean;
    enfocado: boolean;
    editando: boolean;
    conectando: boolean;
    registrarRef: (id: string, el: HTMLDivElement | null) => void;
    onPointerDown: (event: React.PointerEvent, id: string) => void;
    onAnclaPointerDown: (event: React.PointerEvent, id: string, ancla: Ancla) => void;
    onTexto: (id: string, texto: string) => void;
    onTerminarEdicion: () => void;
  }) {
    const textoRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
      if (editando) textoRef.current?.focus();
    }, [editando]);

    return (
      <div
        ref={(el) => registrarRef(nodo.id, el)}
        className={`bcanvas-nodo is-${nodo.type} color-${nodo.color}${
          seleccionado ? " is-seleccionado" : ""
        }${enfocado ? " is-enfocado" : ""}${conectando ? " is-conectando" : ""}`}
        data-nodo-id={nodo.id}
        style={{
          // `translate` y no `left/top`: lo compone la GPU y no fuerza layout,
          // que es lo que permite arrastrar sin recalcular la página.
          translate: `${nodo.x}px ${nodo.y}px`,
          width: nodo.w,
          height: nodo.h,
          zIndex: nodo.z,
        }}
        onPointerDown={(event) => onPointerDown(event, nodo.id)}
      >
        {editando ? (
          <textarea
            ref={textoRef}
            className="bcanvas-nodo-editor"
            value={nodo.text}
            aria-label="Texto del nodo"
            onChange={(event) => onTexto(nodo.id, event.target.value)}
            onBlur={onTerminarEdicion}
            onKeyDown={(event) => {
              // Escape sale de la edición sin propagar: si subiera, el lienzo
              // interpretaría "deseleccionar" y se perdería el nodo de vista.
              if (event.key === "Escape") {
                event.stopPropagation();
                onTerminarEdicion();
              }
              event.stopPropagation();
            }}
            onPointerDown={(event) => event.stopPropagation()}
          />
        ) : (
          <div className="bcanvas-nodo-texto">{nodo.text || <span className="bcanvas-nodo-vacio">Doble clic para escribir</span>}</div>
        )}

        {/* Los anclajes solo aparecen con el nodo activo: cuatro puntos por
            nodo, con 200 nodos, serían 800 objetivos de clic compitiendo. */}
        {(seleccionado || enfocado) && nodo.type !== "grupo" && (
          <span className="bcanvas-anclas" aria-hidden="true">
            {ANCLAS.map((ancla) => (
              <span
                key={ancla}
                className={`bcanvas-ancla is-${ancla}`}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  onAnclaPointerDown(event, nodo.id, ancla);
                }}
              />
            ))}
          </span>
        )}
      </div>
    );
  },
  (a, b) =>
    a.nodo === b.nodo &&
    a.seleccionado === b.seleccionado &&
    a.enfocado === b.enfocado &&
    a.editando === b.editando &&
    a.conectando === b.conectando,
);
