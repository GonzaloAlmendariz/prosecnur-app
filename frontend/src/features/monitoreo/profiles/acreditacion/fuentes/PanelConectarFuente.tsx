// El botón «Conectar fuente» y su panel, conectados a la dirección.
//
// ADR 0044: un overlay nuevo se cuelga de `?panel=`, no de un `useState`
// suelto. Si no está en la URL el QA visual no puede alcanzarlo, y un flujo de
// conexión que nadie puede abrir en una corrida automatizada es un flujo que
// nadie verifica.
//
// Vive aparte de `ConectarFuente.tsx` para que ese archivo no sepa nada de
// enrutamiento: recibe `onCerrar` y ya.

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { Plus } from "../../../../../vendor/lucide-react";
import type { MonitoreoSource, MonitoreoSourceRole, MonitoreoState } from "../../../../../api/client";
import { PANELES_POR_MODULO } from "../../../../../lib/navegacion/manifiesto";
import { usePanelDireccionable } from "../../../../../lib/navegacion/paneles";
import { ConectarFuente } from "./ConectarFuente";
import "./fuentes.css";

// La declaración vive en el manifiesto —que es lo que recorre el QA visual— y
// aquí solo se consume, para que no haya dos copias que se desincronicen.
const PANEL = PANELES_POR_MODULO.monitoreo![0];

export function PanelConectarFuente({
  sources,
  actoresSugeridos,
  papelInicial,
  onStateChange,
}: {
  sources: MonitoreoSource[];
  actoresSugeridos: string[];
  papelInicial?: Extract<MonitoreoSourceRole, "universo" | "barrido" | "respuestas">;
  onStateChange?: (state: MonitoreoState) => void;
}) {
  const panel = usePanelDireccionable(PANEL);
  const location = useLocation();
  // `?foco=` trae el actor sobre el que se pulsó en Universo, para que el panel
  // no vuelva a preguntar algo que el usuario ya eligió al abrirlo.
  const actorEnFoco = new URLSearchParams(location.search).get("foco") ?? "";

  // Escape cierra. Es lo que todo el mundo intenta primero en un overlay, y
  // sin esto la única salida era acertarle a la X o al velo.
  useEffect(() => {
    if (!panel.abierto) return;
    const alPulsar = (event: KeyboardEvent) => {
      if (event.key === "Escape") panel.cerrar();
    };
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [panel.abierto, panel.cerrar]);

  return (
    <>
      <button type="button" className="pulso-button is-primary" onClick={panel.abrir}>
        <Plus size={14} />
        <span>Conectar fuente</span>
      </button>
      {/* Portal al `body`.
        *
        * `position: fixed` NO se ancla al viewport si algún ancestro tiene
        * `transform`: se ancla a ese ancestro. El botón vive dentro de la
        * franja de fuentes, que sí lo tiene, así que el sideover quedaba
        * atrapado en la altura de la franja —una cajita a media pantalla— en
        * vez de cubrirla. Es la misma trampa que ya documentó el z-index del
        * toolbar. Un overlay pertenece al `body`. */}
      {panel.abierto ? createPortal((
        <div
          className="fuentes-conectar-fondo"
          {...panel.props}
          // Cerrar al hacer click fuera, pero solo en el fondo: un click dentro
          // del panel que termine sobre el fondo por arrastre no debe descartar
          // lo que se lleva escrito.
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) panel.cerrar();
          }}
        >
          <ConectarFuente
            sources={sources}
            actoresSugeridos={actorEnFoco ? [actorEnFoco, ...actoresSugeridos.filter((item) => item !== actorEnFoco)] : actoresSugeridos}
            papelInicial={papelInicial}
            onCerrar={panel.cerrar}
            onStateChange={onStateChange}
          />
        </div>
      ), document.body) : null}
    </>
  );
}
