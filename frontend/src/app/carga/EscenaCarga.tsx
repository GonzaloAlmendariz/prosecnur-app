import { useEffect, useMemo, useState } from "react";
import { CICLO_MS } from "./escenasMotor";
import { ESCENAS_CARGA, type ClaveEscenas } from "./escenasCarga";

/**
 * Una escena de carga en bucle: se arma, se sostiene y se funde, y vuelve a empezar. El SVG es decorativo y lo
 * generamos nosotros (sin datos del usuario), por eso se inserta como marcado. Cada vuelta remonta el nodo (`key`)
 * para que las animaciones CSS empiecen de nuevo.
 */
const PAUSA_MS = 400;

export function EscenaCarga({ clave, indice, className }: { clave: ClaveEscenas; indice: number; className?: string }) {
  const [vuelta, setVuelta] = useState(0);
  const [cierra, setCierra] = useState(false);
  const escena = ESCENAS_CARGA[clave][indice] ?? ESCENAS_CARGA[clave][0];
  // `vuelta` regenera el SVG (ids de patrones nuevos) en cada ciclo.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const marcado = useMemo(() => `<svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid meet">${escena.svg()}</svg>`, [escena, vuelta]);

  useEffect(() => {
    setCierra(false);
    const cerrar = window.setTimeout(() => setCierra(true), CICLO_MS * 0.92 + PAUSA_MS);
    const repetir = window.setTimeout(() => setVuelta((v) => v + 1), CICLO_MS + PAUSA_MS);
    return () => {
      window.clearTimeout(cerrar);
      window.clearTimeout(repetir);
    };
  }, [escena, vuelta]);

  return (
    <div
      key={vuelta}
      className={["escena-carga", cierra ? "is-cierra" : null, className].filter(Boolean).join(" ")}
      data-escena={`${clave}/${escena.id}`}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: marcado }}
    />
  );
}

export default EscenaCarga;
