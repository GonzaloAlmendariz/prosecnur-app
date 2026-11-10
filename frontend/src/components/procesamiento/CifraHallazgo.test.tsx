import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { anchoDeBarra, CifraHallazgo } from "./CifraHallazgo";

const barra = (html: string) => /<div class="pulso-cifra-hallazgo-barra"[^>]*>/.exec(html)?.[0] ?? "";

describe("CifraHallazgo", () => {
  test("pinta la cifra, la base y, sin detalle, el porcentaje de la proporción", () => {
    const html = renderToStaticMarkup(<CifraHallazgo cifra={7} base="de 178 casos" proporcion={7 / 178} tono="inconsistencia" />);
    expect(html).toContain('<strong class="pulso-cifra-hallazgo-cifra">7</strong>');
    expect(html).toContain('<span class="pulso-cifra-hallazgo-base">de 178 casos</span>');
    expect(html).toContain('<span class="pulso-cifra-hallazgo-detalle">3.9 %</span>');
  });

  test("la barra es una imagen cuyo nombre dice la cifra, la base y el porcentaje", () => {
    const html = renderToStaticMarkup(<CifraHallazgo cifra={7} base="de 178 casos" proporcion={7 / 178} />);
    expect(barra(html)).toContain('role="img"');
    expect(barra(html)).toContain('aria-label="7 de 178 casos, 3.9 %"');
  });

  test("el detalle reemplaza al porcentaje, a la vista y en el nombre de la barra", () => {
    const html = renderToStaticMarkup(<CifraHallazgo cifra={7} base="casos, el 8 nov" proporcion={3 / 7} detalle="3 decididos" tono="avance" enmarcada />);
    expect(html).toContain('<span class="pulso-cifra-hallazgo-detalle">3 decididos</span>');
    expect(html).not.toContain("42.9 %");
    expect(barra(html)).toContain('aria-label="7 casos, el 8 nov, 3 decididos"');
  });

  test("el tono y el marco salen como atributos; por defecto, aviso y sin marco", () => {
    const porDefecto = renderToStaticMarkup(<CifraHallazgo cifra={3} base="de 178 casos" proporcion={3 / 178} />);
    const avance = renderToStaticMarkup(<CifraHallazgo cifra={3} base="de 7 casos" proporcion={3 / 7} tono="avance" enmarcada />);
    expect(porDefecto).toContain('class="pulso-cifra-hallazgo" data-tono="aviso"');
    expect(porDefecto).not.toContain("data-enmarcada");
    expect(avance).toContain('data-tono="avance" data-enmarcada=""');
  });

  test("una cifra de miles sale con separador y una etiqueta propia de barra manda", () => {
    const html = renderToStaticMarkup(
      <CifraHallazgo cifra={1234} base="de 17,124 casos" proporcion={1234 / 17124} etiquetaDeBarra="1,234 casos con el hallazgo" />,
    );
    expect(html).toContain(">1,234</strong>");
    expect(barra(html)).toContain('aria-label="1,234 casos con el hallazgo"');
  });

  test("la barra llena lo que dice la proporción, con un mínimo visible y sin pasarse", () => {
    expect(anchoDeBarra(0.5)).toBe(0.5);
    expect(anchoDeBarra(0.001)).toBe(0.015);
    expect(anchoDeBarra(0)).toBe(0);
    expect(anchoDeBarra(-1)).toBe(0);
    expect(anchoDeBarra(3)).toBe(1);
    expect(anchoDeBarra(Number.NaN)).toBe(0);
    const html = renderToStaticMarkup(<CifraHallazgo cifra={89} base="de 178 casos" proporcion={0.5} />);
    expect(barra(html)).toContain("--pulso-cifra-hallazgo-proporcion:0.5");
  });
});
