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
