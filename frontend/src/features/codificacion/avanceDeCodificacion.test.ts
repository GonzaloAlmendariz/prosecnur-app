// El avance de una pregunta sale de las respuestas que la base trae hoy, cruzadas por la normalización del
// motor: las claves guardadas que la base ya no trae no cuentan (caso acnur_acg: 10 de 27 claves huérfanas
// hacían decir 100 % y "Decidida" a una pregunta con 17 de 27 textos con código).
import { describe, expect, it } from "vitest";
import { avanceDeCodificacion } from "./avanceDeCodificacion";

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
});
