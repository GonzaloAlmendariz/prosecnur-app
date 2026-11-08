import type { ReactNode } from "react";

/**
 * R6-9: el rótulo y su «?» en un solo bloque de texto, con la última palabra pegada al «?». En el rótulo (inline-flex)
 * el texto suelto era su propio ítem: al partirse en dos líneas ocupaba todo el ancho y el «?» quedaba despegado, a la
 * derecha de la caja. Así el «?» sigue a la última palabra y baja con ella.
 */
export function rotuloConAyuda(rotulo: string, ayuda: ReactNode): ReactNode {
  if (!ayuda) return rotulo;
  const corte = rotulo.trimEnd().lastIndexOf(" ");
  return (
    <span className="pulso-f6-rotulo-texto">
      {corte > 0 ? rotulo.slice(0, corte + 1) : null}
      <span style={{ whiteSpace: "nowrap" }}>{corte > 0 ? rotulo.slice(corte + 1).trimEnd() : rotulo.trimEnd()}{"\u00a0"}{ayuda}</span>
    </span>
  );
}
