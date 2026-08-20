import { describe, expect, it } from "vitest";

import type { MonitoreoRow } from "../../../../api/monitoreo";
import { TASA_DE_CAIDA } from "./alertaDeAnticipacion";
import { DESENLACES_MINIMOS, caidaObservada } from "./tasaDeCaida";

/**
 * Si este estudio se cae como el de 2025, que es lo que la alerta supone.
 *
 * La lista pide más aulas de las que cubren la brecha usando una constante
 * fechada (23,5 % en 2025). La constante no se toca —cambiarla cada día haría la
 * alerta inservible— pero si el estudio fuera al 35 % estaría pidiendo un cuarto
 * menos de lo necesario y nada lo diría.
 */

const titular = (sample_status: string, operational_status: string): MonitoreoRow =>
  ({ sample_role: "titular", sample_status, operational_status }) as unknown as MonitoreoRow;

const muchos = (n: number, s: string, o: string) => Array.from({ length: n }, () => titular(s, o));

describe("el denominador son los desenlaces, no los titulares", () => {
  it("un titular todavía agendado no cuenta como «no cayó»", () => {
    // Contarlo abajo hunde la tasa a mitad de campo, justo cuando la
    // comparación tendría que servir para algo.
    const c = caidaObservada([
      ...muchos(30, "agendada", "aplicada"),
      ...muchos(10, "reemplazada", "planificada"),
      ...muchos(60, "agendada", "agendada"),   // sin resolver: fuera
    ]);
    expect(c.decididos).toBe(40);
    expect(c.caidas).toBe(10);
    expect(c.tasa).toBeCloseTo(0.25, 5);
  });

  it("un titular reemplazado cuenta aunque su circuito diga «planificada»", () => {
    // Nunca llegó a salir, así que conserva ese estado. Comprobar la caída
    // DESPUÉS del circuito dejaría los 24 caídos del fixture como pendientes.
    const c = caidaObservada(muchos(25, "reemplazada", "planificada"));
    expect(c.decididos).toBe(25);
    expect(c.caidas).toBe(25);
  });

  it("las reservas y los extras no son titulares", () => {
    const c = caidaObservada([
      ...muchos(25, "agendada", "aplicada"),
      { sample_role: "chain_reserve", sample_status: "reemplazada", operational_status: "planificada" },
      { sample_role: "extra_reserve_pool", sample_status: "en_reserva", operational_status: "planificada" },
    ] as unknown as MonitoreoRow[]);
    expect(c.decididos).toBe(25);
    expect(c.caidas).toBe(0);
  });

  it("sin ningún desenlace no hay tasa que dar", () => {
    const c = caidaObservada(muchos(40, "agendada", "agendada"));
    expect(c.tasa).toBeNull();
    expect(c.direccion).toBeNull();
  });
});

describe("no se declara diferencia hasta que la haya", () => {
  it("con pocos desenlaces se enseña la cifra y no se le pone nombre", () => {
    // Con 10 resueltos, cualquier tasa se parece a cualquier otra.
    const n = DESENLACES_MINIMOS - 10;
    const c = caidaObservada([...muchos(n, "reemplazada", "planificada")]);
    expect(c.tasa).toBe(1);
    expect(c.margen).toBeNull();
    expect(c.direccion).toBeNull();
  });

  it("dentro del margen tampoco se dice «va igual»", () => {
    // 24 de 100 es 24 %, casi exactamente el supuesto. Afirmar que va igual
    // seria afirmar algo que la evidencia no distingue de la casualidad.
    const c = caidaObservada([
      ...muchos(24, "reemplazada", "planificada"),
      ...muchos(76, "agendada", "aplicada"),
    ]);
    // La afirmación no es «la tasa vale 0.235» sino «la diferencia cabe en el
    // margen», que es lo que decide el veredicto. Comparar el número exacto
    // hacía fallar el test por 5e-18 de coma flotante justo en la tolerancia.
    expect(Math.abs(c.tasa! - TASA_DE_CAIDA)).toBeLessThanOrEqual(c.margen!);
    expect(c.direccion).toBeNull();
  });

  it("fuera del margen sí, y dice de qué lado", () => {
    const seCaenMas = caidaObservada([
      ...muchos(60, "reemplazada", "planificada"),
      ...muchos(40, "agendada", "aplicada"),
    ]);
    expect(seCaenMas.direccion).toBe("se caen más");

    const seCaenMenos = caidaObservada([
      ...muchos(3, "reemplazada", "planificada"),
      ...muchos(97, "agendada", "aplicada"),
    ]);
    expect(seCaenMenos.direccion).toBe("se caen menos");
  });

  it("el margen encoge cuando hay más evidencia", () => {
    const pocos = caidaObservada(muchos(25, "agendada", "aplicada"));
    const muchosD = caidaObservada(muchos(400, "agendada", "aplicada"));
    expect(pocos.margen!).toBeGreaterThan(muchosD.margen!);
  });
});

describe("la lista cerrada va del lado de los pendientes", () => {
  it("un estado de circuito que nadie previó cuenta como salida, no como pendiente", () => {
    // Si no se reconociera, el aula caeria en pendiente, el denominador
    // encogeria y la tasa saldria MAS ALTA de la real: la lista diria «estas
    // pidiendo de menos» y mandaria a pedir aulas de mas por un estado mal
    // escrito. Fallar al reves es el error barato.
    const c = caidaObservada([
      ...muchos(20, "agendada", "cerrada"),
      ...muchos(5, "agendada", "en_campo"),
    ]);
    expect(c.decididos).toBe(25);
    expect(c.caidas).toBe(0);
  });

  it("«en reserva 3» sí es pendiente, en las dos escrituras del Excel", () => {
    const c = caidaObservada([
      ...muchos(20, "agendada", "aplicada"),
      ...muchos(9, "agendada", "en reserva 3"),
      ...muchos(9, "agendada", "en_reserva"),
    ]);
    expect(c.decididos).toBe(20);
  });
});
