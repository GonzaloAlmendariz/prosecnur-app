// F2, F5 y los textos del informe: lo que se ve en pantalla.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ArmonizacionAsignarEnMasa } from "./ArmonizacionAsignarEnMasa";
import { ArmonizacionTextosInforme } from "./ArmonizacionTextosInforme";
import { ConfirmarMismaEscalaBoton } from "./ConfirmarMismaEscalaBoton";

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

  it("el mismo marco con 0 y con muchos marcados; sólo cambia lo habilitado", () => {
    const cero = render(0, 25);
    expect(cero).toContain("Ningún código marcado");
    expect(cero).toContain("Marcar todos los sin mapa");
    expect(cero).toContain("Limpiar");
    expect(cero).toContain("2 Provincias");
    expect(cero).toContain("Sin mapa");
    expect(cero).toContain('aria-label="Asignar varios códigos de b2025"');
    const muchos = render(26, 0);
    expect(muchos).toContain("26 marcados");
    expect((cero.match(/<button/g) ?? []).length).toBe((muchos.match(/<button/g) ?? []).length);
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
    expect(html).toContain('placeholder="se calcula sola"');
    expect(html).toContain("Se imprime como «Base: …» bajo la tabla.");
    expect(html).toContain("data-qa-geometry-member");
  });
});

describe("confirmar las de misma escala", () => {
  it("con N = 0 no se muestra", () => {
    expect(renderToStaticMarkup(createElement(ConfirmarMismaEscalaBoton, {
      n: 0, ocupado: false, disabled: false, onConfirmar: sinAccion,
    }))).toBe("");
  });

  it("con N > 0 dice cuántas", () => {
    expect(renderToStaticMarkup(createElement(ConfirmarMismaEscalaBoton, {
      n: 14, ocupado: false, disabled: false, onConfirmar: sinAccion,
    }))).toContain("Confirmar las 14 de misma escala");
  });
});
