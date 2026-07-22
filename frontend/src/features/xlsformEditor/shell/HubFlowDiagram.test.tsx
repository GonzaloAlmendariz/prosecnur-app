import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { HubFlowDiagram } from "./HubFlowDiagram";

describe("HubFlowDiagram accessibility", () => {
  test("the accessible description names the same four visible stages", () => {
    const markup = renderToStaticMarkup(<HubFlowDiagram />);

    expect(markup).toContain("Secciones");
    expect(markup).toContain("Preguntas");
    expect(markup).toContain("Lógica");
    expect(markup).toContain("Exportar");
    expect(markup).toContain(
      "Cuatro etapas: Secciones, Preguntas, Lógica y Exportar.",
    );
    expect(markup).not.toContain("KoBo");
    expect(markup).not.toContain("ODK Collect");
  });
});
