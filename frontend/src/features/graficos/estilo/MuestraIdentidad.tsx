// Muestra viva de Identidad (ID8 del rediseño, 2026-10-15): tres miniaturas que cambian con cada ajuste de la pestaña —
// la portada del PPT, una lámina con los colores de las respuestas y la portada y una página del Word—. No es el
// documento: es lo que la identidad elegida cambia, a la vista mientras se ajusta. Lo que cada salida recibe sigue la
// tabla «A qué salida llega»: desde ID9 (D5) logos y letra llegan al PPT y al Word.

import { GlifoGrafico } from "../iconos/GlifoGrafico";

export type LogoMuestra = { src: string | null; nombre: string };
export type DatosMuestra = {
  titulo: string;
  /** Desplazamiento del paso general de letra, en pt (0 Estándar, +2 Grande, +4 Muy grande). */
  desplazamientoPt: number;
  /** Los colores de una escala del plan, en orden (la muestra de la lámina); vacío = tonos genéricos. */
  colores: string[];
  respuestas: string[];
  logos: { izquierda: LogoMuestra; derecha: LogoMuestra };
};

/** Tamaño en la muestra: el del Word con el paso aplicado, nunca menos de 8 pt (como las cifras del motor). */
export const ptConPaso = (base: number, paso: number) => Math.max(8, base + paso);
const BARRAS = [[8, 17, 40, 25, 10], [6, 20, 37, 26, 11], [10, 7, 44, 25, 14]];

function Logo({ logo }: { logo: LogoMuestra }) {
  return logo.src ? <img src={logo.src} alt="" className="pulso-f6-muestra-logo-img" data-qa-geometry-capacity="owned" /> : <span className="pulso-f6-muestra-logo-texto">{logo.nombre}</span>;
}

export function MuestraIdentidad({ datos }: { datos: DatosMuestra }) {
  const n = Math.max(2, Math.min(5, datos.colores.length || 5));
  const colores = datos.colores.length ? datos.colores.slice(0, n) : [];
  const titulo = ptConPaso(18, datos.desplazamientoPt);
  const lectura = ptConPaso(10.5, datos.desplazamientoPt);
  const base = ptConPaso(8.5, datos.desplazamientoPt);
  return (
    <section className="pulso-f6-muestra" aria-label="Muestra de la identidad" data-qa-geometry-group="graficos/f6-muestra" data-qa-geometry-contract="intrinsic">
      <span className="pulso-f6-muestra-lab">Muestra en vivo</span>
      <div className="pulso-f6-muestra-fila" data-qa-geometry-group="graficos/f6-muestra-fila" data-qa-geometry-contract="intrinsic">
        <figure className="pulso-f6-muestra-pieza" data-qa-geometry-member>
          <figcaption>Portada del PPT</figcaption>
          <span className="pulso-f6-muestra-ppt-portada">
            <span className="pulso-f6-muestra-logos is-ppt" data-qa-geometry-group="graficos/f6-muestra-logos" data-qa-geometry-contract="intrinsic"><Logo logo={datos.logos.izquierda} /><Logo logo={datos.logos.derecha} /></span>
            <span className="pulso-f6-muestra-ppt-titulo">{datos.titulo}</span>
            <span className="pulso-f6-muestra-ppt-regla" />
          </span>
        </figure>
        <figure className="pulso-f6-muestra-pieza" data-qa-geometry-member>
          <figcaption>Lámina con tus colores</figcaption>
          <span className="pulso-f6-muestra-lamina">
            <span className="pulso-f6-muestra-lamina-ante" />
            <span className="pulso-f6-muestra-lamina-titulo">{datos.respuestas.length ? datos.respuestas.slice(0, 2).join(" / ") + "…" : "Una escala del informe"}</span>
            {BARRAS.map((fila, i) => (
              <span key={i} className="pulso-f6-muestra-barra" data-muestra-barra>
                {fila.slice(0, n).map((v, k) => <i key={k} style={{ flexGrow: v, background: colores[k] }} className={colores[k] ? "" : `is-tono-${k}`} />)}
              </span>
            ))}
          </span>
        </figure>
        <figure className="pulso-f6-muestra-pieza" data-qa-geometry-member>
          <figcaption>Portada y página del Word</figcaption>
          <span className="pulso-f6-muestra-word">
            <span className="pulso-f6-muestra-word-pag is-portada">
              <span className="pulso-f6-muestra-logos" data-qa-geometry-group="graficos/f6-muestra-logos" data-qa-geometry-contract="intrinsic"><Logo logo={datos.logos.izquierda} /><Logo logo={datos.logos.derecha} /></span>
              <span className="pulso-f6-muestra-word-titulo">{datos.titulo}</span>
            </span>
            <span className="pulso-f6-muestra-word-pag" data-letra-pt={lectura}>
              <span className="pulso-f6-muestra-word-h" style={{ fontSize: `${titulo * 0.42}px` }}>3.1. Resultados</span>
              <span className="pulso-f6-muestra-word-lab" style={{ fontSize: `${lectura * 0.42}px` }}>Gráfico 4</span>
              <span className="pulso-f6-muestra-word-q" style={{ fontSize: `${lectura * 0.42}px` }}>La pregunta en cursiva</span>
              <GlifoGrafico tipo="p_barras_multiapiladas" colores={colores} className="pulso-f6-muestra-glifo" />
              <span className="pulso-f6-muestra-word-base" style={{ fontSize: `${base * 0.42}px` }}>Base: 120 casos. Fuente: PULSO PUCP.</span>
            </span>
          </span>
          {datos.desplazamientoPt ? <small className="pulso-f6-muestra-nota">Letra +{datos.desplazamientoPt} pt: lectura a {lectura} pt</small> : null}
        </figure>
      </div>
    </section>
  );
}
