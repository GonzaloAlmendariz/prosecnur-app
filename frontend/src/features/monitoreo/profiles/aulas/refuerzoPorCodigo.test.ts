import { describe, expect, it } from "vitest";

import { claveDeCodigo, diagnostica, estadoNormalizado, tipoSegunDestino } from "./refuerzoPorCodigo";

const fila = (over: Record<string, unknown> = {}) => ({
  operational_code: "R 23.4", classroom_id: "der104_0231", faculty: "DERECHO",
  course_name: "DERECHO PROCESAL", teacher: "PEREZ, ANA", eligible_n: 42,
  sample_status: "SIN CONTACTAR", sample_role: "chain_reserve", ...over,
});

describe("pedir un refuerzo por código", () => {
  it("acepta un aula dormida y dice cuántos elegibles trae", () => {
    const v = diagnostica("R 23.4", [fila()]);
    expect(v.puede).toBe(true);
    expect(v.codigo).toBe("R 23.4");
    expect(v.facultad).toBe("DERECHO");
    expect(v.motivo).toContain("42 elegibles");
  });

  it("encuentra el aula aunque se escriba sin espacio o en minúscula", () => {
    // Nadie teclea «R 23.4» con el espacio exacto la primera vez.
    expect(diagnostica("r23.4", [fila()]).puede).toBe(true);
    expect(diagnostica("  R23.4 ", [fila()]).puede).toBe(true);
  });

  it("normaliza el estado como el motor, no compara el crudo", () => {
    // El plan guarda «SIN CONTACTAR» y el motor habla de `sin_contactar`.
    // Comparar el crudo dejó 1.213 de 1.218 reservas como «ya comprometida»
    // el 2026-09-11: el circuito entero de refuerzos inalcanzable.
    expect(estadoNormalizado("SIN CONTACTAR")).toBe("sin_contactar");
    expect(estadoNormalizado("En-Reserva")).toBe("en_reserva");
    expect(diagnostica("R 23.4", [fila({ sample_status: "EN RESERVA" })]).puede).toBe(true);
  });

  it("rechaza la que ya está comprometida, diciendo con qué", () => {
    const v = diagnostica("R 23.4", [fila({ sample_status: "AGENDADA" })]);
    expect(v.puede).toBe(false);
    // El estado CRUDO en el mensaje: es el que la persona ve en el Sheets.
    expect(v.motivo).toContain("AGENDADA");
  });

  it("distingue «ya pedida» de «no se puede pedir»", () => {
    // Son dos noticias distintas: una es que ya está hecho, la otra que no
    // se puede. Fundirlas manda a revisar algo que está bien.
    const v = diagnostica("R 23.4", [fila({ sample_status: "REFUERZO POR CONTACTAR" })]);
    expect(v.puede).toBe(false);
    expect(v.yaMarcada).toBe(true);
    expect(v.motivo).toContain("Ya está pedida");
  });

  it("dice que no existe cuando el código no está en el plan", () => {
    const v = diagnostica("R 99.9", [fila()]);
    expect(v.puede).toBe(false);
    expect(v.motivo).toContain("No hay ningún");
  });

  it("con el campo vacío pide el código en vez de dar un error", () => {
    // Un formulario recién abierto no está en falta: está esperando.
    const v = diagnostica("", [fila()]);
    expect(v.puede).toBe(false);
    expect(v.motivo).toContain("Escribe el código");
  });

  it("el tipo sale del destino: un aula es complemento, una facultad refuerzo", () => {
    // Vocabulario de Gonzalo: B completa a un CH, C refuerza a la facultad.
    expect(tipoSegunDestino("CH 88")).toBe("complemento");
    expect(tipoSegunDestino("R 23.1")).toBe("complemento");
    expect(tipoSegunDestino("DERECHO")).toBe("refuerzo");
    expect(tipoSegunDestino("")).toBe("refuerzo");
  });

  it("también encuentra por classroom_id", () => {
    expect(diagnostica("der104_0231", [fila()]).puede).toBe(true);
  });

  it("claveDeCodigo iguala lo que se escribe con lo que hay guardado", () => {
    expect(claveDeCodigo("R 23.4")).toBe(claveDeCodigo("r23.4"));
  });
});
