import type { CSSProperties } from "react";
import { FormasGlifo } from "./Glifo";
import { GLIFOS_TIPO, GLIFO_DESCONOCIDO } from "./glifosTipo";
import { TONO_FAMILIA, esCierre, tipoPregunta } from "./tiposPregunta";
import "./sello.css";

// Sello del tipo de pregunta (identidad «Señales», propuesta aprobada 2026-10-17): la silueta del glifo sobre el
// color pleno de su familia, en un cuadro redondeado. El cierre de sección o repetición va en suave (el mismo tono
// al 15 % con borde), así cada par [ ] se lee de un vistazo. `size` es el lado del cuadro en píxeles.

/** Proporción glifo / cuadro de la propuesta (cuadro = glifo × 1,45). */
const ESCALA_GLIFO = 1 / 1.45;

export type SelloProps = {
  baseType: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
  /** Nombre accesible. Sin él el sello es decorativo (aria-hidden): casi siempre lo acompaña el nombre del tipo. */
  title?: string;
  /** Posición dentro de otro <svg> (la maqueta anida el sello en su lienzo). */
  x?: number;
  y?: number;
};

export function glifoDeTipo(baseType: string) {
  return GLIFOS_TIPO[tipoPregunta(baseType).base] ?? GLIFO_DESCONOCIDO;
}

export function Sello({ baseType, size = 18, className, style, title, x, y }: SelloProps) {
  const tipo = tipoPregunta(baseType);
  const cierre = esCierre(tipo.base);
  const vars = { "--xfk-c": TONO_FAMILIA[tipo.familia], ...style } as CSSProperties;
  const t = `translate(12 12) scale(${ESCALA_GLIFO.toFixed(4)}) translate(-12 -12)`;
  return (
    <svg
      className={`xfk-sello xfk-glifo${cierre ? " is-cierre" : ""}${className ? ` ${className}` : ""}`}
      x={x}
      y={y}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={vars}
      data-tipo={tipo.base}
      data-familia={tipo.familia}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {cierre
        ? <rect className="xfk-sello__fondo" x={0.8} y={0.8} width={22.4} height={22.4} rx={5.6} />
        : <rect className="xfk-sello__fondo" x={0} y={0} width={24} height={24} rx={6.24} />}
      <g transform={t}><FormasGlifo formas={glifoDeTipo(tipo.base)} /></g>
    </svg>
  );
}
