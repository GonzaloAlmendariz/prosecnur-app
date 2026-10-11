// Glifo de un tipo de gráfico (F6.2; dirección F6 §4.4): el dibujo propio del gráfico en 16:10, con la paleta vigente
// (glifoGrafico.css), para las tarjetas y el detalle del selector «¿Qué gráfico?» y para las ranuras de
// `ComposicionLamina`. No es una captura ni un ícono agrandado: los íconos de 16–24 px viven en IconoTipo.

import { useId } from "react";
import { dibujoGlifo, GLIFO, type OpcionesGlifo } from "./glifosGrafico";
import "./glifoGrafico.css";

/** El dibujo sin su `<svg>`, en el espacio 160 × 100; un tipo desconocido es una ranura punteada. */
export function CuerpoGlifo({ tipo, opciones }: { tipo: string; opciones?: OpcionesGlifo }): JSX.Element {
  const dibujo = dibujoGlifo(tipo);
  if (dibujo) return dibujo(opciones);
  return <rect x={40} y={22} width={80} height={56} rx={4} className="pulso-glifo__desconocido" />;
}

export type GlifoGraficoProps = {
  /** `p_*` del registro. */
  tipo: string;
  /** Con título: `role="img"` y nombre accesible; sin él, decorativo. */
  titulo?: string;
  className?: string;
  /** Lo que el dibujo refleja del gráfico real (columnas Top/Bottom Two Box). */
  opciones?: OpcionesGlifo;
};

export function GlifoGrafico({ tipo, titulo, className, opciones }: GlifoGraficoProps): JSX.Element {
  const idTitulo = useId();
  return (
    <svg
      viewBox={`0 0 ${GLIFO.w} ${GLIFO.h}`}
      className={["pulso-glifo", className].filter(Boolean).join(" ")}
      data-glifo-tipo={tipo}
      data-glifo-desconocido={dibujoGlifo(tipo) ? undefined : "true"}
      role={titulo ? "img" : undefined}
      aria-labelledby={titulo ? idTitulo : undefined}
      aria-hidden={titulo ? undefined : true}
      focusable="false"
    >
      {titulo && <title id={idTitulo}>{titulo}</title>}
      <CuerpoGlifo tipo={tipo} opciones={opciones} />
    </svg>
  );
}
