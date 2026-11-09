import { describe, expect, it } from "vitest";
import { seriesConCifraFinal } from "./FaltanteDiario";
import { cadenaDeLaCifra, construirCuotasFaltante, llevaFaltanteDiario, type CuotaDeEntrada } from "./cuotasFaltanteModel";
import { conCaracter, sinAsignarDesdeBloque } from "./entradaDeCuotas";

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

  it('Sin asignar sale de la fila "Sin responsable" y es nulo si el bloque no viaja', () => {
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

describe("Avance › Cuotas: metas y referenciales separadas (ADR 0126)", () => {
  // Tres sedes: dos metas y una referencial declarada con número de referencia.
  const sjl = cuota("SJL", 50, 30, [], { universe: 200, pending: 20 });
  const smp = cuota("SMP", 40, 40, [], { universe: 150, pending: 10 });
  const pl = cuota("PL", 25, 10, [], { universe: 50, pending: 5, caracter: "referencial" });

  it("la referencial no entra a la tabla de metas ni a su total", () => {
    const modelo = construirCuotasFaltante({ cuotas: [sjl, smp, pl], segmento: "Sede", sinAsignar: null });
    expect(modelo.filas.map((fila) => fila.clave)).toEqual(["SJL", "SMP"]);
    expect(modelo.total.meta).toBe(90);
    expect(modelo.total.faltan).toBe(20);
    // El % de la meta se mide con las efectivas de las metas, no con las de PL.
    expect(modelo.total.efectivasDeMetas).toBe(70);
    expect(modelo.total.pct).toBeCloseTo((70 / 90) * 100, 5);
    // «De dónde sale la cifra» y el listado siguen contando todo.
    expect(modelo.total.efectivas).toBe(80);
    expect(modelo.todas).toHaveLength(3);
    expect(modelo.total.universo).toBe(400);
  });

  it("la referencial se describe frente al listado, con su n y sin faltante", () => {
    const modelo = construirCuotasFaltante({ cuotas: [sjl, smp, pl], segmento: "Sede", sinAsignar: null });
    expect(modelo.referenciales).toHaveLength(1);
    const ref = modelo.referenciales[0];
    expect(ref.efectivas).toBe(10);
    expect(ref.obtenida).toBeCloseTo(12.5, 5); // 10 de 80
    expect(ref.esperada).toBeCloseTo(12.5, 5); // 50 de 400
    expect(ref.diferencia).toBeCloseTo(0, 5);
    expect(ref.referencia).toBe(25);
    expect(ref.estadoCuota).toBe("referencial");
    expect(modelo.todas.find((fila) => fila.clave === "PL")?.meta).toBeNull();
  });

  it("sin declarar nada, una categoría sin número es referencial y una con número es meta", () => {
    const modelo = construirCuotasFaltante({
      cuotas: [cuota("A", 10, 4, []), cuota("B", null, 6, [])],
      segmento: "Sede",
      sinAsignar: null,
    });
    expect(modelo.filas.map((fila) => fila.clave)).toEqual(["A"]);
    expect(modelo.referenciales.map((fila) => fila.clave)).toEqual(["B"]);
    expect(modelo.filas[0].estadoCuota).toBe("falta");
  });

  it("una referencial con listado y ninguna efectiva es celda vacía; sin listado no hay comparador", () => {
    const modelo = construirCuotasFaltante({
      cuotas: [
        cuota("A", 10, 10, []),
        cuota("B", null, 0, [], { universe: 30 }),
        cuota("C", null, 2, [], { universe: 0 }),
      ],
      segmento: "Sede",
      sinAsignar: null,
    });
    const [b, c] = modelo.referenciales;
    expect(b.celdaVacia).toBe(true);
    expect(c.celdaVacia).toBe(false);
    expect(c.estadoCuota).toBe("sin_comparador");
  });
});

describe("Avance › Cuotas: el total no compensa entre celdas (ADR 0079 y 0126)", () => {
  it("el exceso de una cuota no cubre el faltante de otra", () => {
    const modelo = construirCuotasFaltante({
      cuotas: [cuota("A", 5, 10, []), cuota("B", 5, 0, []), cuota("C", 0, 3, [])],
      segmento: "Sede",
      sinAsignar: null,
    });
    expect(modelo.total.meta).toBe(10);
    expect(modelo.total.faltan).toBe(5);
    expect(modelo.total.pct).toBeCloseTo(50, 5);
    // La meta 0 sin declarar sigue siendo meta, pero no entra a la suma con número.
    expect(modelo.filas.map((fila) => fila.clave)).toEqual(["A", "B", "C"]);
    expect(modelo.total.efectivasDeMetas).toBe(10);
  });

  it('el carácter se cruza por variable y valor: un "Sí" de otra variable no es el mismo', () => {
    const filas = [
      { Actor: "Total", Variable: "Sede", Valor: "Sí", Caracter: "meta", estado_cuota: "falta" },
      { Actor: "Total", Variable: "Acepta", Valor: "Sí", Caracter: "referencial", Referencia: 30, estado_cuota: "referencial" },
    ];
    const [sede] = conCaracter([cuota("phone-quota-sede-si", 10, 2, [], { actor: "Sí" })], filas);
    expect(sede.caracter).toBe("meta");
    const [acepta] = conCaracter([cuota("phone-quota-acepta-si", null, 2, [], { actor: "Sí" })], filas);
    expect(acepta).toMatchObject({ caracter: "referencial", referencia: 30 });
  });
});
