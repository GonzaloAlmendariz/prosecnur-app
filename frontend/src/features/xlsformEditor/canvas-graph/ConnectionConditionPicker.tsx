// =============================================================================
// canvas-graph/ConnectionConditionPicker.tsx — panel de condición tras soltar una flecha
// =============================================================================
// Al soltar una flecha entre dos nodos, este panel pregunta qué condición dispara la visibilidad:
// tiene un valor, está vacío, es igual a… o es distinto de… (con buscador sobre la lista completa si el
// origen es un select). Si el destino ya tenía `relevant`, un segundo paso pregunta cómo combinarlas.
//
// E1 (2026-10-20): antes iba `position: fixed` dentro del lienzo, con un translate y un backdrop-filter que le
// cambiaban el origen. Salía en zonas irregulares, se cortaba y la lista de opciones lo estiraba entero.
// Ahora va en un portal dentro del marco del editor (como PanelMarca), con ancho fijo, alto con tope y scroll
// propio. Se mueve arrastrando la cabecera, nunca sale de la ventana y la lista larga tiene alto fijo.
// =============================================================================

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { Check, GripVertical, Search, X } from "../../../vendor/lucide-react";
import { TechTerm } from "../helpers/TechTerm";
import type { CatalogContext, GraphNode } from "./buildGraph";
import {
  altoMaximoCondicion,
  anchoCondicion,
  encajarCondicion,
  posicionInicialCondicion,
  type Caja,
} from "./posicionCondicion";
import "./condicionPanel.css";

type Operator = "exists" | "missing" | "equals" | "not_equals";
type Combiner = "and" | "or";

export type ConnectionConditionPickerProps = {
  source: GraphNode;
  target: GraphNode;
  /** Punto de la ventana donde se soltó la flecha: el panel abre a su lado. */
  screenX: number;
  screenY: number;
  /** Catálogo del origen si es select_one/multiple. */
  sourceCatalog?: CatalogContext;
  /** `relevant` que el destino ya tenía: activa el paso de combinar (Y / O). */
  existingExpression?: string;
  onConfirm: (expression: string, combiner?: Combiner) => void;
  onCancel: () => void;
};

const OPERADORES: readonly { op: Operator; texto: string }[] = [
  { op: "exists", texto: "tiene un valor" },
  { op: "missing", texto: "está vacío" },
  { op: "equals", texto: "es igual a…" },
  { op: "not_equals", texto: "es distinto de…" },
];

/** Origen del bloque contenedor de `fixed` para los hijos de `padre` (la ventana, salvo un ancestro con transform). */
function origenFijo(padre: HTMLElement): { x: number; y: number } {
  const sondeo = document.createElement("div");
  sondeo.setAttribute("aria-hidden", "true");
  sondeo.style.cssText = "position:fixed;left:0;top:0;width:0;height:0;margin:0;padding:0;border:0;visibility:hidden;pointer-events:none";
  padre.appendChild(sondeo);
  const r = sondeo.getBoundingClientRect();
  sondeo.remove();
  return { x: r.left, y: r.top };
}

export function ConnectionConditionPicker({
  source,
  target,
  screenX,
  screenY,
  sourceCatalog,
  existingExpression,
  onConfirm,
  onCancel,
}: ConnectionConditionPickerProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const tituloId = useId();
  const listaId = useId();
  const [op, setOp] = useState<Operator>("exists");
  const [value, setValue] = useState("");
  const [query, setQuery] = useState("");
  const [activo, setActivo] = useState(0);
  const [step, setStep] = useState<1 | 2>(1);
  const [combiner, setCombiner] = useState<Combiner>("or");
  /** Posición en la ventana. null hasta medir el panel (el primer layout lo ubica antes de pintarse). */
  const [caja, setCaja] = useState<Caja | null>(null);
  const cajaRef = useRef<Caja | null>(null);
  const origen = useRef({ x: 0, y: 0 });
  cajaRef.current = caja;
  const cancelar = useRef(onCancel);
  cancelar.current = onCancel;
  const hasExisting = !!existingExpression && existingExpression.trim() !== "";
  const needsValue = op === "equals" || op === "not_equals";
  const canConfirm = !needsValue || value.trim() !== "";

  const filteredItems = useMemo(() => {
    if (!sourceCatalog) return [];
    const q = query.trim().toLowerCase();
    if (!q) return sourceCatalog.items;
    return sourceCatalog.items.filter(
      (it) => (it.label ?? "").toLowerCase().includes(q) || (it.name ?? "").toLowerCase().includes(q),
    );
  }, [sourceCatalog, query]);
  const elegido = sourceCatalog?.items.find((it) => it.name === value) ?? null;

  const destino = useMemo<HTMLElement>(
    () => document.querySelector<HTMLElement>(".pulso-xlsform-frame") ?? document.body,
    [],
  );

  // Ubica el panel antes de pintarlo y lo vuelve a encajar cuando cambia de alto (otro operador, paso 2) o la ventana.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medidas = () => ({ ancho: el.offsetWidth, alto: el.offsetHeight, vw: window.innerWidth, vh: window.innerHeight });
    origen.current = origenFijo(destino);
    setCaja(posicionInicialCondicion({ x: screenX, y: screenY, ...medidas() }));
    const reencajar = () => {
      const actual = cajaRef.current;
      if (actual) setCaja(encajarCondicion({ ...actual, ...medidas() }));
    };
    const observador = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(reencajar);
    observador?.observe(el);
    window.addEventListener("resize", reencajar);
    return () => {
      observador?.disconnect();
      window.removeEventListener("resize", reencajar);
    };
  }, [screenX, screenY, destino]);

  // Esc cierra (y no llega al lienzo), clic afuera cierra y el foco vuelve a donde estaba al abrir.
  useEffect(() => {
    const previo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      cancelar.current();
    };
    const onPointer = (e: PointerEvent) => {
      if (!(e.target instanceof Node && ref.current?.contains(e.target))) cancelar.current();
    };
    document.addEventListener("keydown", onKey, true);
    const t = window.setTimeout(() => document.addEventListener("pointerdown", onPointer, true), 0);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onPointer, true);
      // Se abrió soltando una flecha con el mouse: no había foco que devolver y vuelve al lienzo.
      const vuelta = previo && previo.isConnected && previo !== document.body ? previo : document.querySelector<SVGSVGElement>(".pulso-graph-svg");
      vuelta?.focus({ preventScroll: true });
    };
  }, []);

  // El foco entra al panel cuando ya está ubicado (antes es invisible y no lo acepta).
  const ubicado = caja !== null;
  useEffect(() => {
    if (ubicado) ref.current?.querySelector<HTMLInputElement>("input[type=radio]:checked")?.focus({ preventScroll: true });
  }, [ubicado]);

  // Arrastre por la cabecera: el panel sigue al puntero sin salir de la ventana.
  const arrastre = useRef<{ dx: number; dy: number } | null>(null);
  const empezarArrastre = (e: ReactPointerEvent<HTMLElement>) => {
    if (e.button !== 0 || (e.target instanceof Element && e.target.closest("button"))) return;
    const actual = cajaRef.current;
    if (!actual) return;
    arrastre.current = { dx: e.clientX - actual.left, dy: e.clientY - actual.top };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  const moverArrastre = (e: ReactPointerEvent<HTMLElement>) => {
    const a = arrastre.current;
    const el = ref.current;
    if (!a || !el) return;
    setCaja(encajarCondicion({
      left: e.clientX - a.dx,
      top: e.clientY - a.dy,
      ancho: el.offsetWidth,
      alto: el.offsetHeight,
      vw: window.innerWidth,
      vh: window.innerHeight,
    }));
  };
  const soltarArrastre = (e: ReactPointerEvent<HTMLElement>) => {
    arrastre.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const buildExpression = (): string => {
    const safeValue = value.replace(/'/g, "\\'");
    switch (op) {
      case "exists":
        return `\${${source.name}} != ''`;
      case "missing":
        return `\${${source.name}} = ''`;
      case "equals":
        return `\${${source.name}} = '${safeValue}'`;
      case "not_equals":
        return `\${${source.name}} != '${safeValue}'`;
    }
  };

  const handleConfirm = () => {
    if (!canConfirm) return;
    if (hasExisting && step === 1) {
      setStep(2);
      return;
    }
    onConfirm(buildExpression(), hasExisting ? combiner : undefined);
  };

  const elegir = (name: string) => {
    setValue(name);
    const i = filteredItems.findIndex((it) => it.name === name);
    if (i >= 0) setActivo(i);
  };

  // La opción activa (teclado) se mantiene a la vista dentro de su lista, sin mover el panel.
  useEffect(() => {
    const lista = ref.current?.querySelector<HTMLElement>(".xfc-opciones");
    const fila = lista?.querySelector<HTMLElement>(`[data-i="${activo}"]`);
    if (!lista || !fila) return;
    if (fila.offsetTop < lista.scrollTop) lista.scrollTop = fila.offsetTop;
    else if (fila.offsetTop + fila.offsetHeight > lista.scrollTop + lista.clientHeight) {
      lista.scrollTop = fila.offsetTop + fila.offsetHeight - lista.clientHeight;
    }
  }, [activo]);

  const vw = typeof window === "undefined" ? 1440 : window.innerWidth;
  const vh = typeof window === "undefined" ? 1000 : window.innerHeight;

  return createPortal(
    <div
      ref={ref}
      className={caja ? "xfc-panel is-vis" : "xfc-panel"}
      role="dialog"
      aria-labelledby={tituloId}
      style={{
        width: anchoCondicion(vw),
        maxHeight: altoMaximoCondicion(vh),
        left: (caja?.left ?? 0) - origen.current.x,
        top: (caja?.top ?? 0) - origen.current.y,
      }}
    >
      <header
        className="xfc-cab"
        onPointerDown={empezarArrastre}
        onPointerMove={moverArrastre}
        onPointerUp={soltarArrastre}
        onPointerCancel={soltarArrastre}
        title="Arrastra para mover"
      >
        <GripVertical size={14} className="xfc-cab__asa" aria-hidden="true" />
        <div className="xfc-cab__txt">
          <span id={tituloId} className="xfc-cab__tit">
            Condición para mostrarse <TechTerm t="relevant" />
          </span>
          <span className="xfc-cab__par">
            <code>{source.name}</code>
            <span aria-hidden="true">→</span>
            <code>{target.name}</code>
          </span>
        </div>
        <button type="button" className="xfc-cab__x" onClick={onCancel} aria-label="Cancelar">
          <X size={14} />
        </button>
      </header>

      <div className="xfc-cuerpo">
        {step === 1 ? (
          <>
            <fieldset className="xfc-ops">
              <legend className="xfc-pregunta">
                ¿Cuándo aparece <code>{target.name}</code>?
              </legend>
              {OPERADORES.map(({ op: valor, texto }) => (
                <label key={valor} className={op === valor ? "xfc-op is-on" : "xfc-op"}>
                  <input type="radio" name={`${tituloId}-op`} checked={op === valor} onChange={() => setOp(valor)} />
                  <span>
                    Cuando <code>{source.name}</code> {texto}
                  </span>
                </label>
              ))}
            </fieldset>

            {needsValue && sourceCatalog ? (
              <div className="xfc-valor">
                <label className="xfc-buscar">
                  <Search size={13} aria-hidden="true" />
                  <input
                    autoFocus
                    type="text"
                    placeholder={`Busca entre ${sourceCatalog.itemCount} opciones`}
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setActivo(0);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setActivo((i) => Math.min(i + 1, filteredItems.length - 1));
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setActivo((i) => Math.max(i - 1, 0));
                      } else if (e.key === "Enter") {
                        e.preventDefault();
                        const it = filteredItems[activo];
                        if (it && it.name !== value) elegir(it.name);
                        else if (canConfirm) handleConfirm();
                      }
                    }}
                    spellCheck={false}
                    role="combobox"
                    aria-label="Buscar opción"
                    aria-expanded="true"
                    aria-controls={listaId}
                    aria-activedescendant={filteredItems[activo] ? `${listaId}-${activo}` : undefined}
                  />
                </label>
                <ul id={listaId} className="xfc-opciones" role="listbox" aria-label={`Opciones de ${sourceCatalog.listName}`}>
                  {filteredItems.length === 0 ? (
                    <li className="xfc-opciones__vacio">Sin coincidencias</li>
                  ) : (
                    filteredItems.map((it, i) => (
                      <li
                        key={it.rowIndex}
                        id={`${listaId}-${i}`}
                        data-i={i}
                        role="option"
                        aria-selected={value === it.name}
                        className={[
                          "xfc-opcion",
                          value === it.name ? "is-on" : "",
                          i === activo ? "is-activa" : "",
                        ].filter(Boolean).join(" ")}
                        onPointerDown={(e) => e.preventDefault()}
                        onClick={() => elegir(it.name)}
                      >
                        <span className="xfc-opcion__txt">{it.label || it.name}</span>
                        <code>{it.name}</code>
                        {value === it.name ? <Check size={13} aria-hidden="true" /> : null}
                      </li>
                    ))
                  )}
                </ul>
                <p className="xfc-elegido" aria-live="polite">
                  {elegido ? (
                    <>Elegiste <strong>{elegido.label || elegido.name}</strong> <code>{elegido.name}</code></>
                  ) : (
                    "Elige una opción de la lista"
                  )}
                </p>
              </div>
            ) : null}

            {needsValue && !sourceCatalog ? (
              <div className="xfc-valor">
                <input
                  autoFocus
                  type="text"
                  className="xfc-texto"
                  aria-label="Valor"
                  placeholder="ej. 70"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && canConfirm) handleConfirm();
                  }}
                  spellCheck={false}
                />
              </div>
            ) : null}
          </>
        ) : (
          <>
            <p className="xfc-pregunta">
              <code>{target.name}</code> ya depende de otra condición. ¿Cómo se combinan?
            </p>
            <div className="xfc-lectura">
              <span>Actual</span>
              <code>{humanize(existingExpression ?? "")}</code>
            </div>
            <div className="xfc-lectura">
              <span>Nueva</span>
              <code>{humanize(buildExpression())}</code>
            </div>
            <fieldset className="xfc-ops">
              <legend className="xfc-oculto">Cómo combinar</legend>
              <label className={combiner === "and" ? "xfc-op is-on" : "xfc-op"}>
                <input type="radio" name={`${tituloId}-comb`} checked={combiner === "and"} onChange={() => setCombiner("and")} />
                <span><strong>Y</strong>, deben cumplirse las dos</span>
              </label>
              <label className={combiner === "or" ? "xfc-op is-on" : "xfc-op"}>
                <input type="radio" name={`${tituloId}-comb`} checked={combiner === "or"} onChange={() => setCombiner("or")} />
                <span><strong>O</strong>, basta con una</span>
              </label>
            </fieldset>
          </>
        )}
      </div>

      <footer className="xfc-pie">
        {step === 2 ? (
          <button type="button" onClick={() => setStep(1)}>Atrás</button>
        ) : (
          <button type="button" onClick={onCancel}>Cancelar</button>
        )}
        <button type="button" className="pulso-primary" onClick={handleConfirm} disabled={!canConfirm}>
          <Check size={13} aria-hidden="true" />
          {step === 2 ? "Combinar" : hasExisting ? "Siguiente" : "Crear conexión"}
        </button>
      </footer>
    </div>,
    destino,
  );
}

// Lectura mínima para el paso de combinar: `${X}` como X y los operadores básicos en palabras.
function humanize(expr: string): string {
  return expr
    .replace(/\$\{([^}]+)\}/g, "$1")
    .replace(/\s*!=\s*''/g, " tiene valor")
    .replace(/\s*=\s*''/g, " está vacío")
    .replace(/\s+!=\s+/g, " ≠ ")
    .replace(/\s+\band\b\s+/g, " y ")
    .replace(/\s+\bor\b\s+/g, " o ");
}
