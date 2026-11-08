// Escucha J, K, Enter y X mientras «Revisar emparejado» está abierto (teclado.ts). Sólo cuentan las teclas que nacen
// dentro del panel (o con el foco en ningún sitio); las del resto de la app no son suyas.

import { useEffect, useRef } from "react";
import { accionDeTecla, type AccionTecla } from "./teclado";

const PANEL = "[data-pulso-panel='emparejado'][data-state='open']";

export function useTecladoEmparejado(activo: boolean, onAccion: (accion: AccionTecla) => void): void {
  const ultima = useRef(onAccion);
  useEffect(() => { ultima.current = onAccion; });
  useEffect(() => {
    if (!activo) return;
    const alPulsar = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const objetivo = e.target instanceof Element ? e.target : null;
      // Con el panel cerrado no hay nada que escuchar, aunque el foco esté en el cuerpo de la página.
      const enPanel = !!objetivo?.closest(PANEL) || (objetivo === document.body && !!document.querySelector(PANEL));
      if (!enPanel) return;
      const accion = accionDeTecla(e, objetivo);
      if (!accion) return;
      e.preventDefault();
      ultima.current(accion);
    };
    document.addEventListener("keydown", alPulsar);
    return () => document.removeEventListener("keydown", alPulsar);
  }, [activo]);
}
