import { describe, expect, it } from "vitest";
import { conEtiquetaCorta, leerEtiquetaCorta } from "./argsDatosGrafico";
import { preguntasConEtiqueta, tituloDeGrupo } from "./etiquetasPorPregunta";

// U9 del checklist de mandos del mazo (2026-11-05): una etiqueta corta por pregunta en las multiapiladas.
describe("preguntasConEtiqueta", () => {
  it("en el modo de una barra por pregunta (o sin modo) da las preguntas de `vars`, sin repetir", () => {
    expect(preguntasConEtiqueta({ modo: "var", vars: ["B8_1_1", " B8_1_2 ", "B8_1_1", ""] })).toEqual(["B8_1_1", "B8_1_2"]);
    expect(preguntasConEtiqueta({ vars: ["est$p1"] })).toEqual(["est$p1"]);
  });

  it("en los otros modos o con temas por público no hay filas", () => {
    expect(preguntasConEtiqueta({ modo: "cruce", vars: ["p1"] })).toEqual([]);
    expect(preguntasConEtiqueta({ modo: "var", vars: { tema_1: ["a$p1", "b$p1"] } })).toEqual([]);
  });

  it("la etiqueta se guarda con la referencia tal como va en `vars`, sin tocar las demás", () => {
    const args = { vars: ["est$p1", "est$p2"], overrides: { etiquetas_vars: { "est$p2": "Dos" }, barra_extra: false } };
    const ov = conEtiquetaCorta(args, "est$p1", " Facebook ");
    expect(ov).toEqual({ etiquetas_vars: { "est$p2": "Dos", "est$p1": "Facebook" }, barra_extra: false });
    expect(leerEtiquetaCorta({ overrides: ov }, "est$p1")).toBe("Facebook");
    expect(conEtiquetaCorta({ overrides: ov }, "est$p1", "")).toEqual({ etiquetas_vars: { "est$p2": "Dos" }, barra_extra: false });
  });

  it("el título por grupo del plan es lo que la barra lleva sin etiqueta", () => {
    expect(tituloDeGrupo({ titulos_grupo: { p1: "Uno" } }, "p1")).toBe("Uno");
    expect(tituloDeGrupo({ titulos_grupo: ["x"] }, "p1")).toBe("");
  });
});
