import { describe, expect, it } from "vitest";

import type { ProyeccionDeFacultad } from "./proyeccionPorAgenda";
import { DIAS_DE_ANTICIPACION, TASA_DE_CAIDA, alertaDeAnticipacion } from "./alertaDeAnticipacion";

const facultad = (p: Partial<ProyeccionDeFacultad> & { facultad: string }): ProyeccionDeFacultad => ({
  esperadoPorAula: 20,
  aulasAgendadas: 0,
  dias: [],
  cuotas: [],
  reparto: "observada",
  alcanzaTodo: false,
  ...p,
});

const cuota = (faltanAlCerrarAgenda: number) => ({
  sexo: "Mujer",
  meta: 100,
  observadas: 0,
  faltan: 100,
  esperadasDeLaAgenda: 0,
  alcanza: false,
  fechaDeCruce: null,
  faltanAlCerrarAgenda,
});

describe("cuántas aulas hay que pedir", () => {
  it("las que cubren la brecha, con margen por las que se caerán", () => {
    // 60 encuestas de brecha a 20 por aula son 3 aulas... si todas se aplicaran.
    // En 2025 una de cada cuatro no se aplicó, así que se piden 4.
    const [a] = alertaDeAnticipacion([
      facultad({ facultad: "Derecho", cuotas: [cuota(60)] }),
    ]);
    expect(a.aulasNecesarias).toBe(3);
    expect(a.aulasAPedir).toBe(Math.ceil(3 / (1 - TASA_DE_CAIDA)));
    expect(a.aulasAPedir).toBeGreaterThan(a.aulasNecesarias);
  });

  it("suma la brecha de los dos sexos", () => {
    const [a] = alertaDeAnticipacion([
      facultad({ facultad: "Derecho", cuotas: [cuota(40), { ...cuota(20), sexo: "Hombre" }] }),
    ]);
    expect(a.faltan).toBe(60);
  });

  it("sin brecha no pide nada", () => {
    const [a] = alertaDeAnticipacion([
      facultad({ facultad: "Derecho", cuotas: [cuota(0)], alcanzaTodo: true }),
    ]);
    expect(a.urgencia).toBe("sin brecha");
    expect(a.aulasAPedir).toBe(0);
  });

  it("sin rendimiento conocido no inventa un número de aulas", () => {
    // Dividir por cero daría Infinity y la pantalla pediría infinitas aulas.
    const [a] = alertaDeAnticipacion([
      facultad({ facultad: "Nueva", esperadoPorAula: 0, cuotas: [cuota(50)] }),
    ]);
    expect(a.aulasNecesarias).toBe(0);
    expect(a.aulasAPedir).toBe(0);
    expect(a.faltan).toBe(50);
  });
});

describe("cuándo hay que salir a pedirlas", () => {
  it("con menos días que la anticipación, es ahora", () => {
    const [a] = alertaDeAnticipacion(
      [facultad({ facultad: "Derecho", cuotas: [cuota(60)] })],
      DIAS_DE_ANTICIPACION - 1,
    );
    expect(a.urgencia).toBe("pedir ahora");
  });

  it("con más días que la anticipación, hay margen", () => {
    const [a] = alertaDeAnticipacion(
      [facultad({ facultad: "Derecho", cuotas: [cuota(60)] })],
      DIAS_DE_ANTICIPACION + 5,
    );
    expect(a.urgencia).toBe("hay margen");
  });

  it("sin fecha de cierre y con brecha, se trata como urgente", () => {
    // No saber cuánto queda no es lo mismo que saber que sobra tiempo.
    const [a] = alertaDeAnticipacion([facultad({ facultad: "Derecho", cuotas: [cuota(60)] })], null);
    expect(a.urgencia).toBe("pedir ahora");
  });

  it("justo en el límite ya es ahora", () => {
    const [a] = alertaDeAnticipacion(
      [facultad({ facultad: "Derecho", cuotas: [cuota(60)] })],
      DIAS_DE_ANTICIPACION,
    );
    expect(a.urgencia).toBe("pedir ahora");
  });
});

describe("el orden es el de salir a llamar", () => {
  it("primero las urgentes, y dentro de ellas las que más aulas piden", () => {
    const res = alertaDeAnticipacion([
      facultad({ facultad: "Tranquila", cuotas: [cuota(0)], alcanzaTodo: true }),
      facultad({ facultad: "Poca", cuotas: [cuota(20)] }),
      facultad({ facultad: "Mucha", cuotas: [cuota(200)] }),
    ], 2);
    expect(res.map((r) => r.facultad)).toEqual(["Mucha", "Poca", "Tranquila"]);
  });
});

describe("las constantes vienen del operativo de 2025 y están declaradas", () => {
  it("7 días de anticipación y 23.5 % de caída", () => {
    // Si alguien las cambia, que sea a sabiendas: son la mediana de llamada a
    // aplicación de los titulares y los 40 reemplazos de 170.
    expect(DIAS_DE_ANTICIPACION).toBe(7);
    expect(TASA_DE_CAIDA).toBeCloseTo(40 / 170, 2);
  });
});
