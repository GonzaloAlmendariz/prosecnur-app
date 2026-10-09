import { describe, expect, it } from "vitest";
import { ordenarPorFacultadYSexo } from "./ordenFacultadSexo";

/**
 * El orden canónico de toda lista facultad × sexo del perfil, y lo fijó Gonzalo
 * con estas palabras: «la vista prioritaria es siempre por facultad y en
 * facultad hombre y mujeres, el cruce de ambos no va separado, o sea no puedo
 * tener hombre de una facultad y mujeres de otra».
 *
 * Reparó un defecto medido —ordenando por la magnitud de la celda, «GESTIÓN Y
 * ALTA DIRECCIÓN · F» salía primera y su «· M» en la cuarta fila, con
 * «PSICOLOGÍA · F» y «· M» a doce filas de distancia— y no tenía prueba: salió
 * del barrido de los 249 exportados del perfil el 2026-08-30.
 *
 * Se comprueba la SECUENCIA, no el signo del comparador ni el locale: `Intl`
 * degrada en el runner y daría un rojo del entorno.
 */
const celda = (faculty: string, sex: string, n = 0) => ({ faculty, sex, n });
const clave = (fs: ReturnType<typeof celda>[]) => fs.map((f) => `${f.faculty}·${f.sex}`);

describe("el orden canónico es por facultad, y dentro por sexo", () => {
  it("las dos celdas de una facultad nunca se separan", () => {
    const r = ordenarPorFacultadYSexo([
      celda("GESTIÓN", "F"), celda("PSICOLOGÍA", "M"),
      celda("GESTIÓN", "M"), celda("PSICOLOGÍA", "F"),
    ]);
    expect(clave(r)).toEqual(["GESTIÓN·F", "GESTIÓN·M", "PSICOLOGÍA·F", "PSICOLOGÍA·M"]);
  });

  it("F va antes que M aunque su cifra sea menor: el orden NO depende del dato", () => {
    // Es la condición que hace la lista legible en vertical: si en una facultad
    // fuera M-F y en otra F-M, la segunda fila de cada bloque no significaría lo
    // mismo.
    const r = ordenarPorFacultadYSexo([celda("DERECHO", "M", 900), celda("DERECHO", "F", 1)]);
    expect(clave(r)).toEqual(["DERECHO·F", "DERECHO·M"]);
  });

  it("con peso compiten las FACULTADES por su suma, no las celdas sueltas", () => {
    // EDUCACIÓN suma 30 y DERECHO 21: EDUCACIÓN va antes, con sus dos celdas
    // juntas, aunque la celda mayor de todas (20) sea de DERECHO.
    const r = ordenarPorFacultadYSexo([
      celda("DERECHO", "F", 20), celda("EDUCACIÓN", "F", 15),
      celda("DERECHO", "M", 1), celda("EDUCACIÓN", "M", 15),
    ], (f) => f.n);
    expect(clave(r)).toEqual(["EDUCACIÓN·F", "EDUCACIÓN·M", "DERECHO·F", "DERECHO·M"]);
  });

  it("sin peso las facultades van alfabéticas, no en el orden que llegaron", () => {
    const r = ordenarPorFacultadYSexo([celda("PSICOLOGÍA", "F"), celda("DERECHO", "F")]);
    expect(clave(r)).toEqual(["DERECHO·F", "PSICOLOGÍA·F"]);
  });

  it("«Mujeres»/«Hombres» ordenan igual que «F»/«M»", () => {
    const r = ordenarPorFacultadYSexo([celda("DERECHO", "Hombres"), celda("DERECHO", "Mujeres")]);
    expect(clave(r)).toEqual(["DERECHO·Mujeres", "DERECHO·Hombres"]);
  });

  it("un sexo que no reconoce va al final de su facultad, no al principio", () => {
    // Si colara primero, encabezaría el bloque una fila que nadie sabe qué es.
    const r = ordenarPorFacultadYSexo([
      celda("DERECHO", "X"), celda("DERECHO", "M"), celda("DERECHO", "F"),
    ]);
    expect(clave(r)).toEqual(["DERECHO·F", "DERECHO·M", "DERECHO·X"]);
  });

  it("no muta la lista que recibe", () => {
    const original = [celda("PSICOLOGÍA", "F"), celda("DERECHO", "F")];
    const copia = clave(original);
    ordenarPorFacultadYSexo(original);
    expect(clave(original)).toEqual(copia);
  });
});
