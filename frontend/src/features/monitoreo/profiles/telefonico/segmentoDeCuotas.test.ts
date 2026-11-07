import { describe, expect, it } from "vitest";

import { contarSegmentos, nombreDelSegmento, pluralDelSegmento, variableDeCuotas } from "./segmentoDeCuotas";

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

describe("variableDeCuotas: una sola variable para Cuotas, Ritmo y la barra", () => {
  it("con metas por sexo y un listado por sede, gana sexo (la que tiene metas), aunque sede tenga más filas", () => {
    const filas = [
      { variable: "Sede", meta: null }, { variable: "Sede", meta: null }, { variable: "Sede", meta: null },
      { variable: "Sexo", meta: 40 }, { variable: "Sexo", meta: 35 },
    ];
    expect(variableDeCuotas(filas)).toBe("Sexo");
  });

  it("entre las que tienen meta, un nombre de eje (sede, actor…) gana a la más frecuente", () => {
    const filas = [
      { variable: "Edad", meta: 10 }, { variable: "Edad", meta: 10 }, { variable: "Edad", meta: 10 },
      { variable: "Sede", meta: 20 }, { variable: "Sede", meta: 20 },
    ];
    expect(variableDeCuotas(filas)).toBe("Sede");
  });

  it("sin ninguna meta cae a la más frecuente y, ante empate, a la primera del motor", () => {
    expect(variableDeCuotas([{ variable: "dim_actor" }, { variable: "Grupo etario" }, { variable: "dim_actor" }])).toBe("dim_actor");
    expect(variableDeCuotas([{ variable: "dim_actor", meta: "80" }, { variable: "Intro/proyecto_ppl", meta: "80" }])).toBe("dim_actor");
    expect(variableDeCuotas([], "")).toBe("");
  });
});
