// Al desemparejar con respuestas agrupadas, la app pregunta qué hacer con esos grupos (2026-10-16).
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GruposTrasDesemparejar } from "./GruposTrasDesemparejar";

describe("grupos tras desemparejar", () => {
  it("sin pendiente no pinta nada", () => {
    expect(renderToStaticMarkup(createElement(GruposTrasDesemparejar, { pendiente: null, onListo: () => undefined }))).toBe("");
  });

  it("dice qué pregunta quedó con grupos y ofrece descartarlos o conservarlos", () => {
    const html = renderToStaticMarkup(createElement(GruposTrasDesemparejar, { pendiente: { parent: "P29_10", n: 13 }, onListo: () => undefined }));
    expect(html).toContain("P29_10");
    expect(html).toContain("13 respuestas agrupadas");
    expect(html).toContain("Descartar esos grupos");
    expect(html).toContain("Conservarlos");
  });
});
