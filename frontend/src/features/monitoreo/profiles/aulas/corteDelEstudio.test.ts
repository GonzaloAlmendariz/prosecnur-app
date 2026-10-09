import { describe, expect, it } from "vitest";

import { corteDelEstudio } from "./corteDelEstudio";

/**
 * El caso medido en pantalla sobre el proyecto simulado: el panel de vencidos
 * decía «al 27 de agosto» —el reloj de la máquina— con el estudio sincronizado
 * al 12/09/2026, y de ahí sacaba «174 aún por venir» con 78 ya aplicadas.
 */
describe("el «hoy» del estudio es el último parte, no el sello del tablero", () => {
  it("toma el día más tarde con parte, en cualquier orden", () => {
    const c = corteDelEstudio([
      { applied_at: "2026-09-07" },
      { applied_at: "2026-09-12" },
      { applied_at: "2026-09-09" },
    ], "2026-08-27T13:00:00Z");
    expect(c).toEqual({ dia: "2026-09-12", esDelCampo: true });
  });

  it("el sello del tablero NO manda cuando hay campo, ni siquiera si es posterior", () => {
    // Un tablero abierto en diciembre sobre un campo de septiembre no vuelve
    // vencido todo el operativo.
    const c = corteDelEstudio([{ applied_at: "2026-09-12" }], "2026-12-01T09:00:00Z");
    expect(c.dia).toBe("2026-09-12");
  });

  it("acepta `applied_date` además de `applied_at`", () => {
    expect(corteDelEstudio([{ applied_date: "2026-09-10" }], "").dia).toBe("2026-09-10");
  });

  it("sin ningún parte cae al sello y LO DECLARA", () => {
    // No hay reloj de campo todavía. Devolver el sello está bien; afirmarlo como
    // corte medido, no — por eso `esDelCampo` viaja.
    const c = corteDelEstudio([], "2026-08-27T13:00:00Z");
    expect(c).toEqual({ dia: "2026-08-27", esDelCampo: false });
  });

  it("partes sin fecha no cuentan como campo", () => {
    const c = corteDelEstudio([{ applied_at: "" }, { operational_code: "CH 1" }], "2026-08-27");
    expect(c.esDelCampo).toBe(false);
  });

  it("sin partes y sin sello devuelve vacío en vez de inventar una fecha", () => {
    expect(corteDelEstudio([], "")).toEqual({ dia: "", esDelCampo: false });
  });
});

describe("el fallback del corte vive en el día LOCAL, no en el de Londres", () => {
  it("un sello UTC de la noche no adelanta el corte al día siguiente", () => {
    // 22:00 del día local: en Lima su ISO UTC ya es el día siguiente
    // («…T03:00:00Z»). El corte tiene que decir el día que el campo vive.
    const noche = new Date(2026, 8, 2, 22, 0, 0);
    const esperado = `${noche.getFullYear()}-${String(noche.getMonth() + 1).padStart(2, "0")}-${
      String(noche.getDate()).padStart(2, "0")}`;
    expect(corteDelEstudio([], noche.toISOString())).toEqual({ dia: esperado, esDelCampo: false });
  });

  it("lo no parseable conserva la rebanada de siempre; el vacío queda vacío", () => {
    expect(corteDelEstudio([], "2026-09-02").dia).toBe("2026-09-02");
    expect(corteDelEstudio([], "").dia).toBe("");
  });
});
