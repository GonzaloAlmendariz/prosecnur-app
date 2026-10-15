// Word › Capítulos (W4 del rediseño, 2026-10-15): la apertura de capítulo (B número grande, A sobria; `.word_apertura`) y
// la entrada de cada capítulo. La variante va en `documento_word.apertura`; la entrada es la «Introducción en el Word» de
// su separador (`introduccion_word`, que el motor lleva como `word_intro`); vacía, el Word usa el subtítulo del separador.

import { useId } from "react";
import type { Slide } from "../../../api/graficos";
import { usePlanStore } from "../store";
import { CampoTexto } from "./DetalleDocumento";

const VARIANTES = [
  { clave: "B", nombre: "Número grande", detalle: "El número en azul claro, el título y la entrada." },
  { clave: "A", nombre: "Sobria", detalle: "Capítulo N en versalitas, el título y la entrada." },
] as const;

const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Los separadores que abren capítulo en el Word (no los subcapítulos: ésos son secciones N.M). */
export function capitulosDelPlan(slides: readonly Slide[]): { id: string; titulo: string; subtitulo: string; entrada: string }[] {
  return slides.flatMap((s) => {
    if (s.tipo !== "p_slide_seccion") return [];
    const p = (s.payload ?? {}) as Record<string, unknown>;
    const meta = (p.meta ?? {}) as Record<string, unknown>;
    const explicito = Number(meta.word_heading_level);
    const nivel = explicito >= 1 ? explicito : meta.nivel === "subcapitulo" ? 2 : 1;
    return nivel === 1 ? [{ id: s.id, titulo: texto(p.titulo) || "Capítulo", subtitulo: texto(p.subtitulo), entrada: texto(p.introduccion_word) }] : [];
  });
}

export function DetalleCapitulos() {
  const nombre = useId();
  const dw = usePlanStore((s) => s.documentoWord);
  const setDw = usePlanStore((s) => s.setDocumentoWord);
  const slides = usePlanStore((s) => s.plan.slides);
  const actualizar = usePlanStore((s) => s.updateSlidePayload);
  const variante = dw.apertura ?? "B";
  const capitulos = capitulosDelPlan(slides);
  return (
    <>
      <section className="pulso-f6-informe-seccion" aria-label="Apertura de capítulo" data-qa-geometry-member data-seccion="word-capitulos">
        <h3 className="pulso-f6-w-titulo">Apertura de capítulo</h3>
        <div className="pulso-f6-w-variantes is-dos" role="radiogroup" aria-label="Apertura de capítulo">
          {VARIANTES.map((v) => (
            <label key={v.clave} className={`pulso-f6-w-variante${variante === v.clave ? " is-activa" : ""}`}>
              <input type="radio" className="pulso-sr-only" name={nombre} value={v.clave} checked={variante === v.clave} onChange={() => setDw({ ...dw, apertura: v.clave })} />
              <span className={`pulso-f6-w-variante-mini is-ap-${v.clave.toLowerCase()}`} aria-hidden="true"><i /><i /><i /></span>
              <b>{v.nombre}</b>
              <small>{v.detalle}</small>
            </label>
          ))}
        </div>
      </section>
      <section className="pulso-f6-informe-seccion" aria-label="Entrada de cada capítulo" data-qa-geometry-member data-seccion="word-entradas">
        <h3 className="pulso-f6-w-titulo">Entrada de cada capítulo</h3>
        <p className="pulso-f6-informe-ayuda">Va debajo del título del capítulo. Vacía, el Word usa el subtítulo de su separador.</p>
        {capitulos.length === 0 ? (
          <p className="pulso-f6-informe-ayuda">El informe todavía no tiene separadores de capítulo: los resultados van en un capítulo de Resultados, sin entrada.</p>
        ) : (
          <div className="pulso-f6-w-entradas">
            {capitulos.map((c) => (
              <CampoTexto key={c.id} etiqueta={c.titulo} valor={c.entrada} placeholder={c.subtitulo || "Sin entrada"} max={400}
                ayuda={c.subtitulo ? "Vacía, el subtítulo del separador." : "Vacía, el capítulo abre sin entrada."}
                onGuardar={(v) => actualizar(c.id, { introduccion_word: v })} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
