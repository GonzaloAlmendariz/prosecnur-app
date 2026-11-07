import type { CSSProperties } from "react";
import { PROSECNUR_ACTIVE_MODULES, moduleChromeVars } from "../lib/modules";
import { Skeleton } from "./Skeleton";
import "./vista-skeleton.css";

/**
 * Silueta de la vista que viene, para pintar detrás de un warm start en vez de
 * un lienzo vacío (Meta B, L23). Es decorativa: no anuncia nada a lectores de
 * pantalla —el indicador de carga sí lo hace— y no publica `data-audit-ready`,
 * porque no es la vista.
 *
 * 5 nov 2026 (Gonzalo: «el fondo de carga aún tiene tarjetas como módulos pero
 * puede tener más para que el fondo se vea más completo»): las dos siluetas
 * llenan la ventana entera. Antes la de inicio eran 8 tarjetas grises que
 * cubrían un tercio del alto; ahora es el Home: cabecera del proyecto, cifras,
 * una tarjeta por módulo activo con su tono y su ícono, y la franja de
 * actividad que baja hasta el borde. La de módulo suma el rail de pestañas y
 * sus paneles se estiran hasta abajo.
 *
 * Las piezas son el `Skeleton` del kit (un solo material y un solo brillo en
 * la app); este archivo sólo decide la composición.
 */
export type VistaSkeletonVariante = "modulo" | "inicio";

const FILAS_PANEL = 14;

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
          <div className="pulso-vista-skeleton-head-texto">
            <Skeleton className="pulso-sk is-ceja" />
            <Skeleton className="pulso-sk is-titulo is-grande" />
            <Skeleton className="pulso-sk is-linea is-media" />
          </div>
          <div className="pulso-vista-skeleton-head-acciones">
            <Skeleton className="pulso-sk is-herramienta" />
            <Skeleton className="pulso-sk is-herramienta is-corta" />
          </div>
        </div>
        <div className="pulso-vista-skeleton-kpis">
          {Array.from({ length: 4 }, (_, idx) => (
            <div className="pulso-vista-skeleton-kpi" key={idx}>
              <Skeleton className="pulso-sk is-linea is-corta" />
              <Skeleton className="pulso-sk is-cifra" />
            </div>
          ))}
        </div>
        <div className="pulso-vista-skeleton-cards">
          {PROSECNUR_ACTIVE_MODULES.map((modulo) => {
            const Icono = modulo.icon;
            return (
              <div className="pulso-vista-skeleton-card" key={modulo.slug} style={moduleChromeVars(modulo)}>
                <span className="pulso-vista-skeleton-card-icono">
                  <Icono size={18} strokeWidth={2} />
                </span>
                <Skeleton className="pulso-sk is-linea is-media" />
                <Skeleton className="pulso-sk is-linea is-corta" />
                <span className="pulso-vista-skeleton-card-avance" />
              </div>
            );
          })}
        </div>
        <div className="pulso-vista-skeleton-franja">
          <div className="pulso-vista-skeleton-panel">
            <Skeleton className="pulso-sk is-titulo" />
            {Array.from({ length: FILAS_PANEL }, (_, idx) => (
              <Skeleton className="pulso-sk is-fila" key={idx} />
            ))}
          </div>
          <div className="pulso-vista-skeleton-panel">
            <Skeleton className="pulso-sk is-titulo" />
            {Array.from({ length: FILAS_PANEL }, (_, idx) => (
              <Skeleton className="pulso-sk is-linea" key={idx} />
            ))}
          </div>
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
      <div className="pulso-vista-skeleton-cuerpo">
        <div className="pulso-vista-skeleton-rail">
          {Array.from({ length: 6 }, (_, idx) => (
            <Skeleton className={`pulso-sk is-rail${idx === 0 ? " is-activa" : ""}`} key={idx} />
          ))}
        </div>
        <div className="pulso-vista-skeleton-trabajo">
          <div className="pulso-vista-skeleton-kpis">
            {Array.from({ length: 4 }, (_, idx) => (
              <Skeleton className="pulso-sk is-kpi" key={idx} />
            ))}
          </div>
          <div className="pulso-vista-skeleton-body">
            <div className="pulso-vista-skeleton-panel">
              <Skeleton className="pulso-sk is-titulo" />
              {Array.from({ length: FILAS_PANEL }, (_, idx) => (
                <Skeleton className="pulso-sk is-fila" key={idx} />
              ))}
            </div>
            <div className="pulso-vista-skeleton-panel">
              <Skeleton className="pulso-sk is-titulo" />
              <Skeleton className="pulso-sk is-anillo" />
              <Skeleton className="pulso-sk is-linea" />
              <Skeleton className="pulso-sk is-linea is-corta" />
              {Array.from({ length: 6 }, (_, idx) => (
                <Skeleton className="pulso-sk is-linea" key={idx} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VistaSkeleton;
