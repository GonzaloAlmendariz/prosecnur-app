// «Estilos» con candado (L36 · D-L36-21): muestra el estándar del cuestionario, sin controles para cambiarlo.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ESTANDAR_CUESTIONARIO } from "./estandarCuestionario.generated";
import { EstilosImpreso, filasTipografia } from "./EstilosImpreso";

describe("Estilos del impreso", () => {
  it("lista fuente y cuerpos del estándar", () => {
    expect(filasTipografia(ESTANDAR_CUESTIONARIO)).toEqual([
      ["Fuente", "Arial Narrow"], ["Título", "20 pt"], ["Cuerpo de texto", "10 pt"], ["Rótulos y notas", "8 pt"],
    ]);
  });

  it("muestra los colores con su muestra y no ofrece ningún control para cambiarlos", () => {
    const html = renderToStaticMarkup(<EstilosImpreso />);
    expect(html).toContain("Banda de sección");
    expect(html).toContain("#D9D9D9");
    expect(html).toContain("estándar de Pulso");
    expect(html).not.toMatch(/<(input|button|select)\b/);
  });
});
