import { describe, expect, it } from "vitest";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { consumoDelBanco } from "./consumoDelBanco";

const fila = (f: Partial<MonitoreoAulasPlanRow>) => f as MonitoreoAulasPlanRow;

describe("consumoDelBanco", () => {
  it("mide el ritmo de caídas y cuánto aguanta el colchón", () => {
    const salida = consumoDelBanco([
      // Titular caído el día 10 y otro el 11: una caída por día.
      fila({ operational_code: "CH 1", faculty: "Derecho", titular_operational_code: "CH 1",
        sample_status: "reemplazada", replaced_at: "2026-08-10" } as Partial<MonitoreoAulasPlanRow>),
      fila({ operational_code: "CH 2", faculty: "Derecho", titular_operational_code: "CH 2",
        sample_status: "reemplazada", replaced_at: "2026-08-11" } as Partial<MonitoreoAulasPlanRow>),
      // Dos reservas libres detrás.
      fila({ operational_code: "R 1.1", faculty: "Derecho", sample_role: "chain_reserve",
        titular_operational_code: "CH 1", sample_status: "en_reserva" }),
      fila({ operational_code: "R 2.1", faculty: "Derecho", sample_role: "chain_reserve",
        titular_operational_code: "CH 2", sample_status: "en_reserva" }),
    // Dos días de campo transcurridos. **Antes este argumento no existía** y el
    // ritmo se dividía entre los días CON caídas, que aquí también son dos: el
    // test pasaba dando el mismo número por un denominador que no puede bajar de
    // 1. Ahora el «una caída por día» de su comentario es una medición y no una
    // coincidencia — y si el estudio llevara diez días, el ritmo sería 0,2.
    ], 2);
    const d = salida.facultades[0];
    expect(d.caidas).toBe(2);
    expect(d.diasConCaidas).toBe(2);
    expect(d.ritmo).toBe(1);
    expect(d.quedan).toBe(2);
    expect(d.diasHastaAgotarse).toBe(2);
  });

  it("sin reservas quedan CERO días, que no es lo mismo que no saberlo", () => {
    const salida = consumoDelBanco([
      fila({ operational_code: "CH 1", faculty: "X", titular_operational_code: "CH 1",
        sample_status: "reemplazada", replaced_at: "2026-08-10" } as Partial<MonitoreoAulasPlanRow>),
    ]);
    expect(salida.facultades[0].quedan).toBe(0);
    expect(salida.facultades[0].diasHastaAgotarse).toBe(0);
  });

  it("un solo día de caídas NO es un ritmo", () => {
    // «1 caída en 1 día» daría «1/día» y proyectaría el agotamiento del colchón
    // desde una sola observación.
    const salida = consumoDelBanco([
      fila({ operational_code: "CH 1", faculty: "X", titular_operational_code: "CH 1",
        sample_status: "reemplazada", replaced_at: "2026-08-10" } as Partial<MonitoreoAulasPlanRow>),
      fila({ operational_code: "R 1.1", faculty: "X", sample_role: "chain_reserve",
        titular_operational_code: "CH 1", sample_status: "en_reserva" }),
    ]);
    expect(salida.facultades[0].ritmo).toBeNull();
    expect(salida.facultades[0].diasHastaAgotarse).toBeNull();
  });

  it("una caída sin fecha se cuenta aparte y no inventa ritmo", () => {
    const salida = consumoDelBanco([
      fila({ operational_code: "CH 1", faculty: "X", titular_operational_code: "CH 1",
        sample_status: "reemplazada" }),
      fila({ operational_code: "R 1.1", faculty: "X", sample_role: "chain_reserve",
        titular_operational_code: "CH 1", sample_status: "en_reserva" }),
    ]);
    expect(salida.sinFecha).toBe(1);
    expect(salida.facultades[0].ritmo).toBeNull();
    // Sin ritmo no se proyecta: es distinto de «nunca se agota».
    expect(salida.facultades[0].diasHastaAgotarse).toBeNull();
  });

  it("una reserva en el banco no es consumo", () => {
    const salida = consumoDelBanco([
      fila({ operational_code: "CH 1", faculty: "X", titular_operational_code: "CH 1" }),
      fila({ operational_code: "R 1.1", faculty: "X", sample_role: "chain_reserve",
        titular_operational_code: "CH 1", sample_status: "en_reserva" }),
    ]);
    expect(salida.facultades).toHaveLength(0);
    expect(salida.caidasPorDia).toHaveLength(0);
  });
});

describe("el ritmo de caídas se mide por día de CAMPO, no por día con caídas", () => {
  // El denominador viejo eran los días en que cayó alguna, que por construcción
  // no puede dar menos de 1: tres caídas en tres días distintos salían «1/día»
  // aunque el estudio llevara diez días de campo. Y como los días de reserva son
  // `quedan / ritmo`, una facultad con una reserva libre acababa SIEMPRE en «1
  // día» —una tautología presentada como medición, y siempre del lado
  // alarmista—.
  const caida = (facultad: string, codigo: string, fecha: string) => fila({
    faculty: facultad, operational_code: codigo, sample_role: "titular",
    sample_status: "reemplazada", replaced_at: fecha, applied_date: fecha,
  });
  const reserva = (facultad: string, codigo: string, titular: string) => fila({
    faculty: facultad, operational_code: codigo, sample_role: "chain_reserve",
    titular_operational_code: titular, sample_status: "en_reserva",
  });

  const plan = [
    caida("Gestion", "CH 1", "2026-08-10"),
    caida("Gestion", "CH 2", "2026-08-12"),
    caida("Gestion", "CH 3", "2026-08-14"),
    reserva("Gestion", "R 9.1", "CH 9"),
  ];

  it("el caso real de Gestión: 3 caídas en 10 días de campo son 0,3/día", () => {
    const { facultades } = consumoDelBanco(plan, 10);
    const g = facultades.find((f) => f.facultad === "Gestion")!;
    expect(g.caidas).toBe(3);
    expect(g.ritmo).toBeCloseTo(0.3, 5);
    // Una reserva a 0,3 caídas por día aguanta cuatro días, no uno.
    expect(g.diasHastaAgotarse).toBe(4);
  });

  it("el denominador viejo daba «1/día» y «1 día» por aritmética", () => {
    // Las tres caídas ocurrieron en tres días distintos: dividir entre ellos da
    // exactamente 1, cualquiera que sea la duración del estudio.
    const { facultades } = consumoDelBanco(plan, 3);
    const g = facultades.find((f) => f.facultad === "Gestion")!;
    expect(g.diasConCaidas).toBe(3);
    expect(g.ritmo).toBe(1);
    expect(g.diasHastaAgotarse).toBe(1);
    // Y ese mismo plan con el estudio ya en su décimo día dice otra cosa muy
    // distinta, que es justo el punto.
    expect(consumoDelBanco(plan, 10).facultades.find((f) => f.facultad === "Gestion")!.diasHastaAgotarse).toBe(4);
  });

  it("sin saber los días de campo no se proyecta nada", () => {
    // Quedarse con el denominador viejo sería preferir una cifra cómoda a
    // ninguna.
    const { facultades } = consumoDelBanco(plan);
    const g = facultades.find((f) => f.facultad === "Gestion")!;
    expect(g.ritmo).toBeNull();
    expect(g.diasHastaAgotarse).toBeNull();
  });

  it("con una sola caída no hay ritmo: es una fecha, no una frecuencia", () => {
    const { facultades } = consumoDelBanco([
      caida("Arte", "CH 5", "2026-08-11"),
      reserva("Arte", "R 5.1", "CH 5"),
    ], 10);
    const a = facultades.find((f) => f.facultad === "Arte")!;
    expect(a.caidas).toBe(1);
    expect(a.ritmo).toBeNull();
  });

  it("sin reservas quedan cero días, que no es lo mismo que «no se sabe»", () => {
    const { facultades } = consumoDelBanco([
      caida("Sola", "CH 7", "2026-08-11"),
      caida("Sola", "CH 8", "2026-08-13"),
    ], 10);
    const s = facultades.find((f) => f.facultad === "Sola")!;
    expect(s.quedan).toBe(0);
    expect(s.diasHastaAgotarse).toBe(0);
  });
});
