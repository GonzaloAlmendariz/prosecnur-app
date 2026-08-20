import { describe, expect, it } from "vitest";

import { aulasQueCierran, cierranConHasta, loQueFaltaParaCerrar, porFacultad } from "./loQueFaltaParaCerrar";

const fila = (o: Record<string, unknown>) => ({ operational_code: "CH 1", ...o });

describe("loQueFaltaParaCerrar", () => {
  it("sólo cuenta el umbral que el aula falló", () => {
    // Cumple total y falla población: el faltante sale del umbral de población
    // (18), no del de total (10), que el aula ya pasó. Tomar el mayor de los
    // dos sin mirar cuál falló daría 4 en un aula que necesita 4… y en el caso
    // simétrico daría un faltante inventado sobre un umbral ya alcanzado.
    const r = loQueFaltaParaCerrar([
      fila({ cumple_total: true, cumple_poblacion: false, sent_total: 14, threshold_total: 10, threshold_population: 18 }),
    ]);
    expect(r.aulas).toEqual([
      { codigo: "CH 1", facultad: "", faltan: 4, enviadas: 14, umbral: 18, falla: "poblacion" },
    ]);
    expect(r.costoTotal).toBe(4);

    // El control: el mismo aula al revés. Si el cálculo mirara los dos umbrales
    // en vez del que falló, este caso daría 4 también en vez de 0 aulas.
    const simetrico = loQueFaltaParaCerrar([
      fila({ cumple_total: false, cumple_poblacion: true, sent_total: 14, threshold_total: 18, threshold_population: 10 }),
    ]);
    expect(simetrico.aulas[0]).toMatchObject({ faltan: 4, umbral: 18, falla: "total" });
  });

  it("el umbral que falla no es siempre el mayor, y por eso hay que mirar cuál falló", () => {
    // **Este caso mató un mutante que los dos de arriba dejaban vivo.** En
    // ellos el umbral que fallaba era además el más alto, así que «el que
    // falló» y «el mayor de los dos» daban lo mismo y el aserto no distinguía
    // nada. Aquí no: el veredicto lo escribe el equipo en su hoja y manda sobre
    // la aritmética, así que un aula puede cumplir el umbral ALTO —porque la
    // hoja lo dice— y fallar el bajo. Mirar el mayor daría 4 donde faltan 2.
    const r = loQueFaltaParaCerrar([
      fila({ cumple_total: true, cumple_poblacion: false, sent_total: 14, threshold_total: 18, threshold_population: 16 }),
    ]);
    expect(r.aulas[0]).toMatchObject({ faltan: 2, umbral: 16, falla: "poblacion" });
  });

  it("cuando falla los dos, manda el umbral más exigente", () => {
    // Cerrar el mayor cierra el otro de paso; quedarse con el menor dejaría el
    // aula igual de no-efectiva después de gastar las encuestas.
    const r = loQueFaltaParaCerrar([
      fila({ cumple_total: false, cumple_poblacion: false, sent_total: 10, threshold_total: 14, threshold_population: 20 }),
    ]);
    expect(r.aulas[0]).toMatchObject({ faltan: 10, umbral: 20, falla: "ambos" });
  });

  it("un aula sin evaluar no tiene faltante, y no entra en el denominador", () => {
    // `null` es indeterminado en el motor. Contarla como no efectiva diría que
    // hay trabajo de campo pendiente donde lo que falta es llenar la hoja.
    const r = loQueFaltaParaCerrar([
      fila({ cumple_total: null, cumple_poblacion: null, sent_total: 3, threshold_total: 10 }),
      fila({ operational_code: "CH 2", cumple_total: true, cumple_poblacion: null, sent_total: 3, threshold_total: 10 }),
    ]);
    expect(r).toMatchObject({ noEfectivas: 0, aulas: [], sinCifras: 0, contradicciones: 0 });
  });

  it("una no efectiva sin cifras se dice aparte, no se pierde", () => {
    const r = loQueFaltaParaCerrar([
      fila({ cumple_total: false, cumple_poblacion: false, sent_total: 5 }),
      // Umbral escrito como proporción: no es un número de encuestas.
      fila({ operational_code: "CH 2", cumple_total: false, cumple_poblacion: true, sent_total: 5, threshold_total: 0.7 }),
    ]);
    expect(r).toMatchObject({ noEfectivas: 2, sinCifras: 2 });
    expect(r.aulas).toHaveLength(0);
  });

  it("un «no cumple» con las enviadas ya sobre el umbral es una contradicción de la hoja", () => {
    // No es un faltante de cero: la hoja se contradice a sí misma y eso se
    // cuenta aparte para que no se lea como «esta ya está».
    const r = loQueFaltaParaCerrar([
      fila({ cumple_total: false, cumple_poblacion: true, sent_total: 30, threshold_total: 20 }),
    ]);
    expect(r).toMatchObject({ noEfectivas: 1, contradicciones: 1, costoTotal: 0 });
    expect(r.aulas).toHaveLength(0);

    // **El borde exacto, que mató el segundo mutante superviviente**: enviadas
    // IGUAL al umbral y la hoja diciendo que no cumple. Con `faltan < 0` esta
    // aula entraba en la lista con «faltan 0», que en una cola de trabajo
    // ordenada por esfuerzo es lo más barato que hay y encabezaría la lista.
    const justo = loQueFaltaParaCerrar([
      fila({ cumple_total: false, cumple_poblacion: true, sent_total: 20, threshold_total: 20 }),
    ]);
    expect(justo).toMatchObject({ contradicciones: 1 });
    expect(justo.aulas).toHaveLength(0);
  });

  it("el presupuesto se gasta de la más barata a la más cara", () => {
    const r = loQueFaltaParaCerrar([
      fila({ operational_code: "CH 9", cumple_total: false, cumple_poblacion: true, sent_total: 1, threshold_total: 11 }),
      fila({ operational_code: "CH 3", cumple_total: false, cumple_poblacion: true, sent_total: 9, threshold_total: 11 }),
      fila({ operational_code: "CH 7", cumple_total: false, cumple_poblacion: true, sent_total: 6, threshold_total: 11 }),
    ]);
    expect(r.aulas.map((a) => a.faltan)).toEqual([2, 5, 10]);
    // Con 7 encuestas cierran las dos primeras y sobra 0; la tercera cuesta 10.
    expect(aulasQueCierran(r.aulas, 7)).toEqual({ cerradas: 2, gasto: 7 });
    // El control del orden: si la lista no estuviera ordenada por costo, el
    // presupuesto de 7 se gastaría en la de 10 y cerraría cero.
    expect(aulasQueCierran(r.aulas, 6)).toEqual({ cerradas: 1, gasto: 2 });
    expect(cierranConHasta(r.aulas, 5)).toBe(2);
  });
});

describe("porFacultad", () => {
  const aula = (facultad: string, faltan: number, codigo: string) => ({
    codigo, facultad, faltan, enviadas: 0, umbral: faltan, falla: "total" as const,
  });

  it("encabeza la facultad que más aulas cierra, no la más barata", () => {
    // **Este aserto corrige mi propio diseño.** Ordenado por costo, la primera
    // era una facultad de UNA aula a dos encuestas: la salida más barata en
    // encuestas y la peor en rendimiento, porque ir a cerrar un aula cuesta la
    // misma visita que ir a cerrar cuatro. La pregunta es a dónde ir.
    const r = porFacultad([
      aula("Minas", 2, "CH 1"),
      aula("Derecho", 6, "CH 2"),
      aula("Derecho", 7, "CH 3"),
      aula("Derecho", 4, "CH 4"),
    ]);
    expect(r.filas.map((f) => f.facultad)).toEqual(["Derecho", "Minas"]);
    // 6, 7 y 4: sólo una está a cinco o menos.
    expect(r.filas[0]).toEqual({ facultad: "Derecho", aulas: 3, costo: 17, baratas: 1 });
  });

  it("a igual número de aulas manda la más barata", () => {
    const r = porFacultad([aula("A", 9, "1"), aula("B", 3, "2")]);
    expect(r.filas.map((f) => f.facultad)).toEqual(["B", "A"]);
  });

  it("un aula que no cruzó con el plan se cuenta aparte, no crea una facultad", () => {
    // Una fila «Sin facultad» competiría en la misma lista con facultades
    // reales, y en este perfil un homónimo ya se hizo pasar por conexión.
    const r = porFacultad([aula("", 3, "1"), aula("", 4, "2"), aula("A", 5, "3")]);
    expect(r.sinFacultad).toBe(2);
    expect(r.filas).toEqual([{ facultad: "A", aulas: 1, costo: 5, baratas: 1 }]);
  });
});
