import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ALTO_CIFRA_PCT, TrazadoDeBarras, alturaDeCifra } from "./TrazadoDeBarras";

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

describe("la cifra de la barra no queda tachada por la meta", () => {
  it("si la línea cruza la cifra, la cifra sube por encima de la línea", () => {
    // PDM 02/07: 109 sobre un eje de 150 (72.7 %) y la meta 400 sobre 500 (80 %).
    const barra = (109 / 150) * 100;
    const meta = (400 / 500) * 100;
    const cifra = alturaDeCifra(barra, meta);
    expect(cifra).toBeGreaterThan(meta);
    // MV 07/08 y 08/08: 15 sobre 20 (75 %) y la meta 100 sobre 120 (83.3 %).
    expect(alturaDeCifra(75, (100 / 120) * 100)).toBeGreaterThan((100 / 120) * 100);
  });

  it("con la meta cerca del tope, la cifra baja bajo la línea en vez de salirse del área", () => {
    const meta = 96;
    const cifra = alturaDeCifra(90, meta);
    expect(cifra + ALTO_CIFRA_PCT).toBeLessThanOrEqual(meta);
    expect(cifra).toBeGreaterThanOrEqual(0);
  });

  it("si la línea pasa lejos, la cifra se queda sobre su barra", () => {
    expect(alturaDeCifra(30, 80)).toBe(30);
    expect(alturaDeCifra(90, 40)).toBe(90);
    expect(alturaDeCifra(50, null)).toBe(50);
    // Justo por encima del alto de la cifra ya no la toca.
    expect(alturaDeCifra(50, 50 + ALTO_CIFRA_PCT + 3)).toBe(50);
  });

  it("en el trazado, la cifra que cruzaba la meta queda por encima de la línea", () => {
    const html = renderToStaticMarkup(
      <TrazadoDeBarras
        columnas={[{ fecha: "2026-07-02", total: 109, titulo: "", segmentos: [{ clase: "is-serie-0", valor: 109 }] },
          { fecha: "2026-07-03", total: 133, titulo: "", segmentos: [{ clase: "is-serie-0", valor: 133 }] }]}
        tituloIzquierdo="Efectivas por día"
        derecho={{ titulo: "Acumulado", valores: [109, 242], referencia: { valor: 400, rotulo: "Meta 400" }, rotuloFinal: "242 de 400" }}
      />,
    );
    const meta = Number(/mon-trazado-referencia" style="bottom:([\d.]+)%/.exec(html)?.[1]);
    const cifra = Number(/mon-trazado-cifra" style="bottom:([\d.]+)%">109</.exec(html)?.[1]);
    expect(meta).toBeGreaterThan(0);
    expect(cifra).toBeGreaterThan(meta);
  });
});
