import { memo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, Check, Flag, GitBranch, Link2, Plus, Unlink, X } from "../../../vendor/lucide-react";

import type { BitacoraResumenDestino, CanvasNodo } from "../../../api/bitacora";
import { identidadDeDestino } from "../identidadDeFase";
import { MAX_ITEMS_NODO } from "./ramificacion";
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
    onAgregarItem,
    onAlternarItem,
    onQuitarItem,
    onConectar,
    ramasLibres,
    ramificando,
    onRamificar,
    naciendo,
  }: {
    nodo: CanvasNodo;
    resumen: BitacoraResumenDestino;
    seleccionado: boolean;
    enfocado: boolean;
    registrarRef: (id: string, el: HTMLDivElement | null) => void;
    onPointerDown: (event: React.PointerEvent, id: string) => void;
    onAnclaPointerDown: (event: React.PointerEvent, id: string, ancla: Ancla) => void;
    onDesvincular: (id: string) => void;
    onAgregarItem: (id: string, texto: string) => void;
    onAlternarItem: (id: string, itemId: string) => void;
    onQuitarItem: (id: string, itemId: string) => void;
    onConectar: (id: string) => void;
    /** Cuántas ramas puede desplegar todavía. 0 oculta el botón. */
    ramasLibres: number;
    ramificando: boolean;
    onRamificar: (id: string) => void;
    /** Recién abierto desde un brote: lleva la animación de entrada. */
    naciendo: boolean;
  }) {
    const navegar = useNavigate();
    const [confirmando, setConfirmando] = useState(false);
    const [nuevoItem, setNuevoItem] = useState<string | null>(null);
    // Escape cierra el campo, y cerrarlo dispara `blur`, que confirmaría lo
    // escrito: cancelar terminaba agregando la anotación que se descartó. La
    // marca vive en una ref porque el `blur` lee el closure del render viejo.
    const canceladoRef = useRef(false);
    const ref = nodo.ref;
    const esPieza = ref?.target_type === "modulo";
    const identidad = esPieza ? identidadDeDestino(ref!.target_id) : null;
    const Icono = identidad?.icono ?? null;
    const huerfano = !esPieza && !resumen.existe;
    const esHito = ref?.target_type === "tarea";
    const contexto = caminoHasta(identidad?.etiquetaModulo ?? "");
    const estadoLegible = esHito ? resumen.estado : etiquetaTono(resumen.estado);

    return (
      <div
        ref={(el) => registrarRef(nodo.id, el)}
        className={`bcanvas-nodo is-referencia${seleccionado ? " is-seleccionado" : ""}${
          enfocado ? " is-enfocado" : ""
        }${huerfano ? " is-huerfano" : ""}${naciendo ? " is-naciendo" : ""}`}
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
              {/* El camino hasta la pieza, sin ella: «Monitoreo · Territorial»
                  bajo «Avance». Es lo que distingue dos secciones que se llaman
                  igual en modos distintos, y sin esto todos los niveles decían
                  «Módulo» —hasta los que no lo eran—. */}
              <small>{contexto}</small>
            </span>
            <span className="bcanvas-ref-acciones">
              {/* Conectar es el gesto PRINCIPAL de un cuadro: un mapa se arma
                  cableando piezas con las entradas que las explican. Antes solo
                  se podía arrastrando desde un ancla diminuta que aparecía al
                  seleccionar, o con un atajo — invisible para quien no lo sabe. */}
              <button
                type="button"
                className="bcanvas-ref-boton"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => onConectar(nodo.id)}
                title="Conectar con otro cuadro"
                aria-label={`Conectar ${identidad.etiquetaCorta} con otro cuadro`}
              >
                <Link2 size={13} />
              </button>
              {/* Ir PIDE CONFIRMACIÓN: navegar saca del lienzo, y un click de
                  más mientras se acomoda el mapa no puede costar el lugar donde
                  estabas. Es la acción destructiva de esta superficie. */}
              <button
                type="button"
                className="bcanvas-ref-boton"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => setConfirmando(true)}
                aria-expanded={confirmando}
                title={`Ir a ${identidad.etiquetaModulo}`}
                aria-label={`Ir a ${identidad.etiquetaModulo}`}
              >
                <ArrowUpRight size={13} />
              </button>
            </span>
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

        {/* Ramificar en el propio lienzo: el cuadro sabe qué cuelga de él
            —el árbol vive en `lib/modules.ts`—, así que no hay razón para
            volver al explorador, buscar la pieza otra vez y reinsertarla. */}
        {ramasLibres > 0 && (
          <button
            type="button"
            className={`bcanvas-ref-boton bcanvas-ref-ramificar${ramificando ? " is-abierto" : ""}`}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => onRamificar(nodo.id)}
            aria-expanded={ramificando}
            title={`Desplegar ${ramasLibres} ${ramasLibres === 1 ? "rama" : "ramas"}`}
            aria-label={`Desplegar las ramas de ${identidad?.etiquetaCorta ?? "este cuadro"}`}
          >
            <GitBranch size={13} />
            <em>{ramasLibres}</em>
          </button>
        )}

        {confirmando && (
          <div className="bcanvas-ref-confirmar" role="alertdialog" aria-label="Salir del lienzo">
            <span>Salir del lienzo e ir a {identidad?.etiquetaModulo}?</span>
            <span className="bcanvas-ref-confirmar-botones">
              <button
                type="button"
                className="is-primario"
                autoFocus
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => navegar(identidad?.href ?? "")}
              >
                Ir
              </button>
              <button
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => setConfirmando(false)}
              >
                Quedarme
              </button>
            </span>
          </div>
        )}

        {/* Anotaciones del cuadro. Van bajo el resumen y separadas de él: lo de
            arriba lo resuelve la app y cambia solo; esto lo escribió el usuario
            sobre ESTE mapa y no lo toca nadie más. */}
        {(nodo.items.length > 0 || nuevoItem !== null) && (
          <ul className="bcanvas-ref-items">
            {nodo.items.map((item) => (
              <li key={item.id} className={item.done ? "is-hecho" : undefined}>
                <button
                  type="button"
                  className="bcanvas-ref-item-marca"
                  role="checkbox"
                  aria-checked={item.done}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => onAlternarItem(nodo.id, item.id)}
                >
                  {item.done ? <Check size={10} /> : null}
                </button>
                <span>{item.text}</span>
                <button
                  type="button"
                  className="bcanvas-ref-item-quitar"
                  aria-label={`Quitar ${item.text}`}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => onQuitarItem(nodo.id, item.id)}
                >
                  <X size={10} />
                </button>
              </li>
            ))}
            {nuevoItem !== null && (
              <li className="is-nuevo">
                <input
                  autoFocus
                  value={nuevoItem}
                  placeholder="Qué anotas sobre esto"
                  onPointerDown={(event) => event.stopPropagation()}
                  onChange={(event) => setNuevoItem(event.target.value)}
                  onBlur={() => {
                    if (canceladoRef.current) {
                      canceladoRef.current = false;
                      return;
                    }
                    if (nuevoItem.trim()) onAgregarItem(nodo.id, nuevoItem.trim());
                    setNuevoItem(null);
                  }}
                  onKeyDown={(event) => {
                    // El lienzo escucha teclas sueltas: sin esto, escribir
                    // «nota» crea nodos mientras se anota.
                    event.stopPropagation();
                    if (event.key === "Escape") {
                      canceladoRef.current = true;
                      setNuevoItem(null);
                    }
                    if (event.key === "Enter") {
                      if (nuevoItem.trim()) onAgregarItem(nodo.id, nuevoItem.trim());
                      // Se queda abierto: anotar dos cosas seguidas es lo normal.
                      setNuevoItem("");
                    }
                  }}
                />
              </li>
            )}
          </ul>
        )}

        {/* Siempre visible, no solo al seleccionar: su espacio ya está
            reservado en el alto, así que esconderlo deja un hueco mudo y la
            capacidad de anotar queda sin descubrir. Atenuado hasta el hover. */}
        {nuevoItem === null && nodo.items.length < MAX_ITEMS_NODO && (
          <button
            type="button"
            className="bcanvas-ref-anadir"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => setNuevoItem("")}
          >
            <Plus size={11} />
            <span>Anotar</span>
          </button>
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
    a.enfocado === b.enfocado &&
    a.ramasLibres === b.ramasLibres &&
    a.ramificando === b.ramificando &&
    a.naciendo === b.naciendo,
);

/**
 * El camino de una pieza sin su último tramo. `etiquetaModulo` viene como
 * «Monitoreo · Territorial · Avance» y el nodo ya muestra «Avance» de título:
 * el subtítulo es lo que distingue dos secciones que se llaman igual en modos
 * distintos.
 */
function caminoHasta(ruta: string): string {
  const tramos = (ruta ?? "").split(" · ");
  return tramos.length > 1 ? tramos.slice(0, -1).join(" · ") : "Módulo";
}
