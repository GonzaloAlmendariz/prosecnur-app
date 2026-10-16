import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { RecorridoSerieBanda } from "./RecorridoSerie";
import type { EstadoPaso, PasoId, PasoRecorrido } from "./recorridoSerieModel";

const IDS: PasoId[] = ["bases", "variables", "segmentos", "matriz", "ponderacion", "comparativos"];

const pasos = (estado: EstadoPaso | ((i: number) => EstadoPaso)): PasoRecorrido[] =>
  IDS.map((id, i) => ({
    id,
    numero: i + 1,
    titulo: `Paso ${i + 1}`,
    estado: typeof estado === "function" ? estado(i) : estado,
    detalle: `detalle ${i + 1}`,
    enlace: { tipo: "direccion", href: `/destino-${id}`, etiqueta: `Destino ${i + 1}` },
  }));

const render = (p: PasoRecorrido[]) => renderToStaticMarkup(
  createElement(MemoryRouter, null, createElement(RecorridoSerieBanda, { pasos: p, hrefDe: (x) => (x.enlace.tipo === "direccion" ? x.enlace.href : "") })),
);

describe("banda del recorrido de la serie", () => {
  it("C1: declara su grupo de seis pasos iguales, cada uno un enlace con su estado legible", () => {
    const html = render(pasos((i) => (i === 2 ? "falta" : i === 3 ? "no-empezado" : "hecho")));
    expect(html).toContain('data-qa-geometry-group="carga-recorrido-serie"');
    expect(html).toContain('data-qa-geometry-contract="equal"');
    expect(html.match(/<li [^>]*data-qa-geometry-member/g)).toHaveLength(6);
    expect(html.match(/<a /g)).toHaveLength(6);
    expect(html).toContain('href="/destino-segmentos"');
    expect(html).toContain("Falta algo. Ir a Destino 3.");
    expect(html).toContain("No empezado. Ir a Destino 4.");
    expect(html).toContain("2 de 6 pasos pendientes");
    // Con algo pendiente no se pliega ni ofrece plegarse.
    expect(html).not.toContain("aria-expanded");
    expect(html).toContain('data-audit-ready="true"');
  });

  it("con los seis hechos se pliega a una línea, con un botón que lo dice", () => {
    const html = render(pasos("hecho"));
    expect(html).toContain("Los seis pasos están hechos");
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("Ver pasos");
    expect(html).not.toContain("<ol");
  });

  it("mientras un paso lee, la readiness es `false`", () => {
    expect(render(pasos((i) => (i === 1 ? "leyendo" : "hecho")))).toContain('data-audit-ready="false"');
  });
});
