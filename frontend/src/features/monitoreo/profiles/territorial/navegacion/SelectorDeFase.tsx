import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import type { MonitoreoTerritorialPhase } from "../../../../../api/client";
import type { OpcionDeFase } from "./fase";

/**
 * `FASE ▾` en la barra del modo (A4): abre la lista de fases con lo que trae
 * cada una. Elegir otra cambia todas las secciones del modo. Escape o un clic
 * fuera cierran y devuelven el foco al botón.
 */
export function SelectorDeFase({
  opciones,
  deshabilitado,
  onElegir,
}: {
  opciones: readonly OpcionDeFase[];
  deshabilitado?: boolean;
  onElegir: (fase: MonitoreoTerritorialPhase) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const raiz = useRef<HTMLSpanElement | null>(null);
  const boton = useRef<HTMLButtonElement | null>(null);
  const listaId = useId();
  const activa = opciones.find((item) => item.activa) ?? opciones[0];

  useEffect(() => {
    if (!abierto) return undefined;
    const cerrarFuera = (event: MouseEvent) => {
      if (raiz.current && !raiz.current.contains(event.target as Node)) setAbierto(false);
    };
    const cerrarConEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setAbierto(false);
      boton.current?.focus();
    };
    document.addEventListener("mousedown", cerrarFuera);
    document.addEventListener("keydown", cerrarConEscape);
    return () => {
      document.removeEventListener("mousedown", cerrarFuera);
      document.removeEventListener("keydown", cerrarConEscape);
    };
  }, [abierto]);

  return (
    <span className="mon-ter-fase" ref={raiz}>
      <button
        ref={boton}
        type="button"
        className="mon-ter-fase-boton"
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-controls={listaId}
        aria-label={`Fase: ${activa?.nombre ?? "sin fase"}. Cambiar fase`}
        disabled={deshabilitado}
        onClick={() => setAbierto((valor) => !valor)}
      >
        <small>Fase</small>
        <b>
          {activa?.nombre ?? "—"}
          <ChevronDown size={13} aria-hidden="true" />
        </b>
      </button>
      {abierto ? (
        <span className="mon-ter-fase-lista" role="menu" id={listaId} aria-label="Fase del modo">
          <span className="mon-ter-fase-titulo" aria-hidden="true">Fase del modo</span>
          {opciones.map((item) => (
            <button
              key={item.fase}
              type="button"
              role="menuitemradio"
              aria-checked={item.activa}
              className={`mon-ter-fase-opcion${item.activa ? " is-activa" : ""}`}
              onClick={() => {
                setAbierto(false);
                boton.current?.focus();
                if (!item.activa) onElegir(item.fase);
              }}
            >
              <span className="mon-ter-fase-marca" aria-hidden="true">{item.activa ? <Check size={14} /> : null}</span>
              <span className="mon-ter-fase-copia">
                <strong>{item.nombre}</strong>
                <small>{item.detalle}</small>
              </span>
              {item.fecha ? <span className="mon-ter-fase-fecha">{item.fecha}</span> : null}
            </button>
          ))}
          <span className="mon-ter-fase-pie">Cambia todas las secciones del modo.</span>
        </span>
      ) : null}
    </span>
  );
}
