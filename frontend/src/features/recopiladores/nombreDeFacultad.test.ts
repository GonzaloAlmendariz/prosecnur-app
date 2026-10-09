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

  it("baja las mayúsculas del marco y REPONE las tildes que no trae", () => {
    // **Este test fijaba el defecto.** Se llamaba «sin romper las tildes» y
    // afirmaba «Ciencias e Ingenieria» y «Educacion» — sin tilde—, que es lo que
    // salía porque el capitalizador propio de esta pantalla no las reponía. El
    // marco viene de un SQL que no las guarda, así que «no romperlas» no basta:
    // hay que ponerlas. Monitoreo ya lo hacía, y esta pantalla publicaba el
    // mismo nombre mal escrito — medido el 2026-09-17: 11 de 16 facultades con
    // nombre distinto en las dos, y dos de esas diferencias eran ortografía.
    //
    // Desde entonces las dos consumen `src/lib/nombresDeFacultad.ts`. Las
    // tildes no se inventan: cada una es una facultad concreta de la PUCP,
    // listada en ese módulo.
    expect(nombreCortoDeFacultad("CIENCIAS E INGENIERIA")).toBe("Ciencias e Ingeniería");
    expect(nombreCortoDeFacultad("EDUCACION")).toBe("Educación");
    expect(nombreCortoDeFacultad("PSICOLOGIA")).toBe("Psicología");
    // Y las que ya venían bien no se tocan.
    expect(nombreCortoDeFacultad("ARQUITECTURA Y URBANISMO")).toBe("Arquitectura y Urbanismo");
    expect(nombreCortoDeFacultad("ARTES ESCÉNICAS")).toBe("Artes Escénicas");
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
