// El botón «Conectar fuente» y su panel, conectados a la dirección.
//
// ADR 0044: un overlay nuevo se cuelga de `?panel=`, no de un `useState`
// suelto. Si no está en la URL el QA visual no puede alcanzarlo, y un flujo de
// conexión que nadie puede abrir en una corrida automatizada es un flujo que
// nadie verifica.
//
// Vive aparte de `ConectarFuente.tsx` para que ese archivo no sepa nada de
// enrutamiento: recibe `onCerrar` y ya.

import { useCallback, useEffect } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { Plus } from "../../../vendor/lucide-react";
import type { MonitoreoActorUnit, MonitoreoSource, MonitoreoState } from "../../../api/client";
import { PANELES_POR_MODULO } from "../../../lib/navegacion/manifiesto";
import { usePanelDireccionable } from "../../../lib/navegacion/paneles";
import { ConectarFuente } from "./ConectarFuente";
import { actorEnFoco, fuenteEnFoco } from "./abrirConectarFuente";
import type { PapelDeFuente } from "./guionDeConexion";
import "./conectarFuente.css";

// La declaración vive en el manifiesto —que es lo que recorre el QA visual— y
// aquí solo se consume, para que no haya dos copias que se desincronicen.
const PANEL = PANELES_POR_MODULO.monitoreo![0];

export function PanelConectarFuente({
  sources,
  familia,
  actoresSugeridos,
  papelInicial,
  elenco,
  renderCanal,
  onStateChange,
}: {
  sources: MonitoreoSource[];
  /** Familia del perfil: decide el guion que el panel presenta. */
  familia?: string;
  actoresSugeridos: string[];
  papelInicial?: PapelDeFuente;
  /** El elenco declarado, para la cardinalidad. Ver `ConectarFuente`. */
  elenco?: MonitoreoActorUnit[];
  /** El selector de canal del perfil. Ver `ConectarFuente`. */
  renderCanal?: (value: string, onChange: (value: string) => void) => ReactNode;
  onStateChange?: (state: MonitoreoState) => void;
}) {
  const panel = usePanelDireccionable(PANEL);
  const location = useLocation();
  const navigate = useNavigate();
  // `?foco=` trae el actor sobre el que se pulsó en Universo, para que el panel
  // no vuelva a preguntar algo que el usuario ya eligió al abrirlo. Con el
  // prefijo `fuente:` trae, en cambio, la conexión que se viene a cambiar.
  const actorPulsado = actorEnFoco(location.search);
  const idAEditar = fuenteEnFoco(location.search);
  const fuenteAEditar = idAEditar
    ? sources.find((source) => source.id === idAEditar) ?? null
    : null;

  // Cerrar limpia también el foco: si se quedara puesto, el siguiente
  // «Conectar fuente» abriría el panel sobre la conexión anterior.
  const cerrar = useCallback(() => {
    const params = new URLSearchParams(location.search);
    if (params.has("foco")) {
      params.delete("foco");
      params.delete("panel");
      navigate({ pathname: location.pathname, search: params.toString() ? `?${params.toString()}` : "" }, { replace: true });
      return;
    }
    panel.cerrar();
  }, [location.pathname, location.search, navigate, panel]);

  // Escape cierra. Es lo que todo el mundo intenta primero en un overlay, y
  // sin esto la única salida era acertarle a la X o al velo.
  useEffect(() => {
    if (!panel.abierto) return;
    const alPulsar = (event: KeyboardEvent) => {
      if (event.key === "Escape") cerrar();
    };
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [panel.abierto, cerrar]);

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
            if (event.target === event.currentTarget) cerrar();
          }}
        >
          <ConectarFuente
            sources={sources}
            familia={familia}
            actoresSugeridos={actorPulsado ? [actorPulsado, ...actoresSugeridos.filter((item) => item !== actorPulsado)] : actoresSugeridos}
            papelInicial={papelInicial}
            elenco={elenco}
            renderCanal={renderCanal}
            fuenteAEditar={fuenteAEditar}
            onCerrar={cerrar}
            onStateChange={onStateChange}
          />
        </div>
      ), document.body) : null}
    </>
  );
}
