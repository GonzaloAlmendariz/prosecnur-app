import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { FilaCalculo } from "../estiloInforme/modeloEstiloInforme";
import { RedondeoDelGraficoVista } from "./RedondeoDelGrafico";

const fila: FilaCalculo = {
  preset: "barras_apiladas", titulo: "Barras apiladas", icono: "", admiteMetodo: true, campoDecimales: "decimales",
  metodo: "estandar", metodoDefault: "estandar", choicesMetodo: [], decimales: 0, decimalesDefault: 0, procedencia: "recetario",
};
const pintar = (args: Record<string, unknown>) => renderToStaticMarkup(createElement(RedondeoDelGraficoVista, { fila, args, onCambio: () => undefined }));

// R4: la tarjeta dice si el gráfico sigue al informe y, si es propio, muestra sus dos mandos.
describe("tarjeta · redondeo del gráfico", () => {
  it("por defecto sigue al informe y lo dice, sin mandos de método ni decimales", () => {
    const html = pintar({});
    expect(html).toMatch(/aria-checked="true"[^>]*>Como el informe/);
    expect(html).toContain("Sigue la regla del informe: estándar, sin decimales.");
    expect(html).not.toContain("Método de este gráfico");
  });
  it("propio: método y decimales del gráfico, y la regla del informe al lado", () => {
    const html = pintar({ overrides: { calculos_propios: true, metodo_redondeo: "reparto", decimales: 1 } });
    expect(html).toMatch(/aria-checked="true"[^>]*>Propio/);
    expect(html).toMatch(/aria-checked="true"[^>]*>Reparto a 100 %/);
    expect(html).toMatch(/aria-checked="true"[^>]*>Un decimal/);
    expect(html).toContain("Sólo este gráfico; el informe usa estándar, sin decimales.");
  });
  // Oleada I2, ítem 6: lo que suma la lámina con cada método, en dos líneas (sin «·»), y la mayor junto a los decimales.
  it("con detalle: la suma de cada método y la mayor ya redondeada", () => {
    const html = renderToStaticMarkup(createElement(RedondeoDelGraficoVista, {
      fila, args: { overrides: { calculos_propios: true, decimales: 0 } }, onCambio: () => undefined,
      cifras: { estandar: "Estándar: suma 99%", reparto: "Reparto: 100%", mayor: "La mayor: 62%", vigente: true },
    }));
    expect(html).toMatch(/data-qa="redondeo-estandar">Estándar: suma 99%</);
    expect(html).toMatch(/data-qa="redondeo-reparto">Reparto: 100%</);
    expect(html).toMatch(/data-qa="redondeo-mayor">La mayor: 62%</);
    expect(html).not.toContain("·");
  });
  it("sin detalle, sin cifras; mientras carga, una silueta", () => {
    expect(pintar({})).not.toContain("redondeo-estandar");
    const html = renderToStaticMarkup(createElement(RedondeoDelGraficoVista, { fila, args: {}, onCambio: () => undefined, cifras: { vigente: false } }));
    expect(html).toMatch(/data-qa="redondeo-estandar"/);
    expect(html).toContain('aria-busy="true"');
  });
});
