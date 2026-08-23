import { describe, expect, it } from "vitest";
import { avisoLibroGenerado } from "./avisoLibroGenerado";

describe("avisoLibroGenerado", () => {
  it("dice lo que viaja dentro cuando el operativo está en marcha", () => {
    expect(avisoLibroGenerado({ unidades: 269, partes: 152, control: 152 })).toBe(
      "Libro de 269 aulas, con 152 partes de campo y 152 filas de control ya registrados dentro.",
    );
  });

  it("un libro nuevo dice por qué las columnas salen vacías", () => {
    // El control: sin esta rama, un libro sin nada registrado diría «con  ya
    // registrados dentro» o callaría, y quien lo abre no sabe si perdió algo.
    const texto = avisoLibroGenerado({ unidades: 269, partes: 0, control: 0 });
    expect(texto).toContain("todavía no hay nada registrado");
    expect(texto).not.toContain("0 partes");
  });

  it("omite la mitad que no tiene nada, sin dejar la conjunción suelta", () => {
    const texto = avisoLibroGenerado({ unidades: 269, partes: 130, control: 0 });
    expect(texto).toBe("Libro de 269 aulas, con 130 partes de campo ya registrados dentro.");
    expect(texto).not.toContain(" y ");
  });

  it("no dice «1 partes de campo»", () => {
    expect(avisoLibroGenerado({ unidades: 3, partes: 1, control: 1 })).toBe(
      "Libro de 3 aulas, con 1 parte de campo y 1 fila de control ya registrados dentro.",
    );
  });
});

describe("avisoLibroGenerado · qué lleva el libro dentro", () => {
  it("desglosa las visitas de las reservas en vez de sumarlas", () => {
    // Medido el 2026-08-23: decía «Libro de 700 aulas», y 700 no son 700
    // visitas — son 193 cursos-horario y 507 reservas que sólo entran si una
    // titular cae. Es el mismo efecto colateral que dejó «Libro de 2616 aulas»
    // sobre un libro de 190, arreglado allí sin revisar quién más lo contaba.
    expect(avisoLibroGenerado({ unidades: 700, partes: 0, control: 0, titulares: 193, reservas: 507 }))
      .toContain("Libro de 193 cursos-horario y sus 507 reservas");
  });

  it("no menciona reservas cuando el libro no lleva ninguna", () => {
    expect(avisoLibroGenerado({ unidades: 193, partes: 0, control: 0, titulares: 193, reservas: 0 }))
      .toContain("Libro de 193 cursos-horario.");
  });

  it("cae al total si el desglose no cuadra, en vez de dar un reparto inventado", () => {
    // Un libro viejo o un backend que no manda el desglose. Decir «120 y 500»
    // sobre un libro de 700 sería peor que decir 700 a secas.
    expect(avisoLibroGenerado({ unidades: 700, partes: 0, control: 0, titulares: 120, reservas: 500 }))
      .toContain("Libro de 700 aulas");
    expect(avisoLibroGenerado({ unidades: 700, partes: 0, control: 0 }))
      .toContain("Libro de 700 aulas");
    expect(avisoLibroGenerado({ unidades: 700, partes: 0, control: 0, titulares: null, reservas: null }))
      .toContain("Libro de 700 aulas");
  });

  it("no dice «1 cursos-horario» ni «1 reservas»", () => {
    expect(avisoLibroGenerado({ unidades: 2, partes: 0, control: 0, titulares: 1, reservas: 1 }))
      .toContain("Libro de 1 curso-horario y sus 1 reserva");
  });

  it("se lee con separador de miles, que es como se leen 2.616", () => {
    expect(avisoLibroGenerado({ unidades: 2616, partes: 0, control: 0, titulares: 193, reservas: 2423 }))
      .toContain("2,423 reservas");
  });
});
