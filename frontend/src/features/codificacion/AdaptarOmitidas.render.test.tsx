// Adaptar: una pregunta que queda fuera dice por qué y ofrece cómo destrabarla (2026-10-16).
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

describe("preguntas fuera de la adaptación", () => {
  it("grupos huérfanos de un emparejamiento deshecho: lo dice y ofrece descartarlos o volver a emparejar", () => {
    const html = render({
      ...base,
      motivo_codigo: "sin_texto_emparejado",
      motivo_omision: "Ya no tiene un texto «Otro» emparejado: sus grupos quedaron de un emparejamiento anterior.",
    });
    expect(html).toContain("1 pregunta quedará fuera de la adaptación");
    expect(html).toContain("emparejamiento anterior");
    expect(html).toContain("Descartar los 3 grupos");
    expect(html).toContain("Volver a emparejar");
    expect(html).not.toContain("ajuste no reconocido");
  });

  it("texto emparejado sin modo: ofrece elegir qué hacen sus grupos", () => {
    const html = render({ ...base, text_col: "P29_10_otro", motivo_codigo: "sin_modo", motivo_omision: "Es de opción única…" });
    expect(html).toContain("¿Qué hacen los grupos de P29_10_otro?");
    expect(html).toContain("Corrigen la respuesta de P29_10");
    expect(html).toContain("Van en una variable aparte");
  });

  it("sin acción posible, sólo el motivo", () => {
    const html = render({ ...base, motivo_codigo: "sin_columna_texto", motivo_omision: "La columna de texto «P66_otro» no está en la base." });
    expect(html).toContain("P66_otro");
    expect(html).not.toContain("<button");
  });
});
