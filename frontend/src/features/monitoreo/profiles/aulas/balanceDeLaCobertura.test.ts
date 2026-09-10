import { describe, expect, it } from "vitest";
import { balanceDeLaCobertura } from "./balanceDeLaCobertura";
import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";

const aplicado = (elegibles: number, esperadas: number, efectivas: number) => ({
  application_state: "cerrando",
  eligible_n: elegibles, expected_valid: esperadas, respuestas_validas: efectivas,
} as unknown as MonitoreoAulasPlanRow);

const agendado = (elegibles: number, esperadas: number) => ({
  application_state: "lista",
  eligible_n: elegibles, expected_valid: esperadas, respuestas_validas: 0,
} as unknown as MonitoreoAulasPlanRow);

const sinAgendar = (elegibles: number, esperadas: number) => ({
  application_state: "pendiente",
  eligible_n: elegibles, expected_valid: esperadas, respuestas_validas: 0,
} as unknown as MonitoreoAulasPlanRow);

describe("balanceDeLaCobertura", () => {
  // 200 elegibles, se esperaban 100 y llegaron 120: +20 de superávit.
  // Agendados: 100 elegibles, 50 esperadas al diseño; al ritmo observado
  // (120/200 = 60 %) serían 60.
  const filas = [
    aplicado(120, 60, 75),
    aplicado(80, 40, 45),
    agendado(60, 30),
    agendado(40, 20),
    sinAgendar(90, 45),
  ];

  it("dice el balance de hoy en PERSONAS, no en puntos", () => {
    const b = balanceDeLaCobertura(filas, 300)!;
    expect(b.aplicados).toBe(2);
    expect(b.esperadasHoy).toBe(100);
    expect(b.efectivas).toBe(120);
    expect(b.balance).toBe(20);
  });

  it("los que aún no se agendan NO entran en ninguna de las dos cuentas", () => {
    // Un curso-horario sin fecha no es una promesa: contarlo diría que se llega
    // gracias a aulas que nadie ha pedido todavía.
    const b = balanceDeLaCobertura(filas, 300)!;
    expect(b.agendados).toBe(2);
    expect(b.esperadasAgendadas).toBe(50);
  });

  it("proyecta lo agendado con las DOS tasas, la del diseño y la del campo", () => {
    const b = balanceDeLaCobertura(filas, 300)!;
    // Al diseño: 120 + 50 = 170. Al ritmo observado (60 %): 120 + 60 = 180.
    expect(b.conAgendaPrevisto).toBe(170);
    expect(b.esperadasAlRitmo).toBe(60);
    expect(b.conAgendaObservado).toBe(180);
  });

  it("un déficit sale con signo negativo", () => {
    const b = balanceDeLaCobertura([aplicado(100, 60, 40)], 200)!;
    expect(b.balance).toBe(-20);
  });

  it("sin aplicados no hay tasa observada con la que proyectar", () => {
    const b = balanceDeLaCobertura([agendado(60, 30)], 200)!;
    expect(b.esperadasAlRitmo).toBeNull();
    expect(b.conAgendaObservado).toBeNull();
    // Pero lo agendado al diseño sí se puede decir.
    expect(b.conAgendaPrevisto).toBe(30);
  });

  it("sin cuota se calcula igual: el balance de hoy no depende de ella", () => {
    const b = balanceDeLaCobertura(filas, null)!;
    expect(b.cuota).toBeNull();
    expect(b.balance).toBe(20);
  });

  it("sin filas aplicadas ni agendadas devuelve null, no un balance de ceros", () => {
    expect(balanceDeLaCobertura([sinAgendar(90, 45)], 300)).toBeNull();
    expect(balanceDeLaCobertura([], 300)).toBeNull();
  });
});
