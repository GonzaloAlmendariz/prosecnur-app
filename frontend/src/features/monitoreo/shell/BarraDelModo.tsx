import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronDown, Loader2, RefreshCw } from "lucide-react";
import "./barraDelModo.css";

/**
 * Piezas de la barra del modo del esqueleto común (revamp de Monitoreo,
 * 2026-10-23; `docs/qa/revamp-monitoreo/estandar-de-ficha.md` §2b): a la
 * izquierda MODO, EJE DE CUOTA y FALTAN; a la derecha CORTE, la píldora de
 * estado y Actualizar. Hoy las monta Telefónico; los demás modos siguen con la
 * barra anterior hasta su fase.
 */

export type IndicadorDelModo = {
  etiqueta: string;
  valor: string;
  /** `falta` pinta el valor en carmesí y `cumple` en verde; sin tono, neutro. */
  tono?: "falta" | "cumple";
  detalle?: string;
};

/** Vocabulario común de la píldora de estado, sin repetir la fecha del corte. */
export type EstadoDelModo =
  | { clave: "al-dia" }
  | { clave: "actualizando"; paso?: number; pasos?: number }
  | { clave: "fallo"; detalle?: string }
  | { clave: "preparando" }
  /** Cambios sin recalcular: el vocabulario común aún no lo nombra (P17). */
  | { clave: "pendiente" };

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
    case "pendiente":
      // Como hoy: el vocabulario común no tiene este estado y la decisión
      // está abierta (P17 de `telefonico.md`).
      return "Pendiente";
  }
}

export type AccionDeActualizar = {
  etiqueta: string;
  titulo?: string;
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

export function HerramientasDelModo({ barra, ocupado }: { barra: BarraDelModo; ocupado: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const raiz = useRef<HTMLSpanElement | null>(null);
  const menuId = useId();
  const otras = barra.otrasActualizaciones ?? [];
  const actualizando = barra.estado.clave === "actualizando";

  useEffect(() => {
    if (!abierto) return undefined;
    const cerrarFuera = (event: MouseEvent) => {
      if (raiz.current && !raiz.current.contains(event.target as Node)) setAbierto(false);
    };
    const cerrarConEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAbierto(false);
    };
    document.addEventListener("mousedown", cerrarFuera);
    document.addEventListener("keydown", cerrarConEscape);
    return () => {
      document.removeEventListener("mousedown", cerrarFuera);
      document.removeEventListener("keydown", cerrarConEscape);
    };
  }, [abierto]);

  return (
    <div className="mon-modo-herramientas">
      <span className="mon-modo-stat" title="Fecha y hora del último corte">
        <small>Corte</small>
        <b>{barra.corte || "Sin corte"}</b>
      </span>
      <span
        className={`mon-modo-estado is-${barra.estado.clave}`}
        role="status"
        title={barra.estado.clave === "fallo" && barra.estado.detalle
          ? barra.estado.detalle
          : barra.estado.clave === "pendiente" ? "Hay cambios sin recalcular" : undefined}
      >
        {etiquetaDeEstado(barra.estado)}
      </span>
      <span className="mon-modo-actualizar" ref={raiz}>
        <button
          type="button"
          className="mon-modo-actualizar-principal"
          disabled={ocupado || barra.actualizar.disabled}
          title={barra.progreso ?? barra.actualizar.titulo}
          onClick={barra.actualizar.onElegir}
        >
          {actualizando ? <Loader2 size={14} className="pulso-spin" aria-hidden="true" /> : <RefreshCw size={14} aria-hidden="true" />}
          <span>{barra.actualizar.etiqueta}</span>
        </button>
        {otras.length ? (
          <>
            <button
              type="button"
              className="mon-modo-actualizar-menu"
              aria-label="Más formas de actualizar"
              aria-haspopup="menu"
              aria-expanded={abierto}
              aria-controls={menuId}
              disabled={ocupado}
              onClick={() => setAbierto((valor) => !valor)}
            >
              <ChevronDown size={14} aria-hidden="true" />
            </button>
            {abierto ? (
              <span className="mon-modo-actualizar-lista" role="menu" id={menuId}>
                {otras.map((accion) => (
                  <button
                    key={accion.etiqueta}
                    type="button"
                    role="menuitem"
                    disabled={accion.disabled}
                    title={accion.titulo}
                    onClick={() => {
                      setAbierto(false);
                      accion.onElegir();
                    }}
                  >
                    {accion.etiqueta}
                  </button>
                ))}
              </span>
            ) : null}
          </>
        ) : null}
      </span>
    </div>
  );
}
