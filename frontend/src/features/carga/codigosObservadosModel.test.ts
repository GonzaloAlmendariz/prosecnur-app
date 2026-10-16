import { describe, expect, it } from "vitest";
import type { CodigosObservados } from "../../api/codigosObservados";
import { TEXTO_IDENTIFICADOR, TEXTO_TIPO_DESCONOCIDO, avisoNoListable, codigosConObservados } from "./codigosObservadosModel";

const obs = (tipo: CodigosObservados["tipo"]): CodigosObservados => ({
  base: "2026", variable: "dni", tipo, codigos: [], n_validos: 812, n_sin_dato: 0, truncado: false,
});

describe("avisoNoListable: la línea que reemplaza a la tabla", () => {
  it("categóricas y numéricas se listan: sin aviso", () => {
    expect(avisoNoListable("categorica")).toBeNull();
    expect(avisoNoListable("numerica")).toBeNull();
  });

  it("texto, identificador y tipo desconocido no se listan, cada uno con su línea", () => {
    expect(avisoNoListable("texto")).toBe("Variable de texto: elige una categórica o numérica.");
    expect(avisoNoListable("identificador")).toBe("Parece un identificador: sus valores no se listan.");
    expect(TEXTO_IDENTIFICADOR).toBe("Parece un identificador: sus valores no se listan.");
    expect(avisoNoListable("desconocido")).toBe(TEXTO_TIPO_DESCONOCIDO);
  });
});

describe("codigosConObservados con un tipo no listable", () => {
  it("no hay observados que usar: queda lo que se conoce del instrumento", () => {
    const opciones = [{ codigo: "1", etiqueta: "Sí" }];
    expect(codigosConObservados(opciones, obs("identificador"))).toBeNull();
    expect(codigosConObservados(opciones, obs("desconocido"))).toBeNull();
    expect(codigosConObservados(opciones, obs("categorica"))).toEqual([{ codigo: "1", etiqueta: "Sí", n: 0 }]);
  });
});
