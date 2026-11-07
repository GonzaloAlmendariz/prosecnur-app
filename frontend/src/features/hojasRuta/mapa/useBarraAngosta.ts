import { useEffect, useState } from "react";

/**
 * B4: bajo 1280 px de ventana la barra del lienzo no cabe con secciones, chips y
 * acciones a la vez; el ModuleCommandBar se pide en densidad «compact» (rótulos cortos).
 */
const CONSULTA = "(max-width: 1279px)";

export function useBarraAngosta(): boolean {
  const [angosta, setAngosta] = useState(() => typeof window !== "undefined" && Boolean(window.matchMedia?.(CONSULTA).matches));
  useEffect(() => {
    const mq = window.matchMedia?.(CONSULTA);
    if (!mq) return;
    const alCambiar = () => setAngosta(mq.matches);
    alCambiar();
    mq.addEventListener("change", alCambiar);
    return () => mq.removeEventListener("change", alCambiar);
  }, []);
  return angosta;
}
