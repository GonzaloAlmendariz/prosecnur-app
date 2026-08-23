import { describe, expect, it } from "vitest";
import { nombreCortoDeFacultad } from "./nombreDeFacultad";

describe("nombreCortoDeFacultad", () => {
  it("distingue las dos de Estudios Generales, que es para lo que existe", () => {
    // Comparten los 19 primeros caracteres: truncadas son la misma fila.
    const a = nombreCortoDeFacultad("ESTUDIOS GENERALES CIENCIAS");
    const b = nombreCortoDeFacultad("ESTUDIOS GENERALES LETRAS");
    expect(a).toBe("EE.GG. Ciencias");
    expect(b).toBe("EE.GG. Letras");
    expect(a.slice(0, 12)).not.toBe(b.slice(0, 12));
  });

  it("baja las mayúsculas del marco sin romper las tildes", () => {
    expect(nombreCortoDeFacultad("CIENCIAS E INGENIERIA")).toBe("Ciencias e Ingenieria");
    expect(nombreCortoDeFacultad("ARQUITECTURA Y URBANISMO")).toBe("Arquitectura y Urbanismo");
    expect(nombreCortoDeFacultad("ARTES ESCÉNICAS")).toBe("Artes Escénicas");
    expect(nombreCortoDeFacultad("EDUCACION")).toBe("Educacion");
  });

  it("deja las partículas en minúscula salvo al principio", () => {
    expect(nombreCortoDeFacultad("ARTE Y DISEÑO")).toBe("Arte y Diseño");
    expect(nombreCortoDeFacultad("DE LA NADA")).toBe("De la Nada");
  });

  it("acorta las que no caben en la columna", () => {
    expect(nombreCortoDeFacultad("GASTRONOMÍA, HOTELERÍA Y TURISMO")).toBe("Gastronomía y Hotelería");
    expect(nombreCortoDeFacultad("LETRAS Y CIENCIAS HUMANAS")).toBe("Letras y CC. Humanas");
    expect(nombreCortoDeFacultad("ESCUELA DE POSGRADO")).toBe("Posgrado");
  });

  it("tolera el punto final que trae el marco en algunas", () => {
    // Llega como «CIENCIAS Y ARTES DE LA COMUN.», con y sin punto segun la base.
    expect(nombreCortoDeFacultad("CIENCIAS Y ARTES DE LA COMUN.")).toBe("Ciencias y Artes de la Com.");
    expect(nombreCortoDeFacultad("CIENCIAS Y ARTES DE LA COMUNICACION")).toBe("Ciencias y Artes de la Com.");
  });

  it("no inventa nombre cuando no lo hay", () => {
    expect(nombreCortoDeFacultad("")).toBe("");
    expect(nombreCortoDeFacultad("   ")).toBe("");
  });

  it("una facultad desconocida pasa capitalizada, no se descarta", () => {
    // Una lista cerrada que se traga lo que no reconoce ya costo un defecto:
    // aqui lo desconocido sale legible, no vacio.
    expect(nombreCortoDeFacultad("FACULTAD NUEVA DE ALGO")).toBe("Facultad Nueva de Algo");
  });
});
