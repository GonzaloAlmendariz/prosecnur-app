import type { ReactNode } from "react";
import { MapPinned } from "../../../../vendor/lucide-react";

/**
 * Miga y leyenda del lienzo por sección (brechas B6 y B8). La miga dice dónde está
 * el usuario y qué puede hacer; la leyenda, qué significa cada color de la sección.
 * Los colores salen de los mismos tokens que pinta el lienzo.
 */
export type SeccionLienzo = "territorio" | "poblacion" | "muestra" | "manzanas" | "seleccion";

export function migaLienzo(seccion: SeccionLienzo, distritos: number, foco: { distrito: string; ump: string } | null): ReactNode {
  const icono = <MapPinned size={14} aria-hidden="true" />;
  if (seccion === "seleccion" && foco) return <>{icono} <b>{foco.distrito}</b> · {foco.ump}</>;
  if (seccion === "territorio") return <>{icono} <b>Lima y Callao</b> · clic en un distrito para elegirlo</>;
  return <>{icono} <b>Lima</b> · {distritos ? `${distritos} distrito${distritos === 1 ? "" : "s"}` : "sin distritos confirmados"}</>;
}

const muestra = (fondo: string, borde?: string, punteado = false) => (
  <i style={{ background: fondo, border: borde ? `1.5px ${punteado ? "dashed" : "solid"} ${borde}` : undefined }} />
);

export function leyendaLienzo(seccion: SeccionLienzo, opciones: { zonasCortas?: boolean; areas?: boolean } = {}): ReactNode {
  const acento = "var(--pulso-module-routes)";
  if (seccion === "territorio") {
    return (
      <>
        <span>{muestra(`color-mix(in srgb, ${acento} 22%, var(--pulso-mapa-distrito))`)}En el estudio</span>
        <span>{muestra("var(--pulso-mapa-distrito)", acento, true)}Se agrega</span>
        <span>{muestra("var(--pulso-mapa-fondo)", acento)}Se quita</span>
      </>
    );
  }
  if (seccion === "poblacion") {
    return (
      <>
        <span>Población objetivo</span>
        <span className="hr-lienzo-rampa" aria-hidden="true">
          {[0, 1, 2, 3, 4, 5].map((i) => <i key={i} style={{ background: `var(--pulso-data-seq-${i})` }} />)}
        </span>
        <span>menos → más</span>
      </>
    );
  }
  if (seccion === "muestra") return <span>{muestra("var(--pulso-data-seq-1)", "var(--pulso-mapa-distrito-borde)")}Distritos del estudio</span>;
  if (seccion === "manzanas") {
    return (
      <>
        <span>{muestra(acento)}UMP titular</span>
        {opciones.zonasCortas ? <span>{muestra("transparent", "var(--pulso-warn-accent)")}Zona que no alcanza</span> : null}
        {opciones.areas ? <span>{muestra(`color-mix(in srgb, ${acento} 14%, transparent)`, acento, true)}Área excluida</span> : null}
      </>
    );
  }
  return (
    <>
      <span>{muestra(acento)}Titular</span>
      <span>{muestra("var(--pulso-warn-accent)")}Por revisar</span>
      <span>{muestra("var(--pulso-danger-fg)")}Sin viviendas</span>
      <span>{muestra("var(--pulso-mapa-reemplazo)", "var(--pulso-mapa-reemplazo-borde)", true)}Reemplazo</span>
    </>
  );
}
