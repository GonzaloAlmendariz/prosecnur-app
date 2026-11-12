import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { NombreDeCampo } from "./NombreDeCampo";

describe("NombreDeCampo", () => {
  test("con barra ofrece el corte solo después de la barra; sin barra, después de un guion bajo", () => {
    const html = renderToStaticMarkup(<NombreDeCampo nombre="D1_information/*_recod" />);
    expect(html).toBe('<code title="D1_information/*_recod">D1_information/<wbr/>*_recod</code>');
  });

  test("un nombre sin separadores va entero, sin puntos de corte", () => {
    const html = renderToStaticMarkup(<NombreDeCampo nombre="edad" className="pulso-aplicar-campo" />);
    expect(html).toBe('<code class="pulso-aplicar-campo" title="edad">edad</code>');
  });

  test("el texto que se lee es el nombre completo, sin caracteres añadidos", () => {
    const html = renderToStaticMarkup(<NombreDeCampo nombre="p9_recod" />);
    expect(html.replace(/<[^>]+>/g, "")).toBe("p9_recod");
  });
});
