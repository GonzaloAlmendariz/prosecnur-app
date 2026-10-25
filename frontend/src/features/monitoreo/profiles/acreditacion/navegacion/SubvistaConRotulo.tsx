import type { ReactNode } from "react";
import { CabeceraDeTarjeta } from "./rotuloDePestana";
import { esSubvistaAnterior } from "./chipsDeCabecera";
import type { DireccionAcreditacion } from "./direccionAcreditacion";
import "../avance/avance.css";
import "./chromeAcreditacion.css";

/**
 * Las sub-vistas que todavía montan la vista anterior (Ritmo diario,
 * Recopiladores, Supervisión, Variables de control de Avance y de Modelo) van
 * en UNA tarjeta: el rótulo y el selector de sub-vistas son su cabecera (§2a-bis)
 * y la vista anterior es su cuerpo, sin su propio marco (`.acr-vista-anterior`
 * en chromeAcreditacion.css). La tarjeta toma su alto natural: el vacío bajo
 * una vista corta es fondo de página, no una tarjeta estirada.
 */
export function SubvistaConRotulo({ direccion, children }: { direccion: DireccionAcreditacion; children: ReactNode }) {
  if (!esSubvistaAnterior(direccion)) return <>{children}</>;
  return (
    <div className="acr-av-panel acr-subvista">
      <CabeceraDeTarjeta primera className="acr-subvista-cabecera">{null}</CabeceraDeTarjeta>
      <div className="acr-subvista-cuerpo acr-vista-anterior">{children}</div>
    </div>
  );
}
