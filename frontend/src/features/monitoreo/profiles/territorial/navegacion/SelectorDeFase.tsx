import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import type { MonitoreoTerritorialPhase } from "../../../../../api/client";
import type { OpcionDeFase } from "./fase";
import { apiMonitoreoTerritorialConfig } from "../../../../../api/monitoreo";
import { discrepanciaDeEtapa, discrepanciaDeVentana, usePlannerCalendario } from "./etapaDelPlanner";

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
  // 2i: la etapa que declara el Planner; si discrepa, se ofrece alinear.
  const calendario = usePlannerCalendario();
  const discrepancia = discrepanciaDeEtapa(calendario, activa?.fase);
  // La ventana que propone el Planner; alinearla cambia qué respuestas cuentan
  // como campo, así que sólo con el clic. Se aplica al volver a actualizar.
  const ventana = discrepanciaDeVentana(calendario, {
    pilotoDesde: opciones.find((o) => o.fase === "pilot")?.inicio ?? "",
    campoDesde: opciones.find((o) => o.fase === "field")?.inicio ?? "",
  });
  const [ventanaAlineada, setVentanaAlineada] = useState("");
  async function alinearVentana() {
    if (!ventana) return;
    try {
      await apiMonitoreoTerritorialConfig({
        phase_windows: {
          pilot: { start_at: ventana.pilotoDesde },
          field: { start_at: ventana.inicio },
        },
      } as never);
      setVentanaAlineada("Ventana alineada: las cifras la usan al actualizar.");
    } catch (e) {
      setVentanaAlineada(`No se pudo alinear la ventana: ${(e as Error).message}`);
    }
  }

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
      {discrepancia ? (
        <button
          type="button"
          className="mon-ter-fase-alinear"
          title={`${discrepancia.texto} Alinear cambia la fase de Monitoreo; la ventana de campo no se toca.`}
          disabled={deshabilitado}
          onClick={() => onElegir(discrepancia.fase)}
        >
          {discrepancia.texto} <b>Alinear la fase</b>
        </button>
      ) : null}
      {ventanaAlineada ? (
        <span className="mon-ter-fase-alinear" role="status">{ventanaAlineada}</span>
      ) : ventana ? (
        <button
          type="button"
          className="mon-ter-fase-alinear"
          title={`${ventana.texto} Alinear cambia qué respuestas cuentan como campo.`}
          disabled={deshabilitado}
          onClick={() => { void alinearVentana(); }}
        >
          {ventana.texto} <b>Alinear la ventana</b>
        </button>
      ) : null}
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
