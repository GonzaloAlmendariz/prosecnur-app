import { describe, expect, it } from "vitest";

import { facultadCorta, facultadEnPalabras } from "./facultadEnPalabras";

describe("el nombre de una facultad se escribe igual en todas partes", () => {
  it("baja las mayúsculas del libro sin perder los nombres propios", () => {
    expect(facultadEnPalabras("ARTE Y DISEÑO")).toBe("Arte y Diseño");
    expect(facultadEnPalabras("CIENCIAS SOCIALES")).toBe("Ciencias Sociales");
    expect(facultadEnPalabras("DERECHO")).toBe("Derecho");
  });

  it("repone las tildes que el marco no trae", () => {
    expect(facultadEnPalabras("EDUCACION")).toBe("Educación");
    expect(facultadEnPalabras("PSICOLOGIA")).toBe("Psicología");
    expect(facultadEnPalabras("CIENCIAS E INGENIERIA")).toBe("Ciencias e Ingeniería");
    expect(facultadEnPalabras("ARTES ESCENICAS")).toBe("Artes Escénicas");
  });

  it("las átonas van en minúscula salvo al empezar", () => {
    expect(facultadEnPalabras("CIENCIAS Y ARTES DE LA COMUNICACION"))
      .toBe("Ciencias y Artes de la Comunicación");
    expect(facultadEnPalabras("DE LA CIENCIA")).toBe("De la Ciencia");
  });

  it("las siglas del marco no se capitalizan", () => {
    expect(facultadEnPalabras("EEGG LETRAS")).toBe("EE.GG. Letras");
    expect(facultadEnPalabras("ESTUDIOS GENERALES CIENCIAS")).toBe("Estudios Generales Ciencias");
  });

  it("un nombre que YA venía bien escrito no se toca", () => {
    // Si alguien lo tecleó a mano con su grafía, respetarla es lo correcto: la
    // normalización existe para el libro que grita, no para corregir a nadie.
    expect(facultadEnPalabras("Facultad de Derecho")).toBe("Facultad de Derecho");
  });

  it("el vacío sigue siendo vacío, no «»", () => {
    expect(facultadEnPalabras("")).toBe("");
    expect(facultadEnPalabras(null)).toBe("");
  });
});

describe("la forma corta acorta DESPUÉS de normalizar", () => {
  /**
   * El defecto que esto cierra: el mapa acortaba siete nombres por su forma
   * conocida y dejaba los demás en MAYÚSCULAS, así que convivían las dos
   * grafías en el mismo gráfico, a dos centímetros una de otra.
   */
  it("acorta los largos", () => {
    expect(facultadCorta("ESTUDIOS GENERALES LETRAS")).toBe("EE.GG. Letras");
    expect(facultadCorta("CIENCIAS E INGENIERIA")).toBe("CC. e Ingeniería");
    expect(facultadCorta("LETRAS Y CIENCIAS HUMANAS")).toBe("Letras y CC.HH.");
    expect(facultadCorta("GESTION Y ALTA DIRECCION")).toBe("Gestión");
  });

  it("y normaliza también los que NO acorta, que es el defecto que había", () => {
    expect(facultadCorta("ARTE Y DISEÑO")).toBe("Arte y Diseño");
    expect(facultadCorta("DERECHO")).toBe("Derecho");
    expect(facultadCorta("EDUCACION")).toBe("Educación");
    expect(facultadCorta("PSICOLOGIA")).toBe("Psicología");
  });

  it("ninguna forma corta se queda en mayúsculas sostenidas", () => {
    const marco = [
      "ARQUITECTURA Y URBANISMO", "ARTE Y DISEÑO", "ARTES ESCENICAS",
      "CIENCIAS E INGENIERIA", "CIENCIAS SOCIALES", "CIENCIAS Y ARTES DE LA COMUNICACION",
      "DERECHO", "EDUCACION", "ESTUDIOS GENERALES CIENCIAS", "ESTUDIOS GENERALES LETRAS",
      "GASTRONOMIA", "GESTION Y ALTA DIRECCION", "LETRAS Y CIENCIAS HUMANAS", "PSICOLOGIA",
    ];
    for (const f of marco) {
      const corta = facultadCorta(f);
      expect(corta, f).not.toBe(corta.toUpperCase());
      expect(corta, f).not.toMatch(/[A-ZÁÉÍÓÚÑ]{4,}/);
    }
  });
});
