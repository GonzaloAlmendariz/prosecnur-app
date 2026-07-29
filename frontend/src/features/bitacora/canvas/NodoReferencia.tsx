import { memo } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Flag, Unlink } from "../../../vendor/lucide-react";

import type { BitacoraResumenDestino, CanvasNodo } from "../../../api/bitacora";
import { identidadDeDestino } from "../identidadDeFase";
import { etiquetaTono } from "../logbook/gramatica";
import type { Ancla } from "./aristaPath";

/**
 * Nodo de referencia (ADR 0047).
 *
 * Es una VENTANA, no una copia. Guarda solo `{target_type, target_id}` y el
 * contenido se resuelve en cada render: editar el hito cambia lo que el nodo
 * muestra, sin que nadie tenga que sincronizar nada.
 *
 * Tres cosas puede apuntar, y las tres son "partes de la app" en el sentido de
 * Obsidian Canvas:
 *
 *   - Una PIEZA de la app: un módulo o una de sus secciones. Lleva su ícono y
 *     su color, y es un enlace: el nodo no describe el lugar, lleva a él.
 *   - Un HITO del cronograma, con su estado vivo.
 *   - Una ENTRADA de bitácora, con su tono y su recorte.
 *
 * Si el destino desapareció, se dice. Nunca queda en blanco: el ADR pide que
 * no haya referencias rotas silenciosas, y una tarjeta vacía es la forma más
 * silenciosa de todas.
 */
export const NodoReferencia = memo(
  function NodoReferencia({
    nodo,
    resumen,
    seleccionado,
    enfocado,
    registrarRef,
    onPointerDown,
    onAnclaPointerDown,
    onDesvincular,
  }: {
    nodo: CanvasNodo;
    resumen: BitacoraResumenDestino;
    seleccionado: boolean;
    enfocado: boolean;
    registrarRef: (id: string, el: HTMLDivElement | null) => void;
    onPointerDown: (event: React.PointerEvent, id: string) => void;
    onAnclaPointerDown: (event: React.PointerEvent, id: string, ancla: Ancla) => void;
    onDesvincular: (id: string) => void;
  }) {
    const ref = nodo.ref;
    const esPieza = ref?.target_type === "modulo";
    const identidad = esPieza ? identidadDeDestino(ref!.target_id) : null;
    const Icono = identidad?.icono ?? null;
    const huerfano = !esPieza && !resumen.existe;
    const esHito = ref?.target_type === "tarea";
    const estadoLegible = esHito ? resumen.estado : etiquetaTono(resumen.estado);

    return (
      <div
        ref={(el) => registrarRef(nodo.id, el)}
        className={`bcanvas-nodo is-referencia${seleccionado ? " is-seleccionado" : ""}${
          enfocado ? " is-enfocado" : ""
        }${huerfano ? " is-huerfano" : ""}`}
        data-nodo-id={nodo.id}
        style={{
          translate: `${nodo.x}px ${nodo.y}px`,
          width: nodo.w,
          height: nodo.h,
          zIndex: nodo.z,
          ...(identidad?.vars ?? {}),
        }}
        onPointerDown={(event) => onPointerDown(event, nodo.id)}
      >
        {huerfano ? (
          <div className="bcanvas-ref-huerfano">
            <Unlink size={14} aria-hidden="true" />
            <strong>El destino ya no existe</strong>
            {/* El título que tenía al insertarlo. Un uuid no le dice a nadie
                qué se perdió, y ese es justo el momento en que hace falta. */}
            <small>{nodo.text || ref?.target_id}</small>
            <button
              type="button"
              className="bit-boton-sutil"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => onDesvincular(nodo.id)}
            >
              Convertir en nota
            </button>
          </div>
        ) : esPieza && identidad?.modulo ? (
          <div className="bcanvas-ref-pieza">
            <span className="bcanvas-ref-sello" aria-hidden="true">
              {Icono ? <Icono size={16} /> : null}
            </span>
            <span className="bcanvas-ref-cuerpo">
              <strong>{identidad.etiquetaCorta}</strong>
              {/* El contexto, no el nombre completo: `etiquetaModulo` repetiría
                  el título en un módulo ("Monitoreo · Monitoreo") y se trunca
                  en una sección, que es cuando más falta hace leerlo. */}
              <small>{identidad.seccion ? identidad.modulo.shortLabel : "Módulo"}</small>
            </span>
            {/* El nodo no describe el lugar: lleva a él. Un mapa que no se
                puede recorrer es un dibujo. */}
            <Link
              to={identidad.href}
              className="bcanvas-ref-ir"
              onPointerDown={(event) => event.stopPropagation()}
              aria-label={`Ir a ${identidad.etiquetaModulo}`}
            >
              <ArrowUpRight size={13} />
            </Link>
          </div>
        ) : (
          <div className="bcanvas-ref-dato">
            <span className={`bcanvas-ref-tipo is-${ref?.target_type}`}>
              {ref?.target_type === "tarea" ? <Flag size={11} /> : null}
              <span>{esHito ? "Hito" : "Bitácora"}</span>
              {/* En un hito el chip es el estado; en una entrada, el tono. Los
                  dos responden «cómo está esto», que es lo que se busca al
                  mirar un mapa de reojo. */}
              {estadoLegible && <em className={esHito ? "" : `is-tono-${resumen.estado}`}>{estadoLegible}</em>}
            </span>
            <strong>{resumen.titulo || "Sin título"}</strong>
            {resumen.detalle && <p>{resumen.detalle}</p>}
            {resumen.fecha && <small>{resumen.fecha}</small>}
          </div>
        )}

        {(seleccionado || enfocado) && (
          <span className="bcanvas-anclas" aria-hidden="true">
            {(["t", "r", "b", "l"] as const).map((ancla) => (
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
    a.resumen === b.resumen &&
    a.seleccionado === b.seleccionado &&
    a.enfocado === b.enfocado,
);
