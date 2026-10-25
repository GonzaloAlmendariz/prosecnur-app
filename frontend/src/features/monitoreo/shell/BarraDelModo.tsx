import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type Ref } from "react";
import { ChevronDown, Loader2, RefreshCw } from "lucide-react";
import "./barraDelModo.css";

/**
 * Piezas de la barra del modo del esqueleto común (revamp de Monitoreo,
 * 2026-10-23; `docs/qa/revamp-monitoreo/estandar-de-ficha.md` §2b): a la
 * izquierda MODO, EJE DE CUOTA y FALTAN; a la derecha CORTE, la píldora de
 * estado y Actualizar ▾, el control único de L38 (cuerpo: traer lo nuevo y
 * recalcular; menú: por fuente, «Traer todo de nuevo» y «Recalcular»).
 */

export type IndicadorDelModo = {
  etiqueta: string;
  valor: string;
  /** `falta` pinta el valor en carmesí y `cumple` en verde; sin tono, neutro. */
  tono?: "falta" | "cumple";
  detalle?: string;
};

/**
 * Vocabulario común de la píldora de estado (estándar §2a): «Al día»,
 * «Actualizando, paso N de M», «Falló» y «Preparando», sin repetir la fecha
 * del corte. Manda sobre la píldora de L38, que además nombraba «Pendiente de
 * recalcular» y «Parcial»: los cambios sin recalcular se leen como
 * «Preparando» y el menú lo dice en su entrada «Recalcular».
 */
export type EstadoDelModo =
  | { clave: "al-dia" }
  | { clave: "actualizando"; paso?: number; pasos?: number }
  | { clave: "fallo"; detalle?: string }
  | { clave: "preparando"; detalle?: string };

export function etiquetaDeEstado(estado: EstadoDelModo): string {
  switch (estado.clave) {
    case "al-dia":
      return "Al día";
    case "actualizando":
      return estado.paso != null && estado.pasos != null
        ? `Actualizando, paso ${estado.paso} de ${estado.pasos}`
        : "Actualizando";
    case "fallo":
      return "Falló";
    case "preparando":
      return "Preparando";
  }
}

/** El paso que publica el job manda sobre el estado que calculó la raíz. */
export function estadoConProgreso(estado: EstadoDelModo, progreso?: ProgresoDeLaBarra | null): EstadoDelModo {
  if (estado.clave !== "actualizando" || !progreso) return estado;
  if (progreso.paso == null || progreso.pasos == null) return estado;
  return { clave: "actualizando", paso: progreso.paso, pasos: progreso.pasos };
}

export type ProgresoDeLaBarra = {
  paso?: number;
  pasos?: number;
  message?: string;
};

export type AccionDeActualizar = {
  /** Clave estable de la entrada; sin ella se usa la etiqueta. */
  clave?: string;
  etiqueta: string;
  /** Segunda línea en el menú (tipo de fuente, cuántas, qué falta). */
  detalle?: string;
  titulo?: string;
  /** Las entradas `fuentes` se agrupan bajo «Por fuente». */
  grupo?: "fuentes";
  disabled?: boolean;
  onElegir: () => void;
};

export type BarraDelModo = {
  /**
   * Control del contexto del modo junto a MODO: el selector `FASE ▾` de
   * Territorial (A4 de `territorial.md`). Opcional; los demás modos no lo usan.
   */
  selector?: ReactNode;
  indicadores: readonly IndicadorDelModo[];
  /** Fecha y hora del corte, ya formateadas («27/07/26 09:04»). */
  corte: string;
  estado: EstadoDelModo;
  actualizar: AccionDeActualizar;
  /** Variantes de Actualizar que viven en el menú del botón. */
  otrasActualizaciones?: readonly AccionDeActualizar[];
  /** Avance del job en curso, para el `title` del botón. */
  progreso?: string;
};

export function IndicadoresDelModo({ indicadores }: { indicadores: readonly IndicadorDelModo[] }) {
  return (
    <>
      {indicadores.map((item) => (
        <span
          key={item.etiqueta}
          className={`mon-modo-stat${item.tono ? ` is-${item.tono}` : ""}`}
          title={item.detalle ?? `${item.etiqueta}: ${item.valor}`}
        >
          <small>{item.etiqueta}</small>
          <b>{item.valor}</b>
        </span>
      ))}
    </>
  );
}

/**
 * El menú de «Actualizar ▾»: primero las fuentes, bajo «Por fuente», y después
 * «Traer todo de nuevo» y «Recalcular». Todo se apaga mientras corre un sync.
 */
export function MenuDeActualizar({
  id,
  acciones,
  ocupado,
  listaRef,
  onKeyDown,
  onElegido,
}: {
  id: string;
  acciones: readonly AccionDeActualizar[];
  ocupado: boolean;
  listaRef?: Ref<HTMLSpanElement>;
  onKeyDown?: (event: ReactKeyboardEvent<HTMLSpanElement>) => void;
  onElegido?: () => void;
}) {
  const porFuente = acciones.filter((accion) => accion.grupo === "fuentes");
  const generales = acciones.filter((accion) => accion.grupo !== "fuentes");
  const item = (accion: AccionDeActualizar) => (
    <button
      key={accion.clave ?? accion.etiqueta}
      type="button"
      role="menuitem"
      disabled={ocupado || accion.disabled}
      title={accion.titulo}
      onClick={() => {
        onElegido?.();
        accion.onElegir();
      }}
    >
      <span>{accion.etiqueta}</span>
      {accion.detalle ? <small>{accion.detalle}</small> : null}
    </button>
  );
  return (
    <span
      className="mon-modo-actualizar-lista"
      role="menu"
      id={id}
      aria-label="Formas de actualizar"
      ref={listaRef}
      onKeyDown={onKeyDown}
    >
      {porFuente.length ? (
        <span role="group" aria-labelledby={`${id}-fuentes`} className="mon-modo-actualizar-grupo">
          <small id={`${id}-fuentes`} className="mon-modo-actualizar-rotulo">Por fuente</small>
          {porFuente.map(item)}
        </span>
      ) : null}
      {porFuente.length && generales.length ? <span role="separator" className="mon-modo-actualizar-separador" /> : null}
      {generales.map(item)}
    </span>
  );
}

function itemsDelMenu(lista: HTMLElement | null) {
  return lista ? Array.from(lista.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')) : [];
}

export function HerramientasDelModo({
  barra,
  ocupado,
  progreso = null,
}: {
  barra: BarraDelModo;
  ocupado: boolean;
  /** Avance del job en curso (store de sync del perfil). */
  progreso?: ProgresoDeLaBarra | null;
}) {
  const [abierto, setAbierto] = useState(false);
  const raiz = useRef<HTMLSpanElement | null>(null);
  const lista = useRef<HTMLSpanElement | null>(null);
  const disparador = useRef<HTMLButtonElement | null>(null);
  const menuId = useId();
  const otras = barra.otrasActualizaciones ?? [];
  const estado = estadoConProgreso(barra.estado, progreso);
  const actualizando = estado.clave === "actualizando";

  // Un sync a la vez: si arranca uno con el menú abierto, el menú se cierra.
  useEffect(() => {
    if (ocupado) setAbierto(false);
  }, [ocupado]);

  useEffect(() => {
    if (!abierto) return undefined;
    itemsDelMenu(lista.current)[0]?.focus();
    const cerrarFuera = (event: MouseEvent) => {
      if (raiz.current && !raiz.current.contains(event.target as Node)) setAbierto(false);
    };
    const cerrarConEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAbierto(false);
        disparador.current?.focus();
      }
    };
    document.addEventListener("mousedown", cerrarFuera);
    document.addEventListener("keydown", cerrarConEscape);
    return () => {
      document.removeEventListener("mousedown", cerrarFuera);
      document.removeEventListener("keydown", cerrarConEscape);
    };
  }, [abierto]);

  const moverFoco = (event: ReactKeyboardEvent<HTMLSpanElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const items = itemsDelMenu(lista.current);
    if (!items.length) return;
    event.preventDefault();
    const actual = items.indexOf(document.activeElement as HTMLButtonElement);
    const siguiente = event.key === "Home"
      ? 0
      : event.key === "End"
        ? items.length - 1
        : event.key === "ArrowDown"
          ? (actual + 1) % items.length
          : (actual - 1 + items.length) % items.length;
    items[siguiente]?.focus();
  };

  return (
    <div className="mon-modo-herramientas">
      <span className="mon-modo-stat" title="Fecha y hora del último corte">
        <small>Corte</small>
        <b>{barra.corte || "Sin corte"}</b>
      </span>
      <span
        className={`mon-modo-estado is-${estado.clave}`}
        role="status"
        title={(estado.clave === "fallo" || estado.clave === "preparando") && estado.detalle ? estado.detalle : undefined}
      >
        {etiquetaDeEstado(estado)}
      </span>
      <span className="mon-modo-actualizar" ref={raiz}>
        <button
          type="button"
          className="mon-modo-actualizar-principal"
          disabled={ocupado || barra.actualizar.disabled}
          title={actualizando ? progreso?.message || barra.progreso || barra.actualizar.titulo : barra.actualizar.titulo}
          onClick={barra.actualizar.onElegir}
        >
          {actualizando ? <Loader2 size={14} className="pulso-spin" aria-hidden="true" /> : <RefreshCw size={14} aria-hidden="true" />}
          <span>{barra.actualizar.etiqueta}</span>
        </button>
        {otras.length ? (
          <>
            <button
              ref={disparador}
              type="button"
              className="mon-modo-actualizar-menu"
              aria-label="Más formas de actualizar"
              aria-haspopup="menu"
              aria-expanded={abierto}
              aria-controls={abierto ? menuId : undefined}
              disabled={ocupado}
              onClick={() => setAbierto((valor) => !valor)}
            >
              <ChevronDown size={14} aria-hidden="true" />
            </button>
            {abierto ? (
              <MenuDeActualizar
                id={menuId}
                acciones={otras}
                ocupado={ocupado}
                listaRef={lista}
                onKeyDown={moverFoco}
                onElegido={() => setAbierto(false)}
              />
            ) : null}
          </>
        ) : null}
      </span>
    </div>
  );
}
