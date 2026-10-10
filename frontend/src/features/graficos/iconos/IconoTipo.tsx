// Ícono por tipo de lámina o de gráfico (F6; requisito de Gonzalo del 2026-10-10). Punto único de uso en el editor
// nuevo. MARCADOR PROVISIONAL de F6.1: delega en `SlideTypeIcon` / `GraficadorTypeIcon` dentro de una caja fija
// size×size; la rebanada F6.1b reemplaza el interior por el sistema propio sin cambiar esta API ni la geometría (C2).

import { GraficadorTypeIcon } from "../GraficadorTypeIcon";
import { SlideTypeIcon } from "../SlideTypeIcon";
import type { SlideType } from "../../../api/graficos";

export type IconoTipoProps = {
  clase: "lamina" | "grafico";
  /** `p_slide_*` o `p_*` del registro. */
  tipo: string;
  size?: 16 | 20 | 24;
  /** Con título: `role="img"` y nombre accesible; sin él, decorativo. */
  titulo?: string;
  /** Sólo lámina, 1-based: la ranura que se pinta con el acento (lo usa F6.1b). */
  ranuraActiva?: number;
  className?: string;
};

export function IconoTipo({ clase, tipo, size = 20, titulo, className }: IconoTipoProps): JSX.Element {
  const dibujo = size === 16 ? 14 : size === 20 ? 16 : 18;
  return (
    <span
      className={["pulso-icono-tipo", className].filter(Boolean).join(" ")}
      data-icono-provisional="true"
      style={{ display: "inline-grid", placeItems: "center", flex: "none", width: size, height: size }}
      role={titulo ? "img" : undefined}
      aria-label={titulo}
      aria-hidden={titulo ? undefined : true}
    >
      {clase === "lamina"
        ? <SlideTypeIcon tipo={tipo as SlideType} size={dibujo} />
        : <GraficadorTypeIcon name={tipo} size={dibujo} />}
    </span>
  );
}
