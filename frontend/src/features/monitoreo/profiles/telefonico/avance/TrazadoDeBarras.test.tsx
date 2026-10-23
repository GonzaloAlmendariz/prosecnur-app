import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TrazadoDeBarras } from "./TrazadoDeBarras";

const columnas = [
  { fecha: "2026-07-02", total: 109, titulo: "", segmentos: [{ clase: "is-serie-0", valor: 109 }] },
  { fecha: "2026-07-03", total: 1100, titulo: "", segmentos: [{ clase: "is-serie-0", valor: 1100 }] },
];

describe("trazado de barras con dos ejes", () => {
  it("pinta el eje izquierdo con título y marcas en es-PE", () => {
    const html = renderToStaticMarkup(<TrazadoDeBarras columnas={columnas} tituloIzquierdo="Efectivas por día" />);
    expect(html).toContain("Efectivas por día");
    expect(html).toContain(">1,250<");
    expect(html).not.toContain("mon-trazado-eje is-derecho");
  });

  it("el acumulado lleva su propio eje y escala, y la meta se rotula en él", () => {
    const html = renderToStaticMarkup(
      <TrazadoDeBarras
        columnas={columnas}
        tituloIzquierdo="Efectivas por día"
        derecho={{ titulo: "Acumulado", valores: [109, 1209], referencia: { valor: 1400, rotulo: "Meta 1,400" }, rotuloFinal: "1,209 de 1,400" }}
      />,
    );
    expect(html).toContain("Acumulado");
    expect(html).toContain("Meta 1,400");
    expect(html).toContain("1,209 de 1,400");
    // Escala derecha propia: 0 a 1,500 en pasos de 500 (la de las barras va en pasos de 250).
    const derecho = html.slice(html.indexOf("mon-trazado-eje is-derecho"));
    expect(derecho).toContain(">1,000<");
    expect(derecho).not.toContain(">250<");
    const izquierdo = html.slice(html.indexOf("mon-trazado-eje is-izquierdo"), html.indexOf("mon-trazado-area"));
    expect(izquierdo).toContain(">250<");
  });
});
