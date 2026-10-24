import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NotaFormaRadar } from "./NotaFormaRadar";

const vars = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`T${i}`, [`a$p${i}`]]));

describe("NotaFormaRadar", () => {
  it("con 4 criterios en automático dice cómo se dibujará", () => {
    expect(renderToStaticMarkup(<NotaFormaRadar args={{ modo: "publicos", vars: vars(4) }} />)).toContain("Se dibujará como líneas y puntos: este radar tiene 4 criterios");
  });
  it("con la forma Radar y 2 criterios muestra el aviso; con 6 no muestra nada", () => {
    expect(renderToStaticMarkup(<NotaFormaRadar args={{ modo: "publicos", forma: "radar", vars: vars(2) }} />)).toContain("no se puede dibujar");
    expect(renderToStaticMarkup(<NotaFormaRadar args={{ modo: "publicos", vars: vars(6) }} />)).toBe("");
  });
});
