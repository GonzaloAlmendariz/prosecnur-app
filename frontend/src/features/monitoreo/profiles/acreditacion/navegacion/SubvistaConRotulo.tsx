import type { ReactNode } from "react";
import { CabeceraDeTarjeta } from "./rotuloDePestana";
import { esSubvistaAnterior } from "./chipsDeCabecera";
import type { DireccionAcreditacion } from "./direccionAcreditacion";
import "../avance/avance.css";
import "./chromeAcreditacion.css";

/**
 * Las sub-vistas que todavía montan la vista anterior (Ritmo diario,
 * Recopiladores, Supervisión, Variables de control de Avance y de Modelo) van
 * dentro de la tarjeta de contenido del workbench. Su rótulo y el selector de
 * sub-vistas ya no ocupan una fila propia sobre el fondo (§2a-bis): son la
 * cabecera de esa misma tarjeta.
 */
export function SubvistaConRotulo({ direccion, children }: { direccion: DireccionAcreditacion; children: ReactNode }) {
  if (!esSubvistaAnterior(direccion)) return <>{children}</>;
  return (
    <>
      <CabeceraDeTarjeta primera className="acr-subvista-cabecera">{null}</CabeceraDeTarjeta>
      {children}
    </>
  );
}
