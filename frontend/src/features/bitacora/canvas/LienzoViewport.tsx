import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { CanvasArista, CanvasNodo } from "../../../api/bitacora";
import {
  ajustarAContenido,
  cajaContenedora,
  panear,
  pantallaAMundo,
  resolverGestoRueda,
  transformDeCamara,
  zoomEn,
  type Camara,
} from "../../../lib/lienzo/camara";
import { ajustarAGrilla } from "../../../lib/lienzo/rejilla";
import {
  alternarSeleccion,
  aplicarArrastre,
  esArrastre,
  normalizarRect,
  seleccionEnRectangulo,
  type Caja,
} from "../../../lib/lienzo/seleccion";
import { anclasAutomaticas, pathDeArista, pathFantasma, type Ancla } from "./aristaPath";
import { NodoCard } from "./NodoCard";
import { useCanvasStore } from "./store";

export type ApiViewport = {
  irAContenido: () => void;
  camaraActual: () => Camara;
  /** Punto de mundo en el centro de lo que se está viendo. */
  centroMundo: () => { x: number; y: number };
};

/** Lo que el viewport presta a un render alternativo de nodo. */
export type HandlersNodo = {
  seleccionado: boolean;
  enfocado: boolean;
  registrarRef: (id: string, el: HTMLDivElement | null) => void;
  onPointerDown: (event: React.PointerEvent, id: string) => void;
  onAnclaPointerDown: (event: React.PointerEvent, id: string, ancla: Ancla) => void;
};

/**
 * Viewport del lienzo (ADR 0047).
 *
 * Arquitectura: DOM con `translate` para los nodos y UN SOLO `<svg>` para
 * todas las aristas. El objetivo es 200 nodos y 300 aristas fluidos, y para
 * llegar ahí hay tres reglas que se sostienen en todo el archivo:
 *
 *   1. LA CÁMARA NO RE-RENDERIZA REACT. Pan y zoom escriben directamente sobre
 *      `worldRef.current.style.transform` dentro de un `requestAnimationFrame`
 *      y solo hacen commit a estado al terminar el gesto. `LogicCanvas` llama
 *      `setPan` en cada `mousemove`: eso es una reconciliación completa a 60 Hz.
 *
 *   2. EL ARRASTRE ESCRIBE SOLO SOBRE LOS NODOS ARRASTRADOS, vía un mapa de
 *      refs. Los otros 197 nodos no se tocan.
 *
 *   3. LAS ARISTAS SE ACTUALIZAN CON `setAttribute` sobre los paths tocados, en
 *      el mismo frame. 300 `setAttribute` no cuestan nada; 300 re-renders sí.
 */
export function LienzoViewport({
  nodes,
  edges,
  camaraInicial,
  onCamara,
  onNodos,
  onAristas,
  registrarApi,
  renderNodo,
}: {
  nodes: CanvasNodo[];
  edges: CanvasArista[];
  camaraInicial: Camara;
  onCamara: (camara: Camara) => void;
  onNodos: (nodes: CanvasNodo[]) => void;
  onAristas: (edges: CanvasArista[]) => void;
  registrarApi?: (api: ApiViewport) => void;
  /**
   * Render alternativo para un nodo. El viewport entrega SUS handlers: el
   * llamador decide qué se ve, no cómo se interactúa. Sin esto, un nodo de
   * referencia no se podría arrastrar ni conectar.
   */
  renderNodo?: (nodo: CanvasNodo, handlers: HandlersNodo) => React.ReactNode;
}) {
  const seleccion = useCanvasStore((s) => s.seleccion);
  const enfocado = useCanvasStore((s) => s.enfocado);
  const editando = useCanvasStore((s) => s.editando);
  const seleccionar = useCanvasStore((s) => s.seleccionar);
  const enfocar = useCanvasStore((s) => s.enfocar);
  const editar = useCanvasStore((s) => s.editar);
  const marcarHistorial = useCanvasStore((s) => s.marcarHistorial);
  const moverEnVivo = useCanvasStore((s) => s.moverEnVivo);

  const viewportRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const nodosRef = useRef(new Map<string, HTMLDivElement>());
  const pathsRef = useRef(new Map<string, SVGPathElement>());
  const camaraRef = useRef<Camara>(camaraInicial);
  const rafRef = useRef<number | null>(null);

  const [marco, setMarco] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [fantasma, setFantasma] = useState<{ desde: string; ancla: Ancla; cursor: { x: number; y: number } } | null>(null);

  const cajas = useMemo(() => {
    const m = new Map<string, Caja>();
    for (const n of nodes) m.set(n.id, { x: n.x, y: n.y, w: n.w, h: n.h });
    return m;
  }, [nodes]);

  /** Aristas que tocan cada nodo. Durante un arrastre solo se recalculan esas. */
  const aristasPorNodo = useMemo(() => {
    const m = new Map<string, CanvasArista[]>();
    for (const a of edges) {
      for (const id of [a.from_node, a.to_node]) {
        const lista = m.get(id);
        if (lista) lista.push(a);
        else m.set(id, [a]);
      }
    }
    return m;
  }, [edges]);

  const registrarRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) nodosRef.current.set(id, el);
    else nodosRef.current.delete(id);
  }, []);

  // --- Cámara ---------------------------------------------------------------

  const pintarCamara = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      if (worldRef.current) {
        worldRef.current.style.transform = transformDeCamara(camaraRef.current);
      }
    });
  }, []);

  useEffect(() => {
    camaraRef.current = camaraInicial;
    pintarCamara();
    // Solo al cambiar de lienzo: durante los gestos la cámara vive en la ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camaraInicial.x, camaraInicial.y, camaraInicial.zoom]);

  const irAContenido = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const caja = cajaContenedora([...cajas.values()]);
    camaraRef.current = ajustarAContenido(caja, { w: el.clientWidth, h: el.clientHeight });
    pintarCamara();
    onCamara(camaraRef.current);
  }, [cajas, onCamara, pintarCamara]);

  useEffect(() => {
    registrarApi?.({
      irAContenido,
      camaraActual: () => camaraRef.current,
      centroMundo: () => {
        const el = viewportRef.current;
        if (!el) return { x: 0, y: 0 };
        return pantallaAMundo(
          { x: el.clientWidth / 2, y: el.clientHeight / 2 },
          camaraRef.current,
        );
      },
    });
  }, [registrarApi, irAContenido]);

  // `passive: false` porque hay que llamar `preventDefault`: sin eso, el pinch
  // hace zoom de la PÁGINA y el lienzo se queda quieto.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    function alRodar(event: WheelEvent) {
      event.preventDefault();
      const gesto = resolverGestoRueda(event);
      if (gesto.tipo === "pan") {
        camaraRef.current = panear(camaraRef.current, gesto.dx, gesto.dy);
      } else {
        const rect = el!.getBoundingClientRect();
        camaraRef.current = zoomEn(camaraRef.current, gesto.factor, {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        });
      }
      pintarCamara();
    }
    el.addEventListener("wheel", alRodar, { passive: false });
    return () => el.removeEventListener("wheel", alRodar);
  }, [pintarCamara]);

  // --- Gestos ---------------------------------------------------------------

  const gestoRef = useRef<
    | { tipo: "pan"; x: number; y: number; camara: Camara }
    | { tipo: "arrastre"; x: number; y: number; iniciales: Map<string, { x: number; y: number }>; movio: boolean }
    | { tipo: "marco"; origen: { x: number; y: number }; previa: Set<string> }
    | { tipo: "conectar"; desde: string; ancla: Ancla }
    | null
  >(null);

  function puntoMundo(event: { clientX: number; clientY: number }) {
    const rect = viewportRef.current!.getBoundingClientRect();
    return pantallaAMundo(
      { x: event.clientX - rect.left, y: event.clientY - rect.top },
      camaraRef.current,
    );
  }

  /** Reposiciona en el DOM los nodos movidos y las aristas que los tocan. */
  function pintarArrastre(posiciones: Map<string, { x: number; y: number }>) {
    for (const [id, p] of posiciones) {
      const el = nodosRef.current.get(id);
      if (el) el.style.translate = `${p.x}px ${p.y}px`;
    }
    const tocadas = new Set<CanvasArista>();
    for (const id of posiciones.keys()) {
      for (const a of aristasPorNodo.get(id) ?? []) tocadas.add(a);
    }
    for (const a of tocadas) {
      const path = pathsRef.current.get(a.id);
      if (!path) continue;
      const desde = posiciones.get(a.from_node) ?? cajas.get(a.from_node);
      const hasta = posiciones.get(a.to_node) ?? cajas.get(a.to_node);
      const cd = cajas.get(a.from_node);
      const ch = cajas.get(a.to_node);
      if (!desde || !hasta || !cd || !ch) continue;
      path.setAttribute(
        "d",
        pathDeArista(
          { ...cd, x: desde.x, y: desde.y },
          { ...ch, x: hasta.x, y: hasta.y },
          a.from_anchor,
          a.to_anchor,
        ),
      );
    }
  }

  function alBajarEnFondo(event: React.PointerEvent) {
    if (event.button !== 0) return;
    viewportRef.current?.focus();
    editar(null);
    const p = puntoMundo(event);
    // Shift arrastra un marco de selección; sin modificador, el fondo panea.
    if (event.shiftKey) {
      gestoRef.current = { tipo: "marco", origen: p, previa: new Set(seleccion) };
      setMarco({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
    } else {
      gestoRef.current = { tipo: "pan", x: event.clientX, y: event.clientY, camara: camaraRef.current };
      seleccionar(new Set());
    }
    (event.target as Element).setPointerCapture?.(event.pointerId);
  }

  function alBajarEnNodo(event: React.PointerEvent, id: string) {
    if (event.button !== 0) return;
    event.stopPropagation();
    viewportRef.current?.focus();
    const siguiente = alternarSeleccion(seleccion, id, event.shiftKey || event.metaKey);
    seleccionar(siguiente);
    enfocar(id);

    // El punto de deshacer se marca UNA vez, al empezar el gesto. Marcarlo por
    // movimiento llenaría el historial con cientos de pasos de un solo drag.
    marcarHistorial();
    const iniciales = new Map<string, { x: number; y: number }>();
    for (const nid of siguiente) {
      const caja = cajas.get(nid);
      if (caja) iniciales.set(nid, { x: caja.x, y: caja.y });
    }
    gestoRef.current = { tipo: "arrastre", x: event.clientX, y: event.clientY, iniciales, movio: false };
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
  }

  function alMover(event: React.PointerEvent) {
    const gesto = gestoRef.current;
    if (!gesto) return;

    if (gesto.tipo === "pan") {
      camaraRef.current = {
        ...gesto.camara,
        x: gesto.camara.x + (event.clientX - gesto.x),
        y: gesto.camara.y + (event.clientY - gesto.y),
      };
      pintarCamara();
      return;
    }

    if (gesto.tipo === "arrastre") {
      const dx = (event.clientX - gesto.x) / camaraRef.current.zoom;
      const dy = (event.clientY - gesto.y) / camaraRef.current.zoom;
      if (!gesto.movio && !esArrastre(dx, dy)) return;
      gesto.movio = true;
      pintarArrastre(aplicarArrastre(gesto.iniciales, dx, dy, (v) => ajustarAGrilla(v)));
      return;
    }

    if (gesto.tipo === "marco") {
      const p = puntoMundo(event);
      setMarco({ x0: gesto.origen.x, y0: gesto.origen.y, x1: p.x, y1: p.y });
      return;
    }

    if (gesto.tipo === "conectar") {
      setFantasma({ desde: gesto.desde, ancla: gesto.ancla, cursor: puntoMundo(event) });
    }
  }

  function alSoltar(event: React.PointerEvent) {
    const gesto = gestoRef.current;
    gestoRef.current = null;

    if (gesto?.tipo === "pan") {
      onCamara(camaraRef.current);
    }

    if (gesto?.tipo === "arrastre" && gesto.movio) {
      const dx = (event.clientX - gesto.x) / camaraRef.current.zoom;
      const dy = (event.clientY - gesto.y) / camaraRef.current.zoom;
      // Un solo commit a estado al soltar. Durante el gesto solo se tocó el DOM.
      moverEnVivo(aplicarArrastre(gesto.iniciales, dx, dy, (v) => ajustarAGrilla(v)));
    }

    if (gesto?.tipo === "marco" && marco) {
      const rect = normalizarRect({ x: marco.x0, y: marco.y0 }, { x: marco.x1, y: marco.y1 });
      seleccionar(seleccionEnRectangulo(cajas, rect, gesto.previa));
    }
    setMarco(null);

    if (gesto?.tipo === "conectar") {
      const destino = nodoBajoElCursor(event);
      if (destino && destino !== gesto.desde) {
        const yaExiste = edges.some(
          (a) => a.from_node === gesto.desde && a.to_node === destino,
        );
        if (!yaExiste) {
          const cd = cajas.get(gesto.desde);
          const ch = cajas.get(destino);
          const anclas = cd && ch ? anclasAutomaticas(cd, ch) : { from: gesto.ancla, to: "l" as Ancla };
          onAristas([
            ...edges,
            {
              id: `arista-${Date.now()}-${destino}`,
              from_node: gesto.desde,
              from_anchor: anclas.from,
              to_node: destino,
              to_anchor: anclas.to,
              label: "",
              relation: "menciona",
            },
          ]);
        }
      }
      setFantasma(null);
    }
  }

  function nodoBajoElCursor(event: { clientX: number; clientY: number }): string | null {
    const el = document.elementFromPoint(event.clientX, event.clientY);
    const nodo = el?.closest("[data-nodo-id]") as HTMLElement | null;
    return nodo?.getAttribute("data-nodo-id") ?? null;
  }

  function alDobleClic(event: React.MouseEvent) {
    if ((event.target as Element).closest("[data-nodo-id]")) return;
    const p = puntoMundo(event);
    onNodos([
      ...nodes,
      {
        id: `nodo-${Date.now()}`,
        type: "texto",
        x: ajustarAGrilla(p.x - 110),
        y: ajustarAGrilla(p.y - 60),
        w: 220,
        h: 120,
        z: 0,
        color: "neutro",
        text: "",
        ref: null,
        links: [],
      },
    ]);
  }

  const marcoRect = marco ? normalizarRect({ x: marco.x0, y: marco.y0 }, { x: marco.x1, y: marco.y1 }) : null;

  return (
    <div
      ref={viewportRef}
      className="bcanvas-viewport"
      tabIndex={0}
      role="application"
      aria-label="Lienzo de notas"
      onPointerDown={alBajarEnFondo}
      onPointerMove={alMover}
      onPointerUp={alSoltar}
      onPointerCancel={alSoltar}
      onDoubleClick={alDobleClic}
    >
      <div ref={worldRef} className="bcanvas-world" style={{ transform: transformDeCamara(camaraInicial) }}>
        <svg className="bcanvas-aristas" aria-hidden="true">
          {edges.map((a) => {
            const desde = cajas.get(a.from_node);
            const hasta = cajas.get(a.to_node);
            if (!desde || !hasta) return null;
            return (
              <path
                key={a.id}
                ref={(el) => {
                  if (el) pathsRef.current.set(a.id, el);
                  else pathsRef.current.delete(a.id);
                }}
                className="bcanvas-arista"
                d={pathDeArista(desde, hasta, a.from_anchor, a.to_anchor)}
              />
            );
          })}
          {fantasma && cajas.get(fantasma.desde) && (
            <path
              className="bcanvas-arista is-fantasma"
              d={pathFantasma(cajas.get(fantasma.desde)!, fantasma.ancla, fantasma.cursor)}
            />
          )}
        </svg>

        {nodes.map((nodo) =>
          // Un nodo de referencia lo pinta el llamador: necesita el mapa de
          // resúmenes vivos, que es del payload y no del viewport. Pero la
          // interacción sigue siendo del viewport, así que va prestada.
          (nodo.type === "referencia"
            ? renderNodo?.(nodo, {
                seleccionado: seleccion.has(nodo.id),
                enfocado: enfocado === nodo.id,
                registrarRef,
                onPointerDown: alBajarEnNodo,
                onAnclaPointerDown: (event, id, ancla) => {
                  gestoRef.current = { tipo: "conectar", desde: id, ancla };
                  setFantasma({ desde: id, ancla, cursor: puntoMundo(event) });
                },
              })
            : null) ?? (
            <NodoCard
              key={nodo.id}
              nodo={nodo}
              seleccionado={seleccion.has(nodo.id)}
              enfocado={enfocado === nodo.id}
              editando={editando === nodo.id}
              conectando={fantasma?.desde === nodo.id}
              registrarRef={registrarRef}
              onPointerDown={alBajarEnNodo}
              onAnclaPointerDown={(event, id, ancla) => {
                gestoRef.current = { tipo: "conectar", desde: id, ancla };
                setFantasma({ desde: id, ancla, cursor: puntoMundo(event) });
              }}
              onTexto={(id, texto) =>
                onNodos(nodes.map((n) => (n.id === id ? { ...n, text: texto } : n)))
              }
              onTerminarEdicion={() => editar(null)}
            />
          ),
        )}

        {marcoRect && (
          <div
            className="bcanvas-marco"
            style={{
              translate: `${marcoRect.x0}px ${marcoRect.y0}px`,
              width: marcoRect.x1 - marcoRect.x0,
              height: marcoRect.y1 - marcoRect.y0,
            }}
          />
        )}
      </div>
    </div>
  );
}
