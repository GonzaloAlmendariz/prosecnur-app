import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { PlanPregunta } from "../../../api/dashboard";
import { ListaAplicar } from "./ListaAplicar";

// Codificación, Aplicar: una fila por pregunta, sin acordeones, con la ficha del color de su tipo.
// Es una lista con selección: la elegida gobierna el panel de detalle.

function pregunta(parcial: Partial<PlanPregunta> & Pick<PlanPregunta, "parent">): PlanPregunta {
  return {
    parent_label: "", tipo: "select_one", modo_so: "hijo", text_col: "", nueva_variable: `${parcial.parent}_recod`,
    n_grupos: 0, n_codigos_nuevos: 0, n_codigos_reutilizados: 0, n_respuestas_afectadas: 0,
    codigos_nuevos: [], codigos_reutilizados: [], bridge_soportado: true, ...parcial,
  };
}

const PREGUNTAS: PlanPregunta[] = [
  pregunta({ parent: "p9", parent_label: "Ocupación principal", tipo: "text", modo_so: "", n_codigos_nuevos: 6, n_codigos_reutilizados: 2, n_respuestas_afectadas: 142,
    codigos_nuevos: [{ codigo: "08", etiqueta: "Educación superior", n_respuestas: 24 }], codigos_reutilizados: [] }),
  pregunta({ parent: "p3", parent_label: "Otra carrera, especifique", tipo: "select_multiple", modo_so: "", nueva_variable: "p3/*_recod", n_codigos_nuevos: 3, n_respuestas_afectadas: 23 }),
  pregunta({ parent: "p12", parent_label: "Edad", tipo: "integer", modo_so: "", n_codigos_nuevos: 4, n_respuestas_afectadas: 178 }),
  pregunta({ parent: "p5", parent_label: "Sector", tipo: "agrupacion", modo_so: "", nueva_variable: "p5_agrup", n_codigos_nuevos: 3, n_respuestas_afectadas: 90 }),
];

const texto = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const filas = (html: string) => html.split('<li class="pulso-aplicar-fila"').slice(1);
const pintar = (preguntas: PlanPregunta[], elegida: string | null) =>
  renderToStaticMarkup(<ListaAplicar preguntas={preguntas} elegida={elegida} onElegir={() => undefined} idDeDetalle="detalle-1" />);

describe("ListaAplicar", () => {
  const html = pintar(PREGUNTAS, "p3::p3/*_recod");

  it("declara C1 en el contenedor de datos y es una lista con selección que gobierna el detalle", () => {
    expect(html).toMatch(
      /^<ul class="pulso-aplicar-lista" role="listbox" aria-label="Preguntas por aplicar" aria-orientation="vertical" aria-controls="detalle-1" data-qa-geometry-group="codificacion\/aplicar-preguntas" data-qa-geometry-contract="intrinsic">/,
    );
  });

  it("pinta una fila por pregunta, en el orden del plan, y sin acordeones", () => {
    expect(filas(html)).toHaveLength(4);
    expect(filas(html).map((f) => f.match(/pulso-(?:ficha-pregunta-codigo|aplicar-ficha-neutra)">(?:<code>)?([^<]+)/)?.[1])).toEqual(["p9", "p3", "p12", "p5"]);
    expect(html).not.toMatch(/<details|<summary|aria-expanded/);
  });

  it("solo la fila elegida está seleccionada y es la única parada de tabulador", () => {
    expect(filas(html).map((f) => f.match(/^ role="option" aria-selected="(true|false)" tabindex="(-?\d)"/)?.slice(1))).toEqual([
      ["false", "-1"], ["true", "0"], ["false", "-1"], ["false", "-1"],
    ]);
    // Sin fila elegida ninguna queda marcada: quien decide el valor por defecto es el modelo (`preguntaElegida`).
    expect(pintar(PREGUNTAS, null)).not.toContain('aria-selected="true"');
  });

  it("cada ficha lleva el color de su tipo; el tipo también se dice en palabras", () => {
    const [p9, p3, p12] = filas(html);
    expect(p9).toContain('<span class="pulso-ficha-pregunta" data-tipo="texto"><code class="pulso-ficha-pregunta-codigo">p9</code><span class="pulso-ficha-pregunta-etiqueta">Ocupación principal</span></span>');
    expect(p9).toContain('<span class="pulso-aplicar-tipo">Texto abierto</span>');
    expect(p3).toContain('data-tipo="multiple"');
    expect(p12).toContain('data-tipo="numerica"');
    expect(texto(`<li${p12}`)).toContain("Numérica por rangos");
  });

  it("dice qué produce cada pregunta: el campo nuevo, cuántos códigos y cuántas respuestas", () => {
    const [p9, p3] = filas(html).map((f) => texto(`<li${f}`));
    expect(p9).toContain("Campo nuevo p9_recod");
    expect(p9).toContain("6 códigos nuevos y 2 ya existentes");
    expect(p9).toContain("142 respuestas con código");
    // Una de opción múltiple agrega un campo por código.
    expect(p3).toContain("Campos nuevos p3/*_recod");
    expect(p3).toContain("3 códigos nuevos");
  });

  it("con una sola pregunta la fila no repite los conteos de códigos de la franja", () => {
    const sola = texto(pintar([PREGUNTAS[0]], "p9::p9_recod"));
    expect(sola).not.toContain("códigos nuevos");
    expect(sola).not.toContain("ya existentes");
    expect(sola).toContain("142 respuestas con código");
    expect(sola).toContain("Campo nuevo p9_recod");
  });

  it("no lista los códigos uno por uno: el desglose vive en el panel de detalle", () => {
    expect(texto(html)).not.toContain("Educación superior");
  });

  it("un tipo que la ficha no conoce va sin color, con su código y su etiqueta", () => {
    const p5 = filas(html)[3];
    expect(p5).not.toContain("pulso-ficha-pregunta");
    expect(p5).toContain('<span class="pulso-aplicar-ficha-neutra"><code>p5</code><span>Sector</span></span>');
    expect(texto(`<li${p5}`)).toContain("Agrupación de categorías");
  });

  it("lo que el plan no trae no se pinta", () => {
    const sinDatos = pintar([pregunta({ parent: "p7", nueva_variable: "", n_respuestas_afectadas: undefined as unknown as number })], null);
    expect(sinDatos).toContain('<div class="pulso-aplicar-celda pulso-aplicar-celda--campo"></div>');
    expect(sinDatos).toContain('<div class="pulso-aplicar-celda pulso-aplicar-celda--cifras"></div>');
    expect(texto(sinDatos)).toBe("p7 Opción única, texto codificado aparte");
  });
});
