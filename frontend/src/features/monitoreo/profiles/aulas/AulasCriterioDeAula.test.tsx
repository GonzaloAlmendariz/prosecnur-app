import { describe, expect, it } from "vitest";

import { renderToStaticMarkup } from "react-dom/server";

import { AulasCriterioDeAula } from "./AulasCriterioDeAula";

/**
 * La vara se declara o se dice que no está declarada. Nunca se inventa.
 */
describe("AulasCriterioDeAula", () => {
  it("sin declarar NO enseña un porcentaje por defecto", () => {
    // Poner «70 %» aquí sería exactamente lo que este control viene a corregir:
    // una vara que nadie eligió, presentada como si fuera del estudio.
    const html = renderToStaticMarkup(
      <AulasCriterioDeAula criterio={null} hayMetas={100} onGuardar={() => {}} />,
    );
    expect(html).toContain("no ha declarado");
    expect(html).toContain("el veredicto que el equipo escribió en su Excel");
    expect(html).not.toContain("70");
    expect(html).toContain("Declararlo");
  });

  it("declarado, dice la vara en los términos del diseño", () => {
    const html = renderToStaticMarkup(
      <AulasCriterioDeAula
        criterio={{ modo: "esperado", alfa: 0.8 }}
        hayMetas={197}
        onGuardar={() => {}}
      />,
    );
    expect(html).toContain("<strong>80 %</strong>");
    expect(html).toContain("de lo que el diseño esperaba de ella");
    expect(html).toContain("Cambiar");
  });

  it("un criterio de otro modo no se lee como declarado", () => {
    // `proporcion` es la vara vieja: no habla del esperado del aula, así que la
    // frase de arriba mentiría si lo tratara igual.
    const html = renderToStaticMarkup(
      <AulasCriterioDeAula
        criterio={{ modo: "proporcion", umbral: 0.7 }}
        hayMetas={0}
        onGuardar={() => {}}
      />,
    );
    expect(html).toContain("no ha declarado");
  });
});
