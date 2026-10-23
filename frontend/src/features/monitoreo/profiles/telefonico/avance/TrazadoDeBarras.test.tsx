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

  it("el acumulado lleva su propio eje y escala, con su valor final en una pastilla", () => {
    const html = renderToStaticMarkup(
      <TrazadoDeBarras
        columnas={columnas}
        tituloIzquierdo="Efectivas por día"
        derecho={{ titulo: "Acumulado", valores: [109, 1209], referencia: { valor: 1400, rotulo: "Meta 1,400" }, rotuloFinal: "1,209 de 1,400" }}
        banda={{ desde: 1, rotulo: "Sin registro en la hoja" }}
      />,
    );
    expect(html).toContain("Acumulado");
    // Una sola lectura: el valor final en una pastilla del eje derecho; la meta
    // es una línea (su rótulo va en la leyenda de la pestaña).
    expect(html).toContain("mon-trazado-referencia");
    expect(html).toMatch(/mon-trazado-pastilla[^>]*>1,209 de 1,400</);
    expect(html).not.toContain("Meta 1,400");
    expect(html).toContain("Sin registro en la hoja");
    // Escala derecha propia: 0 a 1,500 en pasos de 500 (la de las barras va en pasos de 250).
    const derecho = html.slice(html.indexOf("mon-trazado-eje is-derecho"));
    expect(derecho).toContain(">1,000<");
    expect(derecho).not.toContain(">250<");
    const izquierdo = html.slice(html.indexOf("mon-trazado-eje is-izquierdo"), html.indexOf("mon-trazado-area"));
    expect(izquierdo).toContain(">250<");
  });
});
