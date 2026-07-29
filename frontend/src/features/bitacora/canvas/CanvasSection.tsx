import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Link2,
  Maximize2,
  Network,
  Plus,
  Redo2,
  Sparkles,
  Trash2,
  Undo2,
} from "../../../vendor/lucide-react";

import {
  apiBitacoraCanvasBorrar,
  apiBitacoraCanvasCrear,
  type BitacoraEstado,
  type CanvasLienzo,
} from "../../../api/bitacora";
import { Alert } from "../../../components/Alert";
import { toast } from "../../../components/toasterStore";
import { CAMARA_INICIAL, type Camara } from "../../../lib/lienzo/camara";
import {
  ordenDeLectura,
  siguienteEnDireccion,
  siguienteEnOrden,
  type Caja,
} from "../../../lib/lienzo/seleccion";
import { posicionLibre } from "../../../lib/lienzo/rejilla";
import { anclasAutomaticas } from "./aristaPath";
import { escribiendoEnCampo, resolverAtajo } from "./atajos";
import { NodoReferencia } from "./NodoReferencia";
import { resumenVivo } from "./resumenVivo";
import { disponerRamificacion } from "./ramificacion";
import { ExploradorDeReferencias, type ReferenciaElegida } from "./ExploradorDeReferencias";
import { LienzoViewport, type ApiViewport } from "./LienzoViewport";
import { useCanvasAutosave } from "./useCanvasAutosave";
import { useCanvasStore } from "./store";
import "./canvas.css";

/**
 * Cuarta sección de Bitácora: el lienzo (ADR 0047).
 *
 * Lo que aporta sobre el cronograma es la RAMIFICACIÓN. El cronograma es lineal
 * —seis etapas, una detrás de otra— pero un estudio real se bifurca: dos
 * actores con campos distintos, un entregable que depende de dos análisis. Esa
 * forma no entra en una línea de tiempo.
 */
export function CanvasSection({
  estado,
  onEstado,
}: {
  estado: BitacoraEstado;
  onEstado: (siguiente: BitacoraEstado) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [camara, setCamara] = useState<Camara>(CAMARA_INICIAL);
  const [armandoConexion, setArmandoConexion] = useState(false);
  const [eligiendoReferencia, setEligiendoReferencia] = useState(false);
  const apiRef = useRef<ApiViewport | null>(null);

  const lienzo = useMemo<CanvasLienzo | null>(() => {
    const activo = estado.canvas.active_canvas_id;
    return estado.canvas.canvases.find((c) => c.id === activo) ?? estado.canvas.canvases[0] ?? null;
  }, [estado.canvas]);

  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const seleccion = useCanvasStore((s) => s.seleccion);
  const enfocado = useCanvasStore((s) => s.enfocado);
  const editando = useCanvasStore((s) => s.editando);
  const puedeDeshacer = useCanvasStore((s) => s.past.length > 0);
  const puedeRehacer = useCanvasStore((s) => s.future.length > 0);
  const store = useCanvasStore;

  useEffect(() => {
    if (lienzo) {
      useCanvasStore.getState().hidratar(lienzo);
      setCamara(lienzo.viewport);
    }
  }, [lienzo?.id]);

  useCanvasAutosave(lienzo, camara);

  const cajas = useMemo(() => {
    const m = new Map<string, Caja>();
    for (const n of nodes) m.set(n.id, { x: n.x, y: n.y, w: n.w, h: n.h });
    return m;
  }, [nodes]);

  const crearNodo = useCallback(
    (cerca?: { x: number; y: number }) => {
      const s = store.getState();
      // Nace donde el usuario está mirando. Un nodo creado en un punto fijo
      // del mundo aparece fuera de pantalla en cuanto hay algo de paneo, y se
      // lee como que el botón no hizo nada.
      const ancla = cerca ?? apiRef.current?.centroMundo() ?? { x: 80, y: 80 };
      const p = posicionLibre(ancla, { w: 220, h: 120 }, [...cajas.values()]);
      const id = `nodo-${Date.now()}`;
      s.setNodes([
        ...s.nodes,
        { id, type: "texto", x: p.x, y: p.y, w: 220, h: 120, z: 0, color: "neutro", text: "", ref: null, links: [] },
      ]);
      s.enfocar(id);
      s.seleccionar(new Set([id]));
      // Se entra directo a escribir: crear un nodo y tener que dar otro clic
      // para poder teclear es un paso de más en el gesto más frecuente.
      s.editar(id);
    },
    [cajas, store],
  );

  const insertarReferencias = useCallback(
    (refs: ReferenciaElegida[]) => {
      const s = store.getState();
      const origen = apiRef.current?.centroMundo() ?? { x: 80, y: 80 };
      // El layout y las aristas los decide `ramificacion.ts`: es la lógica que
      // convierte varias piezas sueltas en un árbol legible, y se prueba aparte.
      const { nodes, edges } = disponerRamificacion(refs, origen, String(Date.now()));
      if (!nodes.length) return;
      // Una sola posición libre para el bloque entero: buscarla por nodo los
      // desparramaría y perdería la disposición jerárquica que se acaba de
      // calcular.
      const caja = cajaDe(nodes);
      const libre = posicionLibre(
        { x: caja.x, y: caja.y },
        { w: caja.w, h: caja.h },
        [...cajas.values()],
      );
      const dx = libre.x - caja.x;
      const dy = libre.y - caja.y;
      const colocados = nodes.map((n) => ({ ...n, x: n.x + dx, y: n.y + dy }));

      s.setNodes([...s.nodes, ...colocados]);
      if (edges.length) s.setEdges([...s.edges, ...edges]);
      s.enfocar(colocados[0].id);
      s.seleccionar(new Set(colocados.map((n) => n.id)));
      setEligiendoReferencia(false);
      toast.exito(
        colocados.length === 1 ? "Pieza en el lienzo" : `${colocados.length} piezas en el lienzo`,
        edges.length ? { detalle: `${edges.length} ${edges.length === 1 ? "conexión trazada" : "conexiones trazadas"}.` } : undefined,
      );
    },
    [cajas, store],
  );

  /** Un destino que desapareció se convierte en nota, sin perder su lugar. */
  const convertirEnNota = useCallback(
    (id: string) => {
      const s = store.getState();
      s.setNodes(
        s.nodes.map((n) =>
          n.id === id
            ? { ...n, type: "texto" as const, ref: null, text: n.text || "Referencia perdida" }
            : n,
        ),
      );
    },
    [store],
  );

  const borrarSeleccion = useCallback(() => {
    const s = store.getState();
    const ids = s.seleccion.size > 0 ? s.seleccion : new Set(s.enfocado ? [s.enfocado] : []);
    if (ids.size === 0) return;
    // Las aristas de un nodo borrado se van con él: dejarlas produciría
    // trazados hacia la nada.
    s.setNodes(s.nodes.filter((n) => !ids.has(n.id)));
    s.setEdges(s.edges.filter((a) => !ids.has(a.from_node) && !ids.has(a.to_node)));
    s.seleccionar(new Set());
    s.enfocar(null);
  }, [store]);

  // --- Teclado --------------------------------------------------------------

  useEffect(() => {
    function alTeclear(event: KeyboardEvent) {
      if (escribiendoEnCampo(event.target) && !editando) return;
      const accion = resolverAtajo(event, {
        editando: editando !== null,
        hayFoco: enfocado !== null,
        armandoConexion,
      });
      if (!accion) return;
      event.preventDefault();
      const s = store.getState();

      switch (accion.tipo) {
        case "nuevo": {
          const base = enfocado ? cajas.get(enfocado) : undefined;
          crearNodo(base ? { x: base.x + base.w + 32, y: base.y } : undefined);
          break;
        }
        case "editar":
          if (enfocado) s.editar(enfocado);
          break;
        case "salir":
          s.editar(null);
          setArmandoConexion(false);
          break;
        case "borrar":
          borrarSeleccion();
          break;
        case "deshacer":
          s.undo();
          break;
        case "rehacer":
          s.redo();
          break;
        case "foco": {
          const siguiente = siguienteEnOrden(ordenDeLectura(cajas), enfocado, accion.paso);
          s.enfocar(siguiente);
          if (siguiente) s.seleccionar(new Set([siguiente]));
          break;
        }
        case "navegar": {
          if (!enfocado) break;
          const destino = siguienteEnDireccion(cajas, enfocado, accion.direccion);
          if (destino) {
            s.enfocar(destino);
            s.seleccionar(new Set([destino]));
          }
          break;
        }
        case "mover": {
          if (s.seleccion.size === 0) break;
          s.setNodes(
            s.nodes.map((n) =>
              s.seleccion.has(n.id) ? { ...n, x: n.x + accion.dx, y: n.y + accion.dy } : n,
            ),
          );
          break;
        }
        case "conectar": {
          if (!enfocado) break;
          if (!armandoConexion) {
            setArmandoConexion(true);
            break;
          }
          const destino = siguienteEnDireccion(cajas, enfocado, accion.direccion);
          setArmandoConexion(false);
          if (!destino) break;
          if (s.edges.some((a) => a.from_node === enfocado && a.to_node === destino)) break;
          const cd = cajas.get(enfocado);
          const ch = cajas.get(destino);
          const anclas = cd && ch ? anclasAutomaticas(cd, ch) : { from: "r" as const, to: "l" as const };
          s.setEdges([
            ...s.edges,
            {
              id: `arista-${Date.now()}`,
              from_node: enfocado,
              from_anchor: anclas.from,
              to_node: destino,
              to_anchor: anclas.to,
              label: "",
              relation: "menciona",
            },
          ]);
          break;
        }
        case "seleccionar-todo":
          s.seleccionar(new Set(nodes.map((n) => n.id)));
          break;
        case "ir-a-contenido":
          apiRef.current?.irAContenido();
          break;
        case "zoom-100":
          setCamara((c) => ({ ...c, zoom: 1 }));
          break;
      }
    }
    document.addEventListener("keydown", alTeclear);
    return () => document.removeEventListener("keydown", alTeclear);
  }, [cajas, enfocado, editando, armandoConexion, nodes, crearNodo, borrarSeleccion, store]);

  async function mutar(fn: () => Promise<BitacoraEstado>, exito?: string) {
    setError(null);
    try {
      onEstado(await fn());
      if (exito) toast.exito(exito);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo completar la acción en el lienzo.");
    }
  }

  if (!lienzo) {
    return (
      <div className="bcanvas-vacio" data-audit-ready="bitacora-canvas-vacio">
        <Network size={34} aria-hidden="true" />
        <strong>Arma el mapa del estudio</strong>
        <p>
          El cronograma va en línea recta. Un estudio real se bifurca: dos actores
          con campos distintos, una base que se procesa dos veces, un entregable
          que depende de dos análisis. Acá conectas esas piezas como realmente son.
        </p>
        {error && <Alert kind="error">{error}</Alert>}
        <button
          type="button"
          className="bit-boton bit-boton--primario"
          onClick={() => void mutar(() => apiBitacoraCanvasCrear("Mapa del estudio"), "Lienzo creado")}
        >
          <Sparkles size={15} />
          <span>Crear el primer lienzo</span>
        </button>
      </div>
    );
  }

  return (
    <div className="bcanvas" data-audit-ready="bitacora-canvas">
      <div className="bcanvas-barra">
        <div
          className="bcanvas-lienzos"
          role="tablist"
          aria-label="Lienzos del proyecto"
          data-gliding-opt-out="El índice de lienzos es un selector de documento, no el recorrido del módulo: su indicador es el borde de la pestaña activa y la lista crece con cada lienzo, así que una píldora deslizante señalaría el archivo abierto en vez de la posición dentro de un recorrido fijo."
        >
          {estado.canvas.canvases.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={c.id === lienzo.id}
              className={`bcanvas-lienzo-tab${c.id === lienzo.id ? " is-activo" : ""}`}
              onClick={() =>
                void mutar(async () => {
                  const siguiente = { ...estado };
                  siguiente.canvas = { ...estado.canvas, active_canvas_id: c.id };
                  return siguiente;
                })
              }
            >
              {c.title}
              {/* El lienzo ACTIVO cuenta desde el store: el del servidor va un
                  autosave por detrás y mostraría 0 justo después de crear tres
                  nodos, que es cuando el contador más se mira. */}
              <small>{c.id === lienzo.id ? nodes.length : c.nodes.length}</small>
            </button>
          ))}
          <button
            type="button"
            className="bcanvas-lienzo-nuevo"
            onClick={() => void mutar(() => apiBitacoraCanvasCrear(), "Lienzo creado")}
            aria-label="Nuevo lienzo"
          >
            <Plus size={14} />
          </button>
        </div>

        <div className="bcanvas-acciones">
          <button type="button" onClick={() => crearNodo()} title="Nodo nuevo (N)">
            <Plus size={14} />
            <span>Nodo</span>
          </button>
          <button
            type="button"
            onClick={() => setEligiendoReferencia((v) => !v)}
            aria-expanded={eligiendoReferencia}
            title="Referenciar una parte de la app, un hito o una entrada"
          >
            <Link2 size={14} />
            <span>Referencia</span>
          </button>
          <button
            type="button"
            onClick={() => store.getState().undo()}
            disabled={!puedeDeshacer}
            title="Deshacer (Cmd+Z)"
            aria-label="Deshacer"
          >
            <Undo2 size={14} />
          </button>
          <button
            type="button"
            onClick={() => store.getState().redo()}
            disabled={!puedeRehacer}
            title="Rehacer (Cmd+Shift+Z)"
            aria-label="Rehacer"
          >
            <Redo2 size={14} />
          </button>
          <button
            type="button"
            onClick={() => apiRef.current?.irAContenido()}
            title="Volver al contenido (Cmd+0)"
            aria-label="Volver al contenido"
          >
            <Maximize2 size={14} />
          </button>
          <button
            type="button"
            onClick={borrarSeleccion}
            disabled={seleccion.size === 0 && !enfocado}
            title="Borrar lo seleccionado (Supr)"
            aria-label="Borrar lo seleccionado"
          >
            <Trash2 size={14} />
          </button>
          {estado.canvas.canvases.length > 1 && (
            <button
              type="button"
              onClick={() => void mutar(() => apiBitacoraCanvasBorrar(lienzo.id), "Lienzo borrado")}
              title="Borrar este lienzo"
            >
              <span>Borrar lienzo</span>
            </button>
          )}
        </div>
      </div>

      {error && <Alert kind="error">{error}</Alert>}

      {armandoConexion && (
        <p className="bcanvas-pista" role="status">
          Elige una flecha para conectar con el nodo de esa dirección. Escape cancela.
        </p>
      )}

      <div className="bcanvas-tablero">
        {eligiendoReferencia && (
          <ExploradorDeReferencias
            estado={estado}
            onElegir={insertarReferencias}
            onCerrar={() => setEligiendoReferencia(false)}
          />
        )}

        <LienzoViewport
          nodes={nodes}
          edges={edges}
          camaraInicial={camara}
          onCamara={setCamara}
          onNodos={(n) => store.getState().setNodes(n)}
          onAristas={(e) => store.getState().setEdges(e)}
          registrarApi={(api) => {
            apiRef.current = api;
          }}
          renderNodo={(nodo, handlers) => (
            <NodoReferencia
              key={nodo.id}
              nodo={nodo}
              // Se resuelve contra el estado en memoria en cada render: por eso
              // editar el hito cambia lo que el nodo muestra, y por eso un nodo
              // recién insertado no se lee como huérfano.
              resumen={resumenVivo(estado, nodo.ref)}
              onDesvincular={convertirEnNota}
              {...handlers}
            />
          )}
        />
      </div>

      {/* Región viva para lectores de pantalla: en un lienzo espacial, sin esto
          navegar por teclado no anuncia nada. */}
      <span className="pulso-sr-only" role="status" aria-live="polite">
        {enfocado
          ? `Nodo enfocado: ${nodes.find((n) => n.id === enfocado)?.text || "sin texto"}`
          : `${nodes.length} nodos, ${edges.length} conexiones`}
      </span>
    </div>
  );
}

/** Caja envolvente de un grupo de nodos, para colocarlo como un bloque. */
function cajaDe(nodes: { x: number; y: number; w: number; h: number }[]) {
  const x = Math.min(...nodes.map((n) => n.x));
  const y = Math.min(...nodes.map((n) => n.y));
  return {
    x,
    y,
    w: Math.max(...nodes.map((n) => n.x + n.w)) - x,
    h: Math.max(...nodes.map((n) => n.y + n.h)) - y,
  };
}
