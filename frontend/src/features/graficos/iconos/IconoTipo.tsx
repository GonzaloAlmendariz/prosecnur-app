// Ícono por tipo de lámina o de gráfico (F6.1b; requisito de Gonzalo del 2026-10-10): distingue el tipo donde hay
// poco espacio (fila de Estructura 20 px, cabecera del inspector 24, tarjeta de gráfico 20; barra del visor, tira,
// menús, selectores y avisos 16). Distinto de `ComposicionLamina` / `GlifoGrafico` (≥64 px).
//
// viewBox 24, trazo 1,5, todo en `currentColor` y un único acento que el contexto enciende (iconoTipo.css).
// Tipo desconocido → marco con ranura punteada; nunca lucide.

import { useId } from "react";
import { dibujoGrafico } from "./iconosGrafico";
import { dibujoLamina } from "./iconosLamina";
import { Marco, RanuraPunteada } from "./rasgosLamina";
import { VIEWBOX } from "./geometriaLamina";
import "./iconoTipo.css";

export type ClaseIcono = "lamina" | "grafico";

export type IconoTipoProps = {
  clase: ClaseIcono;
  /** `p_slide_*` o `p_*` del registro (o el preset `dicotomica`). */
  tipo: string;
  size?: 16 | 20 | 24;
  /** Con título: `role="img"` y nombre accesible; sin él, decorativo. */
  titulo?: string;
  /** Sólo lámina, 1-based entre las ranuras de gráfico: la que se pinta con el acento. */
  ranuraActiva?: number;
  className?: string;
};

/** Si el tipo tiene ícono propio o derivado (alias). Un `false` cae en el marco con ranura punteada. */
export function tieneIcono(clase: ClaseIcono, tipo: string): boolean {
  return (clase === "lamina" ? dibujoLamina(tipo) : dibujoGrafico(tipo)) !== null;
}

function cuerpo(clase: ClaseIcono, tipo: string, ranuraActiva: number | undefined): JSX.Element | null {
  if (clase === "lamina") {
    const dibujo = dibujoLamina(tipo);
    return dibujo ? dibujo({ ranuraActiva }) : null;
  }
  const dibujo = dibujoGrafico(tipo);
  return dibujo ? dibujo() : null;
}

/**
 * Lienzo a cualquier tamaño. Lo usan `IconoTipo` y el envoltorio heredado `SlideTypeIcon`, que todavía pide 12 px.
 */
export function SvgIconoTipo({ clase, tipo, px, titulo, ranuraActiva, className }: Omit<IconoTipoProps, "size"> & {
  px: number;
}): JSX.Element {
  const idTitulo = useId();
  const dibujo = cuerpo(clase, tipo, ranuraActiva);
  return (
    <svg
      width={px}
      height={px}
      viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
      fill="none"
      className={["pulso-icono-tipo", className].filter(Boolean).join(" ")}
      data-icono-clase={clase}
      data-icono-tipo={tipo}
      data-icono-desconocido={dibujo ? undefined : "true"}
      data-ranura-activa={clase === "lamina" && ranuraActiva ? ranuraActiva : undefined}
      role={titulo ? "img" : undefined}
      aria-labelledby={titulo ? idTitulo : undefined}
      aria-hidden={titulo ? undefined : true}
      focusable="false"
    >
      {titulo && <title id={idTitulo}>{titulo}</title>}
      {dibujo ?? (
        <>
          <Marco />
          <RanuraPunteada />
        </>
      )}
    </svg>
  );
}

export function IconoTipo({ size = 20, ...resto }: IconoTipoProps): JSX.Element {
  return <SvgIconoTipo px={size} {...resto} />;
}
