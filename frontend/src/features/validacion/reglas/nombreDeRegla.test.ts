import { describe, expect, it } from "vitest";
import { conNombreUnico, etiquetaCortaDe, listaEnTexto, nombreSinRepetir } from "./nombreDeRegla";

describe("etiqueta corta de una pregunta", () => {
  it("toma lo que sigue a los dos puntos, una etiqueta corta o nada", () => {
    expect(etiquetaCortaDe({ name: "p1_3", label: "P1. Lugar de nacimiento: distrito" })).toBe("distrito");
    expect(etiquetaCortaDe({ name: "p4", label: "Año de egreso" })).toBe("Año de egreso");
    expect(etiquetaCortaDe({ name: "p4", label: "P4. ¿Estudias o trabajas actualmente?" })).toBe("");
    expect(etiquetaCortaDe({ name: "P8_6", label: "P8. Siento que mi opinión importa: 6. En mi universidad" })).toBe("");
    expect(etiquetaCortaDe({ name: "p3", label: "P3. Edad" })).toBe("Edad");
    expect(etiquetaCortaDe({ name: "x", label: "x" })).toBe("");
    expect(etiquetaCortaDe(undefined)).toBe("");
  });
});

describe("lista en texto", () => {
  it("separa con coma y cierra con y", () => {
    expect(listaEnTexto(["a"])).toBe("a");
    expect(listaEnTexto(["a", "b"])).toBe("a y b");
    expect(listaEnTexto(["a", "b", "c"])).toBe("a, b y c");
  });
});

describe("nombre sin repetir", () => {
  it("deja el nombre libre, y agrega (copia) o un número si ya está", () => {
    expect(nombreSinRepetir("Regla A", ["Regla B"])).toBe("Regla A");
    expect(nombreSinRepetir("Regla A", ["Regla A"])).toBe("Regla A (copia)");
    expect(nombreSinRepetir("Regla A", ["Regla A", "regla a (copia)"])).toBe("Regla A (copia 2)");
    expect(nombreSinRepetir("Regla A (copia)", ["Regla A", "Regla A (copia)"])).toBe("Regla A (copia 2)");
  });

  it("el detalle que era el nombre sigue al nombre", () => {
    expect(conNombreUnico({ nombre: "R", mensaje: "R" }, ["R"])).toEqual({ nombre: "R (copia)", mensaje: "R (copia)" });
    expect(conNombreUnico({ nombre: "R", mensaje: "Otro" }, ["R"])).toEqual({ nombre: "R (copia)", mensaje: "Otro" });
  });
});
