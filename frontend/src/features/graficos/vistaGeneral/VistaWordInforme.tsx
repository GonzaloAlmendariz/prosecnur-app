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
import type { FilaVistaGeneral } from "./modeloVistaGeneral";
import { paginasWord, type GraficosDeLamina, type PaginaWord } from "./paginasWord";

const FUENTE = "Fuente: PULSO PUCP.";

type Props = { filas: readonly FilaVistaGeneral[]; slides: readonly Slide[] };

export function useArmadoWord(filas: readonly FilaVistaGeneral[], slides: readonly Slide[]) {
  const { variables } = useVariables();
  const presets = usePlanStore((s) => s.presets);
  const paletas = usePlanStore((s) => s.paletas);
  const vinculos = usePlanStore((s) => s.paletasVinculos);
  return useMemo(() => {
    const graficos = new Map<string, { graficador: string; pregunta: string; base: string | null }[]>();
    for (const slide of slides) {
      const ranuras = ranurasDeMaqueta(slide, variables, presets, { paletas, vinculos }).filter((r) => r.graficador);
      if (!ranuras.length) continue;
      // Con un gráfico la base es la de la lámina; con varios, cada uno lleva la suya y aquí no se inventa.
      const base = baseAutomatica(slide, variables);
      graficos.set(slide.id, ranuras.map((r) => ({ graficador: r.graficador as string, pregunta: r.pregunta ?? "Sin pregunta", base })));
    }
    const portada = slides.find((s) => s.tipo === "p_slide_portada");
    const titulo = typeof (portada?.payload as Record<string, unknown> | undefined)?.titulo === "string"
      ? ((portada?.payload as Record<string, unknown>).titulo as string).trim() : "";
    return paginasWord(filas, graficos as GraficosDeLamina, titulo || "Informe");
  }, [filas, slides, variables, presets, paletas, vinculos]);
}

export function VistaWordInforme({ filas, slides }: Props) {
  const paginas = useArmadoWord(filas, slides);
  const tituloCorto = paginas[0]?.clase === "portada" ? paginas[0].titulo : "Informe";
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

function PaginaMaqueta({ pagina, tituloCorto }: { pagina: PaginaWord; tituloCorto: string }) {
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
        </>)}
        {pagina.clase === "texto" && (<>
          {cabeza(pagina.encabezado)}
          <span className="pulso-f6-vg-pag-h1">{pagina.titulo}</span>
          {[96, 92, 88, 60, 0, 94, 90, 72].map((w, i) => (w ? <span key={i} className="pulso-f6-vg-pag-ln" style={{ width: `${w}%` }} /> : <span key={i} className="pulso-f6-vg-pag-sep" />))}
        </>)}
        {pagina.clase === "graficos" && (<>
          {cabeza(pagina.encabezado)}
          {pagina.titulos.map((t, i) => <span key={i} className={i === 0 && /^\d+\. /.test(t) && !/^\d+\.\d/.test(t) ? "pulso-f6-vg-pag-h1" : "pulso-f6-vg-pag-h2"}>{t}</span>)}
          {pagina.titulos.length > 0 && <><span className="pulso-f6-vg-pag-ln" style={{ width: "94%" }} /><span className="pulso-f6-vg-pag-ln" style={{ width: "58%" }} /></>}
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
