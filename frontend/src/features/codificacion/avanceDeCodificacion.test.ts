// El avance de una pregunta sale de las respuestas que la base trae hoy, cruzadas por la normalización del
// motor: las claves guardadas que la base ya no trae no cuentan (caso acnur_acg: 10 de 27 claves huérfanas
// hacían decir 100 % y "Decidida" a una pregunta con 17 de 27 textos con código).
import { describe, expect, it } from "vitest";
import { avanceDeCodificacion, cifrasDelAvance, detalleDelPorcentaje } from "./avanceDeCodificacion";

const R = (clave: string, frecuencia: number) => ({ texto_normalizado: clave, texto: clave, variantes: 1, frecuencia, uuids: [] });

describe("avanceDeCodificacion", () => {
  it("cuenta respuestas (casos) y textos distintos con código; las claves huérfanas no suman", () => {
    const a = avanceDeCodificacion(
      [R("barrio", 3), R("oscar", 3), R("iglesia", 2)],
      [{ id: "g", codigo: "12", etiqueta: "x", respuestas: ["Barrio", "texto que ya no esta", "otro huerfano"] }],
    );
    expect(a).toEqual({ casosConCodigo: 3, casos: 8, textosConCodigo: 1, textos: 3 });
  });

  it("sin respuestas, todo en cero", () => {
    expect(avanceDeCodificacion([], [])).toEqual({ casosConCodigo: 0, casos: 0, textosConCodigo: 0, textos: 0 });
  });

  it("cada cifra del avance nombra su base: respuestas sobre respuestas, textos distintos sobre textos distintos", () => {
    const avance = { casosConCodigo: 20, casos: 33, textosConCodigo: 17, textos: 27 };
    const [respuestas, textos] = cifrasDelAvance(avance);
    expect(respuestas).toMatchObject({ id: "respuestas", valor: 20, de: 33, plural: "respuestas con código" });
    expect(textos).toMatchObject({ id: "textos", valor: 17, de: 27, plural: "textos distintos con código" });
    // La base de cada una se explica al pasar sobre ella, sin mezclar los dos niveles.
    expect(respuestas.detalle).toMatch(/Personas/);
    expect(textos.detalle).toMatch(/lo mismo/);
  });

  it("el porcentaje de la fila de una pregunta dice de qué es", () => {
    expect(detalleDelPorcentaje({ casosConCodigo: 20, casos: 33, textosConCodigo: 17, textos: 27 })).toBe("20 de 33 respuestas con código");
    expect(detalleDelPorcentaje({ casosConCodigo: 1, casos: 1, textosConCodigo: 1, textos: 1 })).toBe("1 de 1 respuesta con código");
    expect(detalleDelPorcentaje({ casosConCodigo: 0, casos: 0, textosConCodigo: 0, textos: 0 })).toBe("Sin respuestas");
  });
});
