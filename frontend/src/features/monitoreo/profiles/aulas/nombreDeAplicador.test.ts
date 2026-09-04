import { describe, expect, it } from "vitest";

import { inicialesDeAplicador, nombreDeAplicador } from "./nombreDeAplicador";

/**
 * Dictado 2026-09-04: «el nombre normalizado, apellido, coma, nombre y nombre.
 * Y siempre tiene que ser así, y en mayúsculas donde sea y en minúsculas donde
 * debe corresponder». Los casos son los del libro real del operativo.
 */
describe("nombreDeAplicador", () => {
  it("baja las mayúsculas gritadas sin tocar el orden ni los acentos", () => {
    expect(nombreDeAplicador("PANTA GUTIERREZ, PERCY AARÓN")).toBe("Panta Gutierrez, Percy Aarón");
    expect(nombreDeAplicador("Castillo SOLORSANO , LEIDY VIVIANA")).toBe("Castillo Solorsano, Leidy Viviana");
  });

  it("le quita el aire de más a la coma y entre palabras", () => {
    expect(nombreDeAplicador("Uribe Olaechea , Jesús Ramiro")).toBe("Uribe Olaechea, Jesús Ramiro");
    expect(nombreDeAplicador("  Cruzado   Mercado ,  Silbia Rosa  ")).toBe("Cruzado Mercado, Silbia Rosa");
  });

  it("lo que ya estaba bien escrito sale idéntico", () => {
    const bien = "Álvarez Espinosa Saldaña, José Alejandro";
    expect(nombreDeAplicador(bien)).toBe(bien);
  });

  it("las partículas se agachan, salvo cuando abren su bloque", () => {
    expect(nombreDeAplicador("RAMOS DE LA CRUZ, JUAN")).toBe("Ramos de la Cruz, Juan");
    // Un apellido que EMPIEZA con la partícula la conserva en alta: es su inicial.
    expect(nombreDeAplicador("DE LA CRUZ RAMOS, JUAN")).toBe("De la Cruz Ramos, Juan");
  });

  it("respeta guiones y apóstrofos, que también llevan mayúscula", () => {
    expect(nombreDeAplicador("D'ANGELO ROJAS, ANA-MARÍA")).toBe("D'Angelo Rojas, Ana-María");
  });

  it("sin coma no reordena: normaliza en un solo bloque", () => {
    expect(nombreDeAplicador("JUAN PEREZ")).toBe("Juan Perez");
  });

  it("el vacío devuelve vacío: no inventa un guion", () => {
    expect(nombreDeAplicador("")).toBe("");
    expect(nombreDeAplicador(null)).toBe("");
    expect(nombreDeAplicador("   ")).toBe("");
  });

  it("las iniciales salen del apellido y del primer nombre", () => {
    expect(inicialesDeAplicador("Castillo SOLORSANO , LEIDY VIVIANA")).toBe("CL");
    expect(inicialesDeAplicador("")).toBe("");
  });
});
