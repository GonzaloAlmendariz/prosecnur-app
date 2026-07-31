import { describe, expect, it } from "vitest";

import { contarSegmentos, nombreDelSegmento, pluralDelSegmento } from "./segmentoDeCuotas";

describe("nombreDelSegmento", () => {
  it("toma la variable que el corte declara", () => {
    // En PDM MedVida el segmento es «Actor», y la vista lo llamaba «Sede».
    expect(nombreDelSegmento(["Actor", "Actor"])).toBe("Actor");
    expect(nombreDelSegmento(["Sede", "Sede", "Sede"])).toBe("Sede");
  });

  it("gana la más frecuente, no la primera", () => {
    // Una fila suelta de otra variable —una meta global, un residuo— no es el
    // segmento por el que se reparte el estudio.
    expect(nombreDelSegmento(["Total", "Distrito", "Distrito", "Distrito"])).toBe("Distrito");
  });

  it("ante empate conserva el orden en que el motor las emite", () => {
    // Ese orden es el de `control_vars`: el que declaró el usuario.
    expect(nombreDelSegmento(["Actor", "Distrito"])).toBe("Actor");
  });

  it("sin variables cae a un nombre neutro y no inventa una sede", () => {
    expect(nombreDelSegmento([])).toBe("Cuota");
    expect(nombreDelSegmento(["", "  "])).toBe("Cuota");
    expect(nombreDelSegmento([], "Segmento")).toBe("Segmento");
  });
});

describe("pluralDelSegmento", () => {
  it("añade -s tras vocal", () => {
    expect(pluralDelSegmento("Sede")).toBe("Sedes");
    expect(pluralDelSegmento("Distrito")).toBe("Distritos");
  });

  it("añade -es tras consonante", () => {
    expect(pluralDelSegmento("Actor")).toBe("Actores");
    expect(pluralDelSegmento("Nivel")).toBe("Niveles");
    expect(pluralDelSegmento("Facultad")).toBe("Facultades");
  });

  it("resuelve la z", () => {
    expect(pluralDelSegmento("Vez")).toBe("Veces");
  });

  it("no vuelve a pluralizar lo que ya está en plural", () => {
    expect(pluralDelSegmento("Sedes")).toBe("Sedes");
  });

  it("con vacío no devuelve basura", () => {
    expect(pluralDelSegmento("")).toBe("");
  });
});

describe("contarSegmentos", () => {
  it("concuerda el número con la etiqueta", () => {
    expect(contarSegmentos(2, "Actor")).toBe("2 actores");
    expect(contarSegmentos(1, "Actor")).toBe("1 actor");
    expect(contarSegmentos(3, "Sede")).toBe("3 sedes");
  });
});
