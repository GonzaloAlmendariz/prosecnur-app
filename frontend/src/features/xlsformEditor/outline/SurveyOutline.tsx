// =============================================================================
// outline/SurveyOutline.tsx — la Estructura del Constructor
// =============================================================================
// Rediseño del Constructor (2026-10-17, propuesta aprobada en dos columnas). Orquesta:
//   - el árbol: secciones y repeticiones como contenedores con sus piezas adentro (RamaEstructura);
//   - buscar y filtrar con «N de M» y la jerarquía de los resultados (BarraEstructura, C21);
//   - el arrastre (C2): dnd-kit pone los sensores; el destino es un hueco que se abre donde caerá, las demás
//     líneas se corren con FLIP, el fantasma se levanta sin giro y se asienta al soltar. Sin animación si el
//     sistema pide movimiento reducido;
//   - el teclado (C20): flechas recorren, Enter abre, ← → pliegan, Alt+↑ ↓ mueven y + agrega;
//   - el «+» entre líneas (C18) con el menú de tipos de siempre (AddElementMenu);
//   - el punto de aviso en la fila (C22).
// El estado efímero (plegadas, búsqueda) vive en storeEstructura; el workbook, en la página.
// =============================================================================

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Layers3, Settings2 } from "../../../vendor/lucide-react";
import { EmptyState } from "../../../components/States";
import type { BuilderNode, BuilderSelection, BuilderStructure } from "../types";
import { CabeceraRiel } from "../kit/CabeceraRiel";
import { tituloPlano } from "../kit/CuerpoPanelMarca";
import { useContextoReglas } from "../kit/ContextoReglas";
import { marcasNodo } from "../kit/marcasNodo";
import { AddElementMenu } from "../shell/AddElementMenu";
import { countFieldsInOutline } from "../shell/editorMetrics";
import { estadoLista } from "../parsing/diagnostics";
import type { DestinoInsercion } from "../state/accionesConstructor";
import type { RowMovePlan } from "./outlineUtils";
import { BarraEstructura } from "./BarraEstructura";
import { BotonInsertar } from "./BotonInsertar";
import { crearFantasma, type Fantasma } from "./fantasma";
import {
  FILTROS_RAPIDOS,
  construirArbol,
  filtrarArbol,
  huecoEntre,
  lineaVecina,
  lineasVisibles,
  planMoverA,
  siguienteBajoPunteroEn,
  textoDestino,
  type FiltroRapido,
  type HechosFila,
  type Hueco,
  type Linea,
} from "./modeloEstructura";
import { tituloDe } from "./OutlineRow";
import type { AvisoFila } from "./PuntoAviso";
import { ContextoEstructura, RamaEstructura, type ArrastreEstructura, type ValorEstructura } from "./RamaEstructura";
import type { LimiteSeccion } from "./SeccionEstructura";
import { clavePlegado, estadoDe, useEstructuraStore } from "./storeEstructura";
import { itemsInsertar } from "./tiposInsertables";
import { useFlip } from "./useFlip";
import "./estructura.css";

export type { AvisoFila } from "./PuntoAviso";
export type { LimiteSeccion } from "./SeccionEstructura";

export type SurveyOutlineProps = {
  structure: BuilderStructure | null;
  selection: BuilderSelection | null;
  onSelect: (value: BuilderSelection) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  /** Aplica un arrastre concreto al workbook. */
  onApplyMove: (plan: RowMovePlan) => void;
  /** Avisos por fila, armados por la página desde los diagnósticos (contrato con la ficha: no cambiar la forma). */
  avisosPorFila?: ReadonlyMap<number, { nivel: "error" | "warn"; titulo: string }[]>;
  /** Inserta una pieza en el lugar del «+». */
  onInsertar?: (destino: { despuesDeFila: number | null; seccionFila: number | null }, baseType: string) => void;
  /** Mueve una fila cualquiera un lugar (Alt+↑ / Alt+↓). Sin esto, el teclado mueve sólo la fila elegida. */
  onMoverFila?: (rowIndex: number, direccion: "up" | "down") => void;
  /** Mover el cierre de la sección elegida («Incluir la siguiente» / «Sacar la última»). */
  limiteSeccion?: LimiteSeccion;
  /** Formulario abierto: plegado, búsqueda y filtro son de un formulario y vuelven a cero al abrir otro. */
  formularioId?: string | null;
  /** Acción extra al final de la barra de búsqueda (ver BarraEstructura). */
  accionBarra?: ReactNode;
};

const MARGEN_AUTOSCROLL = 44;
const SIN_AUTOSCROLL = { enabled: false, layoutShiftCompensation: false } as const;

type Insertando = { destino: DestinoInsercion; ancla: HTMLElement };

export function SurveyOutline({
  structure,
  selection,
  onSelect,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  onApplyMove,
  avisosPorFila,
  onInsertar,
  onMoverFila,
  limiteSeccion,
  formularioId = null,
  accionBarra,
}: SurveyOutlineProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [arrastre, setArrastre] = useState<ArrastreEstructura | null>(null);
  const [insertando, setInsertando] = useState<Insertando | null>(null);
  const store = useEstructuraStore();
  const { alternarPlegada, fijarPlegada, plegarTodas, desplegarTodas, setConsulta, setFiltro, limpiarBusqueda, abrirFormulario } = store;
  const { plegadas, consulta, filtro } = estadoDe(store, formularioId);
  useLayoutEffect(() => abrirFormulario(formularioId), [abrirFormulario, formularioId]);
  const reglas = useContextoReglas();
  const flip = useFlip(scrollRef);

  // ---------------------------------------------------------------------------
  // Árbol, filtro y líneas visibles
  // ---------------------------------------------------------------------------

  const arbol = useMemo(() => construirArbol(structure), [structure]);

  const hechos = useMemo(() => {
    // Misma lectura que los diagnósticos (estadoLista): una lista existe si choices le da alguna opción.
    const catalogos = reglas?.scope?.catalogsByListName;
    const conocidas = catalogos && catalogos.size > 0 ? { has: (n: string) => (catalogos.get(n)?.items.length ?? 0) > 0 } : null;
    const cache = new Map<number, HechosFila>();
    return (nodo: BuilderNode): HechosFila => {
      const previo = cache.get(nodo.rowIndex);
      if (previo) return previo;
      const lista = estadoLista(nodo, conocidas);
      const h: HechosFila = {
        cond: nodo.relevant.trim() !== "",
        oblig: marcasNodo(nodo, null, reglas?.requiredRaw(nodo.rowIndex)).oblig !== null,
        regla: nodo.constraint.trim() !== "",
        sinLista: lista === "sin-lista" || lista === "sin-catalogo",
        aviso: !!avisosPorFila?.get(nodo.rowIndex)?.length,
      };
      cache.set(nodo.rowIndex, h);
      return h;
    };
  }, [reglas, avisosPorFila]);

  // Lo que cuenta como pregunta es lo mismo que cuenta el subtítulo de la Estructura (countFieldsInOutline: sin
  // notas, metadatos ni el «_other» de una pregunta que ya está): «N de M» y el subtítulo dicen el mismo M.
  const cuenta = useMemo(() => {
    const nodos = structure?.outline ?? [];
    const nombres = new Set(nodos.map((n) => n.name).filter(Boolean));
    const contados = new Set<number>();
    for (const n of nodos) {
      if (countFieldsInOutline([n]) !== 1) continue;
      const padre = n.name.endsWith("_other") ? n.name.slice(0, -"_other".length) : "";
      if (padre && nombres.has(padre)) continue;
      contados.add(n.rowIndex);
    }
    return (n: BuilderNode) => contados.has(n.rowIndex);
  }, [structure]);

  const conteos = useMemo(() => {
    const out = {} as Record<FiltroRapido, number>;
    for (const f of FILTROS_RAPIDOS) out[f.id] = filtrarArbol(arbol, { consulta: "", filtro: f.id }, hechos, tituloDe, cuenta).coinciden;
    return out;
  }, [arbol, hechos, cuenta]);

  const resultado = useMemo(
    () => filtrarArbol(arbol, { consulta, filtro }, hechos, tituloDe, cuenta),
    [arbol, consulta, filtro, hechos, cuenta],
  );
  const filtrando = resultado.activo;

  const plegada = useCallback(
    (fila: number) => {
      if (filtrando) return false;
      const n = structure?.byRow.get(fila);
      return n ? plegadas.has(clavePlegado(n.name, fila)) : false;
    },
    [filtrando, plegadas, structure],
  );

  const lineas = useMemo(() => lineasVisibles(resultado.arbol, plegada), [resultado.arbol, plegada]);

  // Al cambiar la búsqueda o el filtro, la lista vuelve arriba: el primer resultado no queda escondido bajo la
  // cabecera con el scroll de la lista anterior (M4).
  const criterioPrevio = useRef(`${consulta}\u0000${filtro}`);
  useLayoutEffect(() => {
    const clave = `${consulta}\u0000${filtro}`;
    if (criterioPrevio.current === clave) return;
    criterioPrevio.current = clave;
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [consulta, filtro]);
  const clavesSecciones = useMemo(
    () => (structure?.outline ?? []).filter((n) => n.kind === "section" || n.kind === "repeat").map((n) => clavePlegado(n.name, n.rowIndex)),
    [structure],
  );

  // ---------------------------------------------------------------------------
  // Selección: visible, desplegada y con el foco si la movió el teclado
  // ---------------------------------------------------------------------------

  const selectedRow = selection?.kind === "survey" ? selection.rowIndex : null;
  const focoTrasMover = useRef(false);

  useEffect(() => {
    if (selectedRow == null || !structure) return;
    // Una selección que llega de fuera (?foco=, el Resumen, un aviso) puede caer dentro de una sección plegada.
    let id = structure.rowToSectionId.get(selectedRow) ?? null;
    while (id && id !== "root") {
      const meta = structure.sections.get(id);
      if (!meta || meta.rowIndex == null) break;
      const n = structure.byRow.get(meta.rowIndex);
      if (n) fijarPlegada(clavePlegado(n.name, meta.rowIndex), false);
      id = meta.parentId;
    }
  }, [selectedRow, structure, fijarPlegada]);

  // La fila elegida se trae a la vista sólo cuando cambia QUÉ pieza está elegida (o la movió el teclado). Un cambio
  // del workbook que sólo la renumera (arrastrar otra fila por encima, insertar, guardar) no debe mover la lista:
  // antes cada cambio de `structure` la devolvía a la elegida y soltar lejos saltaba al inicio (B1).
  const claveElegida = selectedRow == null ? null : structure?.byRow.get(selectedRow)?.name || `f:${selectedRow}`;
  const claveVista = useRef<string | null>(null);

  useEffect(() => {
    if (selectedRow == null || claveElegida == null) {
      claveVista.current = null;
      return;
    }
    if (claveVista.current === claveElegida && !focoTrasMover.current) return;
    const raf = window.requestAnimationFrame(() => {
      claveVista.current = claveElegida;
      const fila = scrollRef.current?.querySelector<HTMLElement>(`[data-outline-row="${selectedRow}"]`);
      fila?.scrollIntoView({ block: "nearest" });
      if (focoTrasMover.current) {
        focoTrasMover.current = false;
        scrollRef.current?.querySelector<HTMLElement>(`[data-nav="${selectedRow}"]`)?.focus({ preventScroll: true });
      }
    });
    return () => window.cancelAnimationFrame(raf);
  }, [selectedRow, claveElegida, structure]);

  const enRecorrido = selectedRow != null && lineas.some((l) => l.fila === selectedRow) ? selectedRow : null;

  // ---------------------------------------------------------------------------
  // Callbacks estables (las filas son memo)
  // ---------------------------------------------------------------------------

  const ultimo = useRef({ onSelect, onMoveUp, onMoveDown, onInsertar, onMoverFila });
  ultimo.current = { onSelect, onMoveUp, onMoveDown, onInsertar, onMoverFila };

  const onElegir = useCallback((fila: number) => ultimo.current.onSelect({ kind: "survey", rowIndex: fila }), []);
  const onPlegar = useCallback(
    (fila: number) => {
      const n = structure?.byRow.get(fila);
      if (!n) return;
      flip.capturar();
      alternarPlegada(clavePlegado(n.name, fila));
    },
    [structure, alternarPlegada, flip],
  );
  const moverArriba = useCallback(() => ultimo.current.onMoveUp(), []);
  const moverAbajo = useCallback(() => ultimo.current.onMoveDown(), []);
  const abrirInsertar = useCallback((destino: DestinoInsercion, ancla: HTMLElement) => setInsertando({ destino, ancla }), []);
  const hayInsertar = !!onInsertar;

  // ---------------------------------------------------------------------------
  // Arrastre
  // ---------------------------------------------------------------------------

  const fantasma = useRef<Fantasma | null>(null);
  const puntero = useRef<{ x: number; y: number } | null>(null);
  const autoscroll = useRef<number | null>(null);
  const recalculo = useRef<number | null>(null);
  const vivo = useRef({ arbol: resultado.arbol, plegada, structure, arrastre });
  vivo.current = { arbol: resultado.arbol, plegada, structure, arrastre };

  useLayoutEffect(() => {
    flip.animar();
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const recalcular = useCallback(() => {
    recalculo.current = null;
    const { arbol: a, plegada: p, structure: s, arrastre: actual } = vivo.current;
    const raiz = scrollRef.current;
    const y = puntero.current?.y;
    if (!actual || !s || !raiz || y == null) return;
    const ls: Linea[] = lineasVisibles(a, p, actual.fila);
    const porFila = new Map<string, HTMLElement>();
    raiz.querySelectorAll<HTMLElement>("[data-linea]").forEach((el) => porFila.set(el.dataset.linea ?? "", el));
    const centro = (i: number) => {
      const r = porFila.get(String(ls[i]!.fila))?.getBoundingClientRect();
      return r ? r.top + r.height / 2 : Number.POSITIVE_INFINITY;
    };
    const nuevo: Hueco | null = huecoEntre(s, ls, siguienteBajoPunteroEn(ls.length, centro, y));
    const viejo = actual.hueco;
    if (nuevo?.indice === viejo?.indice && nuevo?.contenedor === viejo?.contenedor) return;
    flip.capturar();
    setArrastre({ ...actual, hueco: nuevo });
  }, [flip]);

  const pedirRecalculo = useCallback(() => {
    if (recalculo.current == null) recalculo.current = window.requestAnimationFrame(recalcular);
  }, [recalcular]);

  // El listener de scroll se guarda en una ref: `pararAutoscroll` debe ser estable (lo usa la limpieza al desmontar,
  // que si cambiara en cada render cortaría el auto-scroll y quitaría el fantasma a mitad del arrastre).
  const alScroll = useRef<(() => void) | null>(null);
  const alMover = useRef<((e: PointerEvent) => void) | null>(null);
  const pararAutoscroll = useCallback(() => {
    if (alScroll.current) scrollRef.current?.removeEventListener("scroll", alScroll.current);
    alScroll.current = null;
    if (alMover.current) window.removeEventListener("pointermove", alMover.current);
    alMover.current = null;
    if (autoscroll.current != null) window.cancelAnimationFrame(autoscroll.current);
    autoscroll.current = null;
    if (recalculo.current != null) window.cancelAnimationFrame(recalculo.current);
    recalculo.current = null;
  }, []);

  const arrancarAutoscroll = useCallback(() => {
    // La velocidad va por tiempo, no por cuadro: en una máquina lenta (o con una lista de 800 líneas) los cuadros se
    // espacian y un paso fijo por cuadro avanzaba unos pocos px por segundo.
    let previo = performance.now();
    const paso = (ahora: number) => {
      const dt = Math.min(Math.max(ahora - previo, 0), 100);
      previo = ahora;
      const raiz = scrollRef.current;
      const y = puntero.current?.y;
      if (raiz && y != null) {
        const r = raiz.getBoundingClientRect();
        const arriba = y - r.top;
        const abajo = r.bottom - y;
        const escala = dt / 16;
        let dy = 0;
        if (arriba < MARGEN_AUTOSCROLL) dy = -Math.ceil(((MARGEN_AUTOSCROLL - Math.max(arriba, 0)) / 3) * escala);
        else if (abajo < MARGEN_AUTOSCROLL) dy = Math.ceil(((MARGEN_AUTOSCROLL - Math.max(abajo, 0)) / 3) * escala);
        if (dy) {
          const antes = raiz.scrollTop;
          raiz.scrollTop += dy;
          if (raiz.scrollTop !== antes) pedirRecalculo();
        }
      }
      autoscroll.current = window.requestAnimationFrame(paso);
    };
    autoscroll.current = window.requestAnimationFrame(paso);
  }, [pedirRecalculo]);

  useEffect(() => () => {
    pararAutoscroll();
    fantasma.current?.quitar();
    document.body.classList.remove("pulso-outline-drag-active");
  }, [pararAutoscroll]);

  function handleDragStart(event: DragStartEvent) {
    const fila = Number(event.active.id);
    const raiz = scrollRef.current;
    const ranura = raiz?.querySelector<HTMLElement>(`[data-linea="${fila}"]`);
    const visual = ranura?.firstElementChild;
    if (!structure || !raiz || !ranura || !(visual instanceof HTMLElement)) return;
    const r = visual.getBoundingClientRect();
    const punto = puntoDeEvento(event.activatorEvent) ?? { x: r.left + 12, y: r.top + r.height / 2 };
    puntero.current = punto;
    const destinoFantasma = (raiz.closest(".pulso-xlsform-frame") as HTMLElement | null) ?? document.body;
    fantasma.current?.quitar();
    fantasma.current = crearFantasma(visual, destinoFantasma, punto);
    const contenedor = lineas.find((l) => l.fila === fila)?.contenedor ?? null;
    flip.capturar();
    setArrastre({ fila, alto: r.height, hueco: { indice: fila, contenedor } });
    document.body.classList.add("pulso-outline-drag-active");
    // Con la rueda durante el arrastre la lista se mueve bajo el puntero quieto: el hueco se recalcula igual.
    alScroll.current = pedirRecalculo;
    raiz.addEventListener("scroll", pedirRecalculo, { passive: true });
    // El puntero se lee del evento nativo, no de `delta` de dnd-kit: ese delta suma el scroll de la lista, y con la
    // rueda o el auto-scroll el puntero «bajaba» solo, el hueco caía más abajo y el auto-scroll no paraba (B1).
    const mover = (e: PointerEvent) => {
      const p = { x: e.clientX, y: e.clientY };
      puntero.current = p;
      fantasma.current?.mover(p.x, p.y);
      pedirRecalculo();
    };
    alMover.current = mover;
    window.addEventListener("pointermove", mover, { passive: true });
    arrancarAutoscroll();
  }

  function terminar(aplicar: boolean) {
    pararAutoscroll();
    document.body.classList.remove("pulso-outline-drag-active");
    const actual = arrastre;
    const f = fantasma.current;
    fantasma.current = null;
    puntero.current = null;
    const plan = aplicar && actual?.hueco && structure ? planMoverA(structure, actual.fila, actual.hueco.indice) : null;
    const huecoEl = scrollRef.current?.querySelector<HTMLElement>("[data-hueco]") ?? null;
    const cerrar = () => {
      f?.quitar();
      if (plan) onApplyMove(plan);
      else flip.capturar();
      setArrastre(null);
    };
    if (f) f.asentar(huecoEl?.getBoundingClientRect() ?? null, cerrar);
    else cerrar();
  }

  // ---------------------------------------------------------------------------
  // Teclado
  // ---------------------------------------------------------------------------

  const enfocar = (fila: number | "ajustes") => {
    const el = scrollRef.current?.querySelector<HTMLElement>(`[data-nav="${fila}"]`);
    el?.focus();
    el?.scrollIntoView({ block: "nearest" });
  };

  function destinoDeLinea(fila: number): DestinoInsercion {
    const l = lineas.find((x) => x.fila === fila);
    if (!l) return { despuesDeFila: fila, seccionFila: null };
    if (l.tipo === "seccion" && l.abierta) return { despuesDeFila: null, seccionFila: fila };
    return { despuesDeFila: fila, seccionFila: l.contenedor };
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.metaKey || e.ctrlKey || arrastre) return;
    const objetivo = e.target instanceof HTMLElement ? e.target.closest<HTMLElement>("[data-nav]") : null;
    if (!objetivo || objetivo !== e.target) return;
    const nav = objetivo.dataset.nav ?? "";
    const fila = nav === "ajustes" ? null : Number(nav);
    const linea = fila == null ? null : lineas.find((l) => l.fila === fila) ?? null;

    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (fila == null) onSelect({ kind: "settings" });
      else onElegir(fila);
      return;
    }
    if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      if (fila == null || filtrando) return;
      e.preventDefault();
      const dir = e.key === "ArrowUp" ? "up" : "down";
      focoTrasMover.current = true;
      if (onMoverFila) onMoverFila(fila, dir);
      else if (fila === selectedRow) (dir === "up" ? onMoveUp : onMoveDown)();
      else focoTrasMover.current = false;
      return;
    }
    if (e.altKey) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (fila == null) {
        if (e.key === "ArrowDown" && lineas[0]) enfocar(lineas[0].fila);
        return;
      }
      const vecina = lineaVecina(lineas, fila, e.key === "ArrowDown" ? 1 : -1);
      if (vecina) enfocar(vecina.fila);
      else if (e.key === "ArrowUp") enfocar("ajustes");
      return;
    }
    if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      if (e.key === "Home") enfocar("ajustes");
      else if (lineas.length) enfocar(lineas[lineas.length - 1].fila);
      return;
    }
    if (e.key === "ArrowLeft" && linea) {
      e.preventDefault();
      if (linea.tipo === "seccion" && linea.abierta && !filtrando) onPlegar(linea.fila);
      else if (linea.contenedor != null) enfocar(linea.contenedor);
      return;
    }
    if (e.key === "ArrowRight" && linea?.tipo === "seccion") {
      e.preventDefault();
      if (!linea.abierta) onPlegar(linea.fila);
      else {
        const vecina = lineaVecina(lineas, linea.fila, 1);
        if (vecina?.contenedor === linea.fila) enfocar(vecina.fila);
      }
      return;
    }
    if ((e.key === "+" || e.key === "Insert") && onInsertar) {
      e.preventDefault();
      setInsertando({ destino: fila == null ? { despuesDeFila: null, seccionFila: null } : destinoDeLinea(fila), ancla: objetivo });
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const valor = useMemo<ValorEstructura | null>(
    () =>
      structure
        ? {
            structure,
            seleccion: selectedRow,
            enRecorrido,
            arrastre,
            arrastrable: !filtrando,
            plegada,
            avisos: avisosPorFila,
            canMoveUp,
            canMoveDown,
            limite: limiteSeccion,
            onElegir,
            onPlegar,
            onMoveUp: moverArriba,
            onMoveDown: moverAbajo,
            onInsertar: hayInsertar ? abrirInsertar : undefined,
          }
        : null,
    [structure, selectedRow, enRecorrido, arrastre, filtrando, plegada, avisosPorFila, canMoveUp, canMoveDown, limiteSeccion, onElegir, onPlegar, moverArriba, moverAbajo, hayInsertar, abrirInsertar],
  );

  const itemsMenu = useMemo(
    () =>
      insertando
        ? itemsInsertar((base) => {
            ultimo.current.onInsertar?.(insertando.destino, base);
          })
        : [],
    [insertando],
  );

  if (!structure || !structure.outline.length || !valor) {
    return (
      <EmptyState
        icon={<Layers3 size={18} />}
        title="Todavía no hay piezas en el formulario"
        hint="Añade una sección o una pregunta para empezar a construir."
        variant="inline"
      />
    );
  }

  const ajustesActivos = selection?.kind === "settings";

  return (
    <div className="xfe-estructura">
      <BarraEstructura
        consulta={consulta}
        filtro={filtro}
        conteos={conteos}
        activo={filtrando}
        coinciden={resultado.coinciden}
        total={resultado.total}
        porMarca={resultado.porMarca}
        accion={accionBarra}
        hayPlegadas={plegadas.size > 0}
        haySecciones={clavesSecciones.length > 0}
        onConsulta={setConsulta}
        onFiltro={setFiltro}
        onLimpiar={limpiarBusqueda}
        onPlegarTodo={() => {
          flip.capturar();
          plegarTodas(clavesSecciones);
        }}
        onDesplegarTodo={() => {
          flip.capturar();
          desplegarTodas();
        }}
        onIrALista={() => (lineas[0] ? enfocar(lineas[0].fila) : undefined)}
      />
      <DndContext
        sensors={sensors}
        // Sin el auto-scroll de dnd-kit (el de los bordes es propio) y SIN su compensación de corrimiento: al activar,
        // la fila de origen se esconde (la reemplaza el hueco), dnd-kit mide un rect en cero y «compensa» con un
        // scrollBy de cientos de px que mandaba la lista casi al inicio (B1, 2026-10-17).
        autoScroll={SIN_AUTOSCROLL}
        collisionDetection={() => []}
        onDragStart={handleDragStart}
        onDragEnd={(_e: DragEndEvent) => terminar(true)}
        onDragCancel={() => terminar(false)}
      >
        <div
          ref={scrollRef}
          className={`pulso-outline-scroll xfe-arbol${arrastre ? " is-arrastrando" : ""}`}
          role="group"
          aria-label="Estructura del formulario"
          onKeyDown={onKeyDown}
          data-qa-geometry-group="xlsform/outline"
          data-qa-geometry-contract="intrinsic"
          data-qa-geometry-capacity="owned"
        >
          <CabeceraRiel />
          <div className="xfe-ranura xfe-ranura--ajustes">
            <div
              role="button"
              tabIndex={enRecorrido == null ? 0 : -1}
              data-nav="ajustes"
              aria-current={ajustesActivos ? "true" : undefined}
              onClick={() => onSelect({ kind: "settings" })}
              className={`pulso-outline-row pulso-outline-settings${ajustesActivos ? " is-active" : ""}`}
            >
              <span className="pulso-outline-grip is-decor" aria-hidden="true">
                <Settings2 size={14} />
              </span>
              <div className="pulso-outline-body">
                <span className="pulso-outline-text">
                  <strong className="pulso-outline-title">Ajustes del formulario</strong>
                  <span className="pulso-outline-subtitle">Título, ID y versión</span>
                </span>
              </div>
            </div>
            {hayInsertar && !filtrando ? (
              <BotonInsertar destino={{ despuesDeFila: null, seccionFila: null }} etiqueta="Agregar al inicio del formulario" onAbrir={abrirInsertar} />
            ) : null}
          </div>

          <ContextoEstructura.Provider value={valor}>
            {resultado.arbol.hijos.length ? (
              <RamaEstructura hijos={resultado.arbol.hijos} contenedor={null} finSlot={resultado.arbol.finSlot} />
            ) : (
              <p className="xfe-sin-resultados" role="status">
                Nada coincide con la búsqueda
              </p>
            )}
          </ContextoEstructura.Provider>
        </div>
      </DndContext>
      <p className="xfe-pie" aria-hidden="true">
        <kbd>↑↓</kbd> recorre · <kbd>Enter</kbd> abre · <kbd>Alt ↑↓</kbd> mueve · <kbd>+</kbd> agrega
      </p>
      {insertando ? (
        <AddElementMenu
          items={itemsMenu}
          anchorElement={insertando.ancla}
          destino={textoDestino(structure, insertando.destino, (n) => tituloPlano(tituloDe(n)))}
          onClose={() => setInsertando(null)}
        />
      ) : null}
    </div>
  );
}

function puntoDeEvento(event: Event): { x: number; y: number } | null {
  if ("clientX" in event && "clientY" in event) {
    const { clientX, clientY } = event as MouseEvent;
    if (Number.isFinite(clientX) && Number.isFinite(clientY)) return { x: clientX, y: clientY };
  }
  if ("touches" in event) {
    const t = (event as TouchEvent).touches[0] ?? (event as TouchEvent).changedTouches[0];
    if (t) return { x: t.clientX, y: t.clientY };
  }
  return null;
}
