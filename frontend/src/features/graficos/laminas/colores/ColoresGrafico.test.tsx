// «Colores por serie» pintada (markup estático): C1 declarada, una fila por serie con nombre accesible y color legible,
// sello de procedencia, «Volver al recetario» sólo donde hay decisión y el vacío contenido en la fila (C3/C5).
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ListaColores } from "./ColoresGrafico";
import { coloresEfectivos } from "./coloresGraficoModel";

const pintar = (propios: Record<string, string>, nombres = ["Acceso", "Trato"]) =>
  renderToStaticMarkup(<ListaColores rotulo="Colores por serie" filas={coloresEfectivos(nombres, propios)} onElegir={() => undefined} />);

describe("ListaColores", () => {
  it("declara su superficie y un miembro por serie (C1)", () => {
    const html = pintar({});
    expect(html).toContain('data-qa-geometry-group="graficos/f6-colores"');
    expect(html).toContain('data-qa-geometry-contract="intrinsic"');
    expect(html.match(/data-qa-geometry-member="color-serie"/g)).toHaveLength(2);
    expect(html).toMatch(/role="group" aria-labelledby="[^"]+"/);
  });
  it("cada muestra tiene nombre accesible y su color se lee en texto", () => {
    const html = pintar({});
    expect([...html.matchAll(/aria-label="Color de la serie “([^”]+)”"/g)].map((m) => m[1])).toEqual(["Acceso", "Trato"]);
    expect(html).toContain("Azul institucional, #081F5C");   // dos series: la dicotómica del estándar, como el motor
    expect(html).toContain("Celeste, #9DC3E6");
    expect(html).toMatch(/type="color"[^>]*value="#081f5c"/);
  });
  it("sin decisiones: todo «Del recetario» y ningún «Volver al recetario»", () => {
    const html = pintar({});
    expect(html.match(/Por defecto/g)).toHaveLength(2);
    expect(html).not.toContain("Volver al color por defecto");
  });
  it("con una decisión: «Propio» y su botón con nombre propio (mutante: botón en todas las filas)", () => {
    const html = pintar({ Trato: "#101010" });
    expect(html.match(/is-propio/g)).toHaveLength(1);
    expect(html.match(/aria-label="Volver al color por defecto en “Trato”"/g)).toHaveLength(1);
    expect(html).not.toContain("Volver al color por defecto en “Acceso”");
    expect(html).toContain("#101010");
  });
  it("sin series el vacío vive en la fila (C3) y no dibuja muestras", () => {
    const html = pintar({}, []);
    expect(html).not.toContain("<input");
    expect(html).toContain("salen de los temas que declara el plan");
  });
});
