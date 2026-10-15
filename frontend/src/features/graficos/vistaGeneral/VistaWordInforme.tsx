// Vista Word del Informe (I11 del rediseño, 2026-10-14; D2): las páginas del documento como MAQUETAS, con la convención
// del recetario Word —encabezado corrido, títulos numerados, cada gráfico sin marco con «Gráfico N», la pregunta en
// cursiva encima y la base y la fuente al pie— y los glifos de la app. No es el Word: el documento con sus cifras se ve
// en la pestaña Word con «Previsualizar». Las páginas salen de `paginasWord` (puro).

import { useMemo } from "react";
import type { Slide } from "../../../api/graficos";
import { GlifoGrafico } from "../iconos/GlifoGrafico";
import { baseAutomatica, ranurasDeMaqueta } from "../laminas/modeloMaqueta";
import { usePlanStore } from "../store";
import { useVariables } from "../useVariables";
import { paginasWord, tituloCortoWord, type ElementoWord, type PaginaWord } from "./paginasWord";

const FUENTE = "Fuente: PULSO PUCP.";

/** Las páginas las arma una vez VistaGeneral (`useArmadoWord`), que también cuenta páginas y gráficos para la barra. */
type Props = { paginas: readonly PaginaWord[] };

const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const ESCALAS = new Set(["p_barras_apiladas", "p_barras_multiapiladas"]);

/** El plan, en orden, como lo recorre `.word_documento`: secciones, textos, tablas, gráficos y franjas de cifras. */
export function useArmadoWord(slides: readonly Slide[]) {
  const { variables } = useVariables();
  const presets = usePlanStore((s) => s.presets);
  const paletas = usePlanStore((s) => s.paletas);
  const vinculos = usePlanStore((s) => s.paletasVinculos);
  // W2: «Cómo leer» decidido en Word › Documento (ausente = si hay escalas, como el motor).
  const comoLeer = usePlanStore((s) => s.documentoWord.como_leer);
  return useMemo(() => {
    const elementos: ElementoWord[] = [];
    let tituloInforme = "";
    let hayEscalas = false;
    let hayBottom = false;
    let conTablas = false;
    for (const slide of slides) {
      const payload = (slide.payload ?? {}) as Record<string, unknown>;
      const meta = (payload.meta ?? {}) as Record<string, unknown>;
      if (slide.tipo === "p_slide_portada") { tituloInforme ||= texto(payload.titulo); continue; }
      if (slide.tipo === "p_slide_seccion") {
        // Como `.word_nivel_seccion`: el nivel explícito manda; si no, un subcapítulo es sección N.M (decisión 2026-10-15).
        const explicito = Number(meta.word_heading_level);
        const nivel = explicito >= 1 ? (explicito >= 2 ? 2 : 1) : meta.nivel === "subcapitulo" ? 2 : 1;
        elementos.push({ clase: "seccion", nivel, titulo: texto(payload.titulo) });
        continue;
      }
      if (slide.tipo === "p_slide_texto") { elementos.push({ clase: "texto", titulo: texto(payload.titulo) }); continue; }
      if (slide.tipo === "p_slide_tabla_tecnica") { conTablas = true; elementos.push({ clase: "tabla", titulo: texto(payload.titulo) }); continue; }
      const ranuras = ranurasDeMaqueta(slide, variables, presets, { paletas, vinculos }).filter((r) => r.graficador);
      // Con un gráfico la base es la de la lámina; con varios, cada uno lleva la suya y aquí no se inventa.
      const base = baseAutomatica(slide, variables);
      let cifras = false;
      for (const r of ranuras) {
        if (r.graficador === "p_cifra") { if (!cifras) elementos.push({ clase: "cifras" }); cifras = true; continue; }
        if (ESCALAS.has(r.graficador as string)) hayEscalas = true;
        if (r.twoBox.btb) hayBottom = true;
        elementos.push({ clase: "grafico", graficador: r.graficador as string, pregunta: r.pregunta ?? "Sin pregunta", base });
      }
    }
    return paginasWord(elementos, { tituloInforme: tituloInforme || "Informe", hayEscalas, hayBottom, conTablas, comoLeer });
  }, [slides, variables, presets, paletas, vinculos, comoLeer]);
}

export function VistaWordInforme({ paginas }: Props) {
  const dado = usePlanStore((s) => s.documentoWord.titulo_corto);
  const tituloCorto = tituloCortoWord(paginas[0]?.clase === "portada" ? paginas[0].titulo : "Informe", dado);
  return (
    <div className="pulso-f6-vg-word" data-qa-geometry-group="graficos/f6-vg-word" data-qa-geometry-contract="equal">
      <div className="pulso-f6-vg-paginas">
        {paginas.map((p, i) => <PaginaMaqueta key={i} pagina={p} tituloCorto={tituloCorto} />)}
      </div>
      <p className="pulso-f6-vg-word-nota">
        Maquetas de página con la convención del recetario Word. El Word con sus cifras: pestaña Word › «Previsualizar».
      </p>
    </div>
  );
}

export function PaginaMaqueta({ pagina, tituloCorto }: { pagina: PaginaWord; tituloCorto: string }) {
  const cabeza = (seccion: string) => (
    <span className="pulso-f6-vg-pag-enc"><span>{tituloCorto}</span><b>{seccion}</b></span>
  );
  return (
    <span className={`pulso-f6-vg-pagina-caja`} data-qa-geometry-member>
      <span className={`pulso-f6-vg-pagina is-${pagina.clase}`}>
        {pagina.clase === "portada" && (<>
          <span className="pulso-f6-vg-pag-logos"><span>PUCP</span><span>PULSO PUCP</span></span>
          <span className="pulso-f6-vg-pag-portada">
            <span className="pulso-f6-vg-pag-k">Informe de resultados</span>
            <span className="pulso-f6-vg-pag-t">{pagina.titulo}</span>
            <span className="pulso-f6-vg-pag-regla" />
          </span>
          <span className="pulso-f6-vg-pag-pie"><b>PULSO PUCP</b></span>
        </>)}
        {pagina.clase === "indice" && (<>
          {cabeza("Contenido")}
          <span className="pulso-f6-vg-pag-h1">Contenido</span>
          <span className="pulso-f6-vg-pag-toc">
            {pagina.entradas.map((e, i) => (
              <span key={i} className={`pulso-f6-vg-pag-toc-e is-n${e.nivel}`}><span>{e.numero}</span>{e.titulo}<i /></span>
            ))}
          </span>
          {pagina.indices.map((t) => <span key={t} className="pulso-f6-vg-pag-h2 is-indice">{t}</span>)}
        </>)}
        {pagina.clase === "como-leer" && (<>
          {cabeza("Cómo leer este informe")}
          <span className="pulso-f6-vg-pag-h1">{pagina.numero}. Cómo leer este informe</span>
          {pagina.secciones.map((t, i) => (
            <span key={t} className="pulso-f6-vg-pag-sub">
              <span className="pulso-f6-vg-pag-h3">{pagina.numero}.{i + 1}. {t}</span>
              <span className="pulso-f6-vg-pag-ln" style={{ width: `${[94, 86, 90, 80, 92, 84][i % 6]}%` }} />
            </span>
          ))}
          <span className="pulso-f6-vg-pag-ejemplos">Gráficos de ejemplo: {pagina.figuras.map((n) => `Gráfico ${n}`).join(", ")}</span>
        </>)}
        {pagina.clase === "capitulo" && (<>
          {cabeza(pagina.encabezado)}
          {pagina.titulos.map((t, i) => <span key={i} className={/^\d+\. /.test(t) ? "pulso-f6-vg-pag-h1" : "pulso-f6-vg-pag-h2"}>{t}</span>)}
          {pagina.texto && [96, 92, 88, 60].map((w, i) => <span key={i} className="pulso-f6-vg-pag-ln" style={{ width: `${w}%` }} />)}
          {pagina.figuras.map((f) => (
            <span key={f.numero} className="pulso-f6-vg-fig">
              <span className="pulso-f6-vg-fig-lab">Gráfico {f.numero}</span>
              <span className="pulso-f6-vg-fig-q">{f.pregunta}</span>
              <GlifoGrafico tipo={f.graficador} className="pulso-f6-vg-fig-gl" />
              <span className="pulso-f6-vg-fig-nt">{f.base ? `${f.base}. ` : ""}{FUENTE}</span>
            </span>
          ))}
        </>)}
        {pagina.clase === "contraportada" && (
          <span className="pulso-f6-vg-pag-contra"><b>PULSO PUCP</b><span>Contacto</span></span>
        )}
        {"folio" in pagina && <span className="pulso-f6-vg-pag-folio">{pagina.folio}</span>}
      </span>
    </span>
  );
}
