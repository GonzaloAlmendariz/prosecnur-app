import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChipsTwoBox } from "./ChipsTwoBox";
import { avisoSinCategorias, leerTwoBox, type Caja } from "./twoBox";

// C5 en Gráficos > tarjeta Two Box: con la columna encendida y sin categorías declaradas el motor la omite
// («la columna «Top Two Box» se omite: no hay categorías declaradas», graficador_barras_apiladas.R). La tarjeta no
// puede mostrar sólo el interruptor encendido y ningún chip marcado: dice que la columna no sale.

const CATS = ["Nada", "Poco", "Bastante", "Mucho"];
const SIN_TOP = "Sin categorías elegidas: la columna Top Two Box no sale hasta que elijas al menos una.";
const SIN_BOTTOM = "Sin categorías elegidas: la columna Bottom Two Box no sale hasta que elijas al menos una.";
const pintar = (caja: Caja, nombre: "Top Two Box" | "Bottom Two Box") =>
  renderToStaticMarkup(<ChipsTwoBox caja={caja} nombre={nombre} categorias={CATS} onChange={() => undefined} />);

describe("avisoSinCategorias: la tarjeta dice lo que sale en la lámina", () => {
  it("lámina 24 de acrconta_mazo: apilada con el Top Two Box del recetario y sin top2box_labels", () => {
    const estado = leerTwoBox("p_barras_apiladas", { var: "p24" }, {});
    expect(estado?.top).toEqual({ activa: true, etiquetas: [], delInforme: false });
    expect(avisoSinCategorias(estado!.top, "Top Two Box")).toBe(SIN_TOP);
  });

  it("apilada con chips vacíos explícitos, y multiapilada con top2box = TRUE sin etiquetas", () => {
    const vacia = leerTwoBox("p_barras_apiladas", { var: "p1", overrides: { top2box_labels: [] } }, {});
    expect(avisoSinCategorias(vacia!.top, "Top Two Box")).toBe(SIN_TOP);
    const multi = leerTwoBox("p_barras_multiapiladas", { modo: "var", vars: ["p1", "p2"], top2box: true }, {});
    expect(avisoSinCategorias(multi!.top, "Top Two Box")).toBe(SIN_TOP);
  });

  it("Bottom Two Box encendida sin bottom2box_labels", () => {
    const estado = leerTwoBox("p_barras_apiladas", { var: "p1", overrides: { top2box_labels: ["Bastante", "Mucho"], columna_bottom2box: true } }, {});
    expect(avisoSinCategorias(estado!.top, "Top Two Box")).toBeNull();
    expect(estado?.bottom.activa).toBe(true);
    expect(avisoSinCategorias(estado!.bottom, "Bottom Two Box")).toBe(SIN_BOTTOM);
  });

  it("sin aviso con categorías propias, del informe o con la columna apagada", () => {
    expect(avisoSinCategorias({ activa: true, etiquetas: ["Bastante"], delInforme: false }, "Top Two Box")).toBeNull();
    const delInforme = leerTwoBox("p_barras_apiladas", { var: "p1" }, { barras_apiladas: { top2box_labels: ["Bastante", "Mucho"] } });
    expect(delInforme?.top.delInforme).toBe(true);
    expect(avisoSinCategorias(delInforme!.top, "Top Two Box")).toBeNull();
    const apagada = leerTwoBox("p_barras_apiladas", { var: "p1", overrides: { mostrar_barra_extra: false } }, {});
    expect(apagada?.top.activa).toBe(false);
    expect(avisoSinCategorias(apagada!.top, "Top Two Box")).toBeNull();
  });

  it("no contradice al aviso del motor ni usa jerga", () => {
    for (const t of [SIN_TOP, SIN_BOTTOM]) {
      expect(t).toMatch(/no sale/);
      expect(t).not.toMatch(/top2box|bottom2box|labels|_/);
    }
  });
});

describe("ChipsTwoBox: el aviso se pinta junto a los chips", () => {
  it("encendida sin categorías: chips sin marcar y el aviso en un status", () => {
    const html = pintar({ activa: true, etiquetas: [], delInforme: false }, "Top Two Box");
    expect(html).toContain('data-qa="top2box-selector"');
    expect(html).not.toContain('aria-pressed="true"');
    expect(html).toMatch(/role="status" data-qa="twobox-sin-categorias">Sin categorías elegidas: la columna Top Two Box no sale/);
  });

  it("Bottom Two Box sin categorías", () => {
    expect(pintar({ activa: true, etiquetas: [], delInforme: false }, "Bottom Two Box")).toContain(SIN_BOTTOM);
  });

  it("con categorías: sin aviso", () => {
    const html = pintar({ activa: true, etiquetas: ["Bastante", "Mucho"], delInforme: false }, "Top Two Box");
    expect(html).not.toContain("twobox-sin-categorias");
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(2);
  });
});
