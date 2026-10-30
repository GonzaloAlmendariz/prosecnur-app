import type { ReactNode } from "react";
import type { CapaLienzo } from "./LienzoMapa";
import { MapPinned } from "../../../../vendor/lucide-react";

/**
 * Miga y leyenda del lienzo por sección (brechas B6 y B8). La miga dice dónde está
 * el usuario y qué puede hacer; la leyenda, qué significa cada color de la sección.
 * Los colores salen de los mismos tokens que pinta el lienzo.
 */
// La misma secuencia que pinta la población en el lienzo (nombres literales: el
// contrato de tokens no lee nombres armados).

export type SeccionLienzo = "territorio" | "poblacion" | "muestra" | "manzanas" | "seleccion";

/** Cómo se nombra el territorio del estudio en la miga (checklist F6): las ciudades, no un «Lima» fijo. */
export function nombreDelTerritorio(ciudades: readonly string[]): string {
  if (!ciudades.length) return "Sin ciudades";
  if (ciudades.length <= 2) return ciudades.join(", ");
  return `${ciudades.length} ciudades`;
}

export function migaLienzo(seccion: SeccionLienzo, distritos: number, foco: { distrito: string; ump: string } | null, ciudades: readonly string[] = []): ReactNode {
  const icono = <MapPinned size={14} aria-hidden="true" />;
  const donde = nombreDelTerritorio(ciudades);
  if (seccion === "seleccion" && foco) return <>{icono} <b>{foco.distrito}</b> · {foco.ump}</>;
  if (seccion === "territorio") return <>{icono} <b>{donde}</b><span className="hr-lienzo-miga-ayuda"> · clic en un distrito para ver su ficha</span></>;
  return <>{icono} <b>{donde}</b> · {distritos ? `${distritos} distrito${distritos === 1 ? "" : "s"}` : "sin distritos confirmados"}</>;
}

const muestra = (fondo: string, borde?: string, punteado = false) => (
  <i style={{ background: fondo, border: borde ? `1.5px ${punteado ? "dashed" : "solid"} ${borde}` : undefined }} />
);

const CAPAS: [CapaLienzo, string][] = [["manzanas", "Manzanas"], ["viviendas", "Viviendas"], ["nse", "NSE"]];

/** Secciones donde las manzanas pueden pintarse por viviendas o NSE (como en el artefacto). */
export const conSelectorDeCapa = (seccion: SeccionLienzo) => seccion === "territorio" || seccion === "manzanas" || seccion === "seleccion";

export function SelectorCapa({ capa, onCapa }: { capa: CapaLienzo; onCapa: (c: CapaLienzo) => void }) {
  return (
    <div className="hr-lienzo-capas" role="group" aria-label="Capa del mapa">
      {CAPAS.map(([id, label]) => (
        <button key={id} type="button" aria-pressed={capa === id} onClick={() => onCapa(id)}>{label}</button>
      ))}
    </div>
  );
}

// Escalones de viviendas (nivelDensidad: 0, <12, <24, <48, <96, <192, 192+) y niveles NSE
// (el código va al revés: 1 = Alto … 5 = Bajo; 0 = sin dato). Nombres literales de tokens.
const RAMPA_VIVIENDAS = ["--pulso-surface", "--pulso-mapa-viv-1", "--pulso-mapa-viv-2", "--pulso-mapa-viv-3", "--pulso-mapa-viv-4", "--pulso-mapa-viv-5", "--pulso-mapa-viv-6"];
const NSE: [string, string][] = [["Alto", "--pulso-nse-1"], ["Medio alto", "--pulso-nse-2"], ["Medio", "--pulso-nse-3"], ["Medio bajo", "--pulso-nse-4"], ["Bajo", "--pulso-nse-5"], ["Sin dato", "--pulso-nse-0"]];

export function leyendaLienzo(seccion: SeccionLienzo, opciones: { zonasCortas?: boolean; areas?: boolean; capa?: CapaLienzo } = {}): ReactNode {
  const acento = "var(--pulso-module-routes)";
  if (opciones.capa === "viviendas" && conSelectorDeCapa(seccion)) {
    return (
      <>
        <span>Viviendas por manzana</span>
        <span className="hr-lienzo-rampa" aria-hidden="true">
          {RAMPA_VIVIENDAS.map((t) => <i key={t} style={{ background: `var(${t})`, border: t === "--pulso-surface" ? "1px solid var(--pulso-border)" : undefined }} />)}
        </span>
        <span>0 → 192+</span>
      </>
    );
  }
  if (opciones.capa === "nse" && conSelectorDeCapa(seccion)) {
    return <>{NSE.map(([l, t]) => <span key={t}>{muestra(`var(${t})`)}{l}</span>)}</>;
  }
  if (seccion === "territorio") {
    return (
      <>
        <span>{muestra("color-mix(in srgb, var(--pulso-mapa-tono-0) 42%, var(--pulso-mapa-distrito))")}En el estudio</span>
        <span>{muestra(`color-mix(in srgb, ${acento} 30%, var(--pulso-mapa-distrito))`, acento, true)}Se agrega</span>
        <span>{muestra("var(--pulso-mapa-fondo)", acento)}Se quita</span>
      </>
    );
  }
  if (seccion === "muestra" || seccion === "poblacion") return <span>Cada distrito del estudio lleva su color</span>;
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
