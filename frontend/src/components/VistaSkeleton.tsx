import type { CSSProperties } from "react";
import { Skeleton } from "./Skeleton";
import "./vista-skeleton.css";

/**
 * Silueta de la vista que viene, para pintar detrás de un warm start en vez de
 * un lienzo vacío (Meta B, L23). Es decorativa: no anuncia nada a lectores de
 * pantalla —el indicador de carga sí lo hace— y no publica `data-audit-ready`,
 * porque no es la vista.
 *
 * - `modulo`: cabecera, barra de secciones, fila de cifras y dos paneles; la
 *   geometría común de las vistas de trabajo (p. ej. Monitoreo › Avance).
 * - `inicio`: cabecera del proyecto y la grilla de tarjetas del Home.
 *
 * Las piezas son el `Skeleton` del kit (un solo material y un solo brillo en
 * la app); este archivo sólo decide la composición.
 */
export type VistaSkeletonVariante = "modulo" | "inicio";

export function VistaSkeleton({
  variante = "modulo",
  secciones = 5,
  className,
  style,
}: {
  variante?: VistaSkeletonVariante;
  secciones?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const clase = ["pulso-vista-skeleton", `is-${variante}`, className].filter(Boolean).join(" ");
  if (variante === "inicio") {
    return (
      <div className={clase} style={style} aria-hidden="true" data-vista-skeleton="inicio">
        <div className="pulso-vista-skeleton-head">
          <Skeleton className="pulso-sk is-titulo" />
          <Skeleton className="pulso-sk is-linea" />
        </div>
        <div className="pulso-vista-skeleton-cards">
          {Array.from({ length: 8 }, (_, idx) => (
            <div className="pulso-vista-skeleton-card" key={idx}>
              <Skeleton className="pulso-sk is-icono" />
              <Skeleton className="pulso-sk is-linea" />
              <Skeleton className="pulso-sk is-linea is-corta" />
            </div>
          ))}
        </div>
      </div>
    );
  }
  const pills = Math.max(1, Math.min(8, Math.round(secciones)));
  return (
    <div className={clase} style={style} aria-hidden="true" data-vista-skeleton="modulo">
      <div className="pulso-vista-skeleton-bar">
        <Skeleton className="pulso-sk is-marca" />
        <div className="pulso-vista-skeleton-pills">
          {Array.from({ length: pills }, (_, idx) => (
            <Skeleton className={`pulso-sk is-pill${idx === 0 ? " is-activa" : ""}`} key={idx} />
          ))}
        </div>
        <Skeleton className="pulso-sk is-herramienta" />
      </div>
      <div className="pulso-vista-skeleton-kpis">
        {Array.from({ length: 4 }, (_, idx) => (
          <Skeleton className="pulso-sk is-kpi" key={idx} />
        ))}
      </div>
      <div className="pulso-vista-skeleton-body">
        <div className="pulso-vista-skeleton-panel">
          <Skeleton className="pulso-sk is-titulo" />
          {Array.from({ length: 6 }, (_, idx) => (
            <Skeleton className="pulso-sk is-fila" key={idx} />
          ))}
        </div>
        <div className="pulso-vista-skeleton-panel">
          <Skeleton className="pulso-sk is-titulo" />
          <Skeleton className="pulso-sk is-anillo" />
          <Skeleton className="pulso-sk is-linea" />
          <Skeleton className="pulso-sk is-linea is-corta" />
        </div>
      </div>
    </div>
  );
}

export default VistaSkeleton;
