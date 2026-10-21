// F2, F5 y los textos del informe: lo que se ve en pantalla.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ArmonizacionAsignarEnMasa } from "./ArmonizacionAsignarEnMasa";
import { ArmonizacionTextosInforme } from "./ArmonizacionTextosInforme";

const sinAccion = () => undefined;

describe("barra «asignar en masa»", () => {
  const render = (nMarcados: number, nSinMapa: number) => renderToStaticMarkup(createElement(ArmonizacionAsignarEnMasa, {
    base: "b2025",
    escala: [{ codigo: "1", etiqueta: "Lima" }, { codigo: "2", etiqueta: "Provincias" }],
    nMarcados,
    nSinMapa,
    onAsignar: sinAccion,
    onMarcarSinMapa: sinAccion,
    onLimpiar: sinAccion,
  }));

  it("sin marcados explica para qué son las casillas y ofrece marcar los sin mapa", () => {
    const cero = render(0, 25);
    expect(cero).toContain("Marca varios códigos para asignarlos juntos a una categoría.");
    expect(cero).toContain("Marcar los 25 sin mapa");
    expect(cero).not.toContain("<select");
    expect(cero).toContain('aria-label="Asignar varios códigos de b2025"');
    expect(render(0, 0)).not.toContain("<button");
  });

  it("con marcados pide la categoría y permite desmarcar", () => {
    const muchos = render(26, 0);
    expect(muchos).toContain("26 marcados");
    expect(muchos).toContain(">Provincias<");
    expect(muchos).toContain("Sin mapa");
    expect(muchos).toContain(">Asignar<");
    expect(muchos).toContain("Desmarcar");
  });
});

describe("textos del informe", () => {
  it("enunciado con el nombre estándar de placeholder y base con su ayuda", () => {
    const html = renderToStaticMarkup(createElement(ArmonizacionTextosInforme, {
      textos: { enunciado: "", baseTexto: "" },
      nombreEstandar: "Departamento de residencia",
      onCambiar: sinAccion,
    }));
    expect(html).toContain("Enunciado en el informe");
    expect(html).toContain('placeholder="Departamento de residencia"');
    expect(html).toContain('placeholder="Automática"');
    expect(html).toContain("Va bajo la tabla como «Base: …».");
    expect(html).toContain("data-qa-geometry-member");
  });
});
