// Cada graficador del registro tiene glifo, ninguno sobra y la paleta entra por clases de tono (sin colores literales).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CATALOGO_GRAFICOS } from "./catalogoTipos.generated";
import { GlifoGrafico } from "./GlifoGrafico";
import { GLIFOS_GRAFICO } from "./glifosGrafico";
import { ComposicionLamina } from "./ComposicionLamina";
import { SLIDE_GRAF_SLOTS } from "../store";

const pintar = (tipo: string, titulo?: string) => renderToStaticMarkup(createElement(GlifoGrafico, { tipo, titulo }));

describe("glifos de gráfico", () => {
  it("cubren todos los graficadores del registro, también los retirados del selector (planes viejos)", () => {
    expect(CATALOGO_GRAFICOS.filter((g) => !(g.name in GLIFOS_GRAFICO)).map((g) => g.name)).toEqual([]);
  });

  it("no dibujan tipos que el registro no tiene", () => {
    const nombres = new Set(CATALOGO_GRAFICOS.map((g) => g.name));
    expect(Object.keys(GLIFOS_GRAFICO).filter((t) => !nombres.has(t))).toEqual([]);
  });

  it("dos graficadores no comparten el mismo dibujo", () => {
    const dibujos = CATALOGO_GRAFICOS.map((g) => pintar(g.name).replace(/data-glifo-tipo="[^"]*"/, ""));
    expect(new Set(dibujos).size).toBe(dibujos.length);
  });

  it("no llevan colores literales: todo color es una clase que resuelve glifoGrafico.css con tokens", () => {
    for (const g of CATALOGO_GRAFICOS) {
      const svg = pintar(g.name);
      expect(svg, g.name).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|fill="(?!none)[a-z]/i);
    }
    const css = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "glifoGrafico.css"), "utf8");
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });

  it("con título es una imagen con nombre; sin él, decorativo; un tipo desconocido es una ranura punteada", () => {
    expect(pintar("p_pie", "Torta")).toMatch(/role="img"[^>]*aria-labelledby=/);
    expect(pintar("p_pie")).toContain('aria-hidden="true"');
    expect(pintar("p_grafico_futuro")).toContain('data-glifo-desconocido="true"');
  });

  it("la cifra se rotula sin espacio antes del %", () => {
    expect(pintar("p_cifra")).toContain(">31%<");
    expect(pintar("p_donut")).toContain(">64%<");
  });
});

describe("ComposicionLamina", () => {
  it("dibuja los gráficos de la lámina en sus ranuras y resalta la activa", () => {
    const svg = renderToStaticMarkup(createElement(ComposicionLamina, {
      tipo: "p_slide_2_graficos",
      slots: SLIDE_GRAF_SLOTS.p_slide_2_graficos,
      graficos: { derecha: "p_pie" },
      ranuraActiva: 2,
      numerar: true,
    }));
    expect(svg).toContain('data-composicion-fuente="estandar"');
    expect(svg.match(/pulso-composicion__ranura is-vacia/g)?.length).toBe(1);
    expect(svg).toContain("pulso-composicion__ranura is-activa");
    expect(svg).toContain('data-ranura="2"');
  });

  it("las láminas de estructura cambian de dibujo con su variante", () => {
    const de = (variante: string) => renderToStaticMarkup(createElement(ComposicionLamina, { tipo: "p_slide_cierre", slots: [], variante }))
      .replace(/data-composicion-variante="[^"]*"/, "");
    const variantes = ["contraportada", "banda_azul", "banda_clara", "contacto", "tres_columnas"];
    expect(new Set(variantes.map(de)).size).toBe(variantes.length);
  });
});
