import { describe, expect, it } from "vitest";

import type { MonitoreoRow } from "../../../../api/monitoreo";
import { fechaDeAplicacion, ritmoPorFacultad } from "./ritmoPorFacultad";

const parte = (f: Partial<MonitoreoRow>) => f as MonitoreoRow;
const dia = (fecha: string, faculty: string, efectivas: number) =>
  parte({ applied_at: `${fecha} 10:00`, faculty, effective_surveys: efectivas });

describe("ritmoPorFacultad", () => {
  it("un día sin recoger sale como cero y no desaparece", () => {
    // Una facultad parada tres días es justo lo que hay que ver; si el día se
    // omite, la serie se lee como si hubiera trabajado todos.
    const { facultades, fechas } = ritmoPorFacultad([
      dia("2026-08-10", "Derecho", 20),
      dia("2026-08-12", "Derecho", 10),
      dia("2026-08-11", "Letras", 5),
    ]);
    expect(fechas).toEqual(["2026-08-10", "2026-08-11", "2026-08-12"]);
    const derecho = facultades.find((f) => f.facultad === "Derecho")!;
    expect(derecho.dias.map((d) => d.efectivas)).toEqual([20, 0, 10]);
    expect(derecho.diasConCampo).toBe(2);
    // La media es por día CON campo: 30/2, no 30/3.
    expect(derecho.mediaDiaria).toBe(15);
  });

  it("la tendencia compara mitades y necesita cuatro días", () => {
    const conTres = ritmoPorFacultad([
      dia("2026-08-10", "X", 10), dia("2026-08-11", "X", 10), dia("2026-08-12", "X", 10),
    ]).facultades[0];
    // Con tres días la «tendencia» es ruido: se declara nula en vez de inventarla.
    expect(conTres.tendencia).toBeNull();

    const cayendo = ritmoPorFacultad([
      dia("2026-08-10", "X", 20), dia("2026-08-11", "X", 20),
      dia("2026-08-12", "X", 10), dia("2026-08-13", "X", 10),
    ]).facultades[0];
    expect(cayendo.tendencia).toBe(-50);
  });

  it("abre por la que más cae, y las incalculables van al final", () => {
    const { facultades } = ritmoPorFacultad([
      dia("2026-08-10", "Cae", 20), dia("2026-08-11", "Cae", 20),
      dia("2026-08-12", "Cae", 5), dia("2026-08-13", "Cae", 5),
      dia("2026-08-10", "Sube", 5), dia("2026-08-11", "Sube", 5),
      dia("2026-08-12", "Sube", 20), dia("2026-08-13", "Sube", 20),
      dia("2026-08-10", "Corta", 99),
    ]);
    expect(facultades.map((f) => f.facultad)).toEqual(["Cae", "Sube", "Corta"]);
    expect(facultades[2].tendencia).toBeNull();
  });

  it("la fecha se saca del campo que de verdad viaja", () => {
    // El parte publicado manda `applied_at` con fecha y hora juntas.
    expect(fechaDeAplicacion("2026-08-11 10:00")).toBe("2026-08-11");
    expect(fechaDeAplicacion("")).toBe("");
    expect(fechaDeAplicacion("mañana")).toBe("");
  });
});

describe("una tendencia sólo se llama tendencia si el ruido no la explica", () => {
  // Medido sobre el corte: la producción diaria del ESTUDIO es plana —de 313 a
  // 390 efectivas al día— y aun así siete facultades salían «a menos ritmo que
  // al empezar», con caídas de hasta el 47,9 %. Educación es el caso: 165
  // efectivas en la primera mitad y 86 en la segunda, con 5 aulas contra 4 y una
  // sola aula al día, en un estudio donde un aula deja entre 13 y 74.
  const parteDe = (facultad: string, applied_date: string, effective_surveys: number) =>
    ({ faculty: facultad, applied_date, effective_surveys }) as unknown as MonitoreoRow;

  const conDias = (facultad: string, valores: number[]) =>
    valores.map((v, i) => parteDe(facultad, `2026-08-${String(10 + i).padStart(2, "0")}`, v));

  it("el caso real de Educación no se declara: cabe en su vaivén", () => {
    // 28, 32, 74, 31 | 31, 19, 23, 13 — un −47,9 % que sale de que un día
    // hubo dos aulas y del tamaño de una sola.
    const { facultades } = ritmoPorFacultad(conDias("Educacion", [28, 32, 74, 31, 31, 19, 23, 13]));
    const f = facultades[0];
    expect(f.tendencia).toBeLessThan(-40);
    expect(f.distinguible).toBe(false);
  });

  it("pero una caída sostenida y limpia SÍ se declara", () => {
    // 40 constantes y luego 10 constantes: sin vaivén interno, la diferencia no
    // puede venir del azar. Si esto no se declarara, el guard sobraría.
    const { facultades } = ritmoPorFacultad(conDias("Clara", [40, 41, 39, 40, 10, 11, 9, 10]));
    const f = facultades[0];
    expect(f.tendencia).toBeLessThan(-70);
    expect(f.distinguible).toBe(true);
  });

  it("una subida limpia también", () => {
    const { facultades } = ritmoPorFacultad(conDias("Sube", [10, 11, 9, 10, 40, 41, 39, 40]));
    expect(facultades[0].tendencia).toBeGreaterThan(70);
    expect(facultades[0].distinguible).toBe(true);
  });

  it("con menos de cuatro días no hay tendencia ni pretensión de tenerla", () => {
    const { facultades } = ritmoPorFacultad(conDias("Corta", [30, 20, 25]));
    expect(facultades[0].tendencia).toBeNull();
    expect(facultades[0].distinguible).toBe(false);
  });

  it("primero las que caen de verdad, después las que sólo hacen ruido", () => {
    // Ordenar por la cifra a secas ponía arriba a la que más vaivén tiene, que
    // no es lo mismo que la que más cae.
    const { facultades } = ritmoPorFacultad([
      ...conDias("Ruidosa", [28, 32, 74, 31, 31, 19, 23, 13]),   // −48 %, ruido
      ...conDias("Real", [40, 41, 39, 40, 22, 23, 21, 22]),      // −45 %, limpia
    ]);
    expect(facultades.map((f) => f.facultad)).toEqual(["Real", "Ruidosa"]);
    expect(facultades[0].tendencia).toBeGreaterThan(facultades[1].tendencia!);
  });
});
