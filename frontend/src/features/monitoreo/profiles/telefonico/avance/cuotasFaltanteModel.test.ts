import { describe, expect, it } from "vitest";
import { seriesConCifraFinal } from "./FaltanteDiario";
import { cadenaDeLaCifra, construirCuotasFaltante, llevaFaltanteDiario, type CuotaDeEntrada } from "./cuotasFaltanteModel";
import { sinAsignarDesdeBloque } from "./entradaDeCuotas";

function cuota(id: string, meta: number | null, efectivas: number, serie: Array<[string, number]>, extra: Partial<CuotaDeEntrada> = {}): CuotaDeEntrada {
  return {
    id,
    actor: id,
    universe: 100,
    effective: efectivas,
    partial: 0,
    refusals: 0,
    pending: 40,
    meta,
    dailyPoints: serie.map(([date, effective]) => ({ date, effective })),
    ...extra,
  };
}

// Medios de Vida 2026 (ficha «Avance, Cuotas»): Homologación 56 de 80 y
// Vinculación 14 de 20, faltante diario 66, 56, 48, 35, 24 y 16, 13, 12, 10, 6.
const homologacion = cuota("Homologación de Títulos", 80, 56, [
  ["2026-08-04", 14], ["2026-08-05", 10], ["2026-08-06", 8], ["2026-08-07", 13], ["2026-08-08", 11],
], { universe: 156, pending: 18 });
const vinculacion = cuota("Vinculación Laboral", 20, 14, [
  ["2026-08-04", 4], ["2026-08-05", 3], ["2026-08-06", 1], ["2026-08-07", 2], ["2026-08-08", 4],
], { universe: 27, pending: 1 });

describe("Avance › Cuotas del telefónico", () => {
  it("el número grande es la suma de la columna Faltan", () => {
    const modelo = construirCuotasFaltante({ cuotas: [homologacion, vinculacion], segmento: "Actor", sinAsignar: 19 });
    expect(modelo.filas.map((fila) => fila.faltan)).toEqual([24, 6]);
    expect(modelo.total.faltan).toBe(30);
    expect(modelo.total.meta).toBe(100);
    expect(modelo.total.efectivas).toBe(70);
    expect(modelo.filas.every((fila) => fila.estado === "en-curso")).toBe(true);
  });

  it("el faltante diario reproduce la ficha de Medios de Vida", () => {
    const modelo = construirCuotasFaltante({ cuotas: [homologacion, vinculacion], segmento: "Actor", sinAsignar: 19 });
    expect(modelo.faltanteDiario.series.map((serie) => serie.valores)).toEqual([
      [66, 56, 48, 35, 24],
      [16, 13, 12, 10, 6],
    ]);
    expect(llevaFaltanteDiario(modelo)).toBe(true);
    expect(modelo.total.desde).toBe("04/08");
    expect(modelo.total.hasta).toBe("08/08");
    expect(modelo.total.cumplio).toBeNull();
  });

  it("ritmo por día con envíos y rendimiento como registros barridos por efectiva", () => {
    const modelo = construirCuotasFaltante({ cuotas: [homologacion, vinculacion], segmento: "Actor", sinAsignar: 19 });
    expect(modelo.ritmo?.porDia).toBe(14);
    expect(modelo.ritmo?.dias).toBe(5);
    // Barridos: (156 − 18) + (27 − 1) = 164; 164 ÷ 70 = 2.34.
    expect(modelo.rendimiento).toBeCloseTo(164 / 70, 5);
  });

  it("una cuota cubierta marca la fecha en que el acumulado alcanzó la meta, con faltante cero", () => {
    const sjl = cuota("SJL", 107, 109, [["2026-06-30", 10], ["2026-07-01", 40], ["2026-07-05", 59]]);
    const smp = cuota("SMP", 99, 110, [["2026-06-30", 20], ["2026-07-01", 79], ["2026-07-04", 11]]);
    const modelo = construirCuotasFaltante({ cuotas: [sjl, smp], segmento: "Sede", sinAsignar: null });
    expect(modelo.filas.map((fila) => [fila.estado, fila.faltan, fila.cumplio])).toEqual([
      ["cumple", 0, "05/07"],
      ["cumple", 0, "01/07"],
    ]);
    // El total se cumple con la última cuota, no cuando la suma pasa la meta.
    expect(modelo.total.cumplio).toBe("05/07");
    expect(modelo.total.faltan).toBe(0);
  });

  it("sin metas no hay faltante ni gráfico diario", () => {
    const modelo = construirCuotasFaltante({ cuotas: [cuota("A", null, 5, [["2026-08-04", 5]])], segmento: "Actor", sinAsignar: null });
    expect(modelo.total.meta).toBeNull();
    expect(modelo.total.faltan).toBeNull();
    expect(llevaFaltanteDiario(modelo)).toBe(false);
  });

  it("el reparto de la base suma el listado de cada categoría", () => {
    const fila = construirCuotasFaltante({
      cuotas: [cuota("SJL", 107, 109, [], { universe: 614, pending: 456, refusals: 3 })],
      segmento: "Sede",
      sinAsignar: null,
    }).filas[0];
    expect(fila.efectivas + fila.rechazoOParcial + fila.llamadoSinEfectiva + fila.sinLlamar).toBe(614);
  });

  it("Sin asignar sale de la fila «Sin responsable» y es nulo si el bloque no viaja", () => {
    expect(sinAsignarDesdeBloque([
      { Responsable: "Sin responsable", "No barridos": 1197 },
      { Responsable: "Op-01", "No barridos": 49 },
    ])).toBe(1197);
    expect(sinAsignarDesdeBloque([])).toBeNull();
  });

  it("la cadena no inventa pasos que el corte no trae", () => {
    expect(cadenaDeLaCifra({ recibidas: null, encuesta: "", pasanFiltro: 424, criterios: "Intro/Consent: Yes", unicas: 423 })
      .map((paso) => paso.valor)).toEqual([424, 423]);
  });
});

describe("seriesConCifraFinal", () => {
  it("salta la cifra que se montaría sobre la anterior en el eje", () => {
    // RMS ficticio: 23, 11, 5 y 1 sobre un eje de 100; el 5 y el 1 caerían sobre el punto de encima.
    expect([...seriesConCifraFinal([23, 11, 5, 1], 100)].sort()).toEqual([0, 1]);
    expect([...seriesConCifraFinal([60, 30], 100)].sort()).toEqual([0, 1]);
  });

  it("mide la separación en píxeles del lienzo: lo que cabe a 1920 se salta a 1440", () => {
    // Verificador, 2026-10-27: a 1440 el lienzo mide ~130 px y el 11 se montaba sobre el punto del 23.
    expect([...seriesConCifraFinal([23, 11, 5, 1], 100, 330)].sort()).toEqual([0, 1]);
    expect([...seriesConCifraFinal([23, 11, 5, 1], 100, 130)].sort()).toEqual([0]);
  });
});
