// Aplicar: una pregunta que no se puede aplicar dice por qué y ofrece cómo destrabarla (2026-10-16).
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PlanPregunta } from "../../api/dashboard";
import { AdaptarOmitidas } from "./AdaptarOmitidas";

const base: PlanPregunta = {
  parent: "P29_10", parent_label: "Acudí a otra instancia interna de la PUCP.", tipo: "select_one", modo_so: "",
  text_col: "", nueva_variable: "", n_grupos: 3, n_codigos_nuevos: 0, n_codigos_reutilizados: 3,
  n_respuestas_afectadas: 13, codigos_nuevos: [], codigos_reutilizados: [], bridge_soportado: false,
};
const render = (p: PlanPregunta) => renderToStaticMarkup(createElement(AdaptarOmitidas, {
  preguntas: [p], onCambio: () => undefined, onIrAPreguntas: () => undefined,
}));

describe("preguntas que no se pueden aplicar", () => {
  it("grupos huérfanos de un emparejamiento deshecho: lo dice y ofrece descartarlos o volver a emparejar", () => {
    const html = render({
      ...base,
      motivo_codigo: "sin_texto_emparejado",
      motivo_omision: 'Ya no tiene un texto "Otro" emparejado: sus grupos quedaron de un emparejamiento anterior.',
    });
    expect(html).toContain("1 pregunta no se puede aplicar");
    expect(html).not.toContain("adaptaci");
    expect(html).toContain("emparejamiento anterior");
    expect(html).toContain("Descartar los 3 códigos");
    // La unidad se llama "código" en las acciones; la causa que escribe el motor conserva su texto.
    expect(html).not.toMatch(/Descartar los \d+ grupos/);
    // Con un solo código concuerda en singular.
    expect(render({ ...base, n_grupos: 1, motivo_codigo: "sin_texto_emparejado", motivo_omision: "x" })).toContain("Descartar el código");
    expect(html).toContain("Volver a emparejar");
    expect(html).not.toContain("ajuste no reconocido");
  });

  it("texto emparejado sin modo: ofrece elegir qué hacen sus grupos", () => {
    const html = render({ ...base, text_col: "P29_10_otro", motivo_codigo: "sin_modo", motivo_omision: "Es de opción única…" });
    expect(html).toContain("¿Qué hacen los códigos de P29_10_otro?");
    expect(html).toContain("Corrigen la respuesta de P29_10");
    expect(html).toContain("Van en una variable aparte");
  });

  it("sin acción posible, sólo el motivo", () => {
    const html = render({ ...base, motivo_codigo: "sin_columna_texto", motivo_omision: 'La columna de texto "P66_otro" no está en la base.' });
    expect(html).toContain("P66_otro");
    expect(html).not.toContain("<button");
  });

  it("cada pregunta va con su ficha del color de su tipo y sin raya entre código y etiqueta", () => {
    const html = render({ ...base, motivo_codigo: "sin_columna_texto", motivo_omision: "Falta la columna." });
    expect(html).toContain('<span class="pulso-ficha-pregunta" data-tipo="unica"><code class="pulso-ficha-pregunta-codigo">P29_10</code>');
    expect(html).not.toContain("—");
  });

  it("declara su lista como grupo de geometría intrínseca (C1) y no pinta nada sin preguntas", () => {
    const html = render({ ...base, motivo_omision: "Falta la columna." });
    expect(html).toContain('data-qa-geometry-group="codificacion/aplicar-fuera"');
    expect(html).toContain('data-qa-geometry-contract="intrinsic"');
    expect(renderToStaticMarkup(createElement(AdaptarOmitidas, { preguntas: [], onCambio: () => undefined, onIrAPreguntas: () => undefined }))).toBe("");
  });
});
