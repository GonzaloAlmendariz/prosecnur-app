import { describe, expect, test } from "vitest";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { COLOR_AULA_LISTA, estadoDeAplicacion } from "./estadoDeAplicacion";
import { COLORES_DE_RESULTADO_EXCLUSIVOS } from "../../coloresDeResultado";

function aula(estado: string): MonitoreoAulasPlanRow {
  return { application_state: estado } as unknown as MonitoreoAulasPlanRow;
}

describe("estadoDeAplicacion", () => {
  test("reparte los cuatro estados en orden de circuito", () => {
    const res = estadoDeAplicacion([
      aula("cerrando"), aula("pendiente"), aula("pendiente"),
      aula("en_aplicacion"), aula("lista"),
    ]);
    expect(res.estados.map((e) => [e.clave, e.aulas])).toEqual([
      ["pendiente", 2], ["lista", 1], ["en_aplicacion", 1], ["cerrando", 1],
    ]);
    expect(res.total).toBe(5);
  });

  test("separa «sin agendar» de «agendada sin respuestas»", () => {
    // Es la distincion que el histograma de cobertura NO puede hacer: alli las
    // dos caen en «sin respuestas». Aqui dice si lo que falta es telefono o
    // campo.
    const res = estadoDeAplicacion([aula("pendiente"), aula("lista"), aula("lista")]);
    expect(res.sinEmpezar).toBe(3);
    expect(res.estados[0].aulas).toBe(1);
    expect(res.estados[1].aulas).toBe(2);
  });

  test("un estado que el motor no declara se cuenta, no se pierde", () => {
    // El control invertido del patron que ya costo doce items de esta cola: una
    // lista cerrada que se traga lo que no reconoce. Si el engine añade un
    // quinto estado, el grafico lo dice en vez de perder aulas.
    const res = estadoDeAplicacion([aula("cerrando"), aula("suspendida"), aula("")]);
    expect(res.desconocidas).toBe(2);
    expect(res.total).toBe(3);
    expect(res.estados.reduce((s, e) => s + e.aulas, 0) + res.desconocidas).toBe(3);
  });

  test("el azul de «lista» no invade la paleta de desenlaces", () => {
    // Pintar «agendada» de granate diria que alguien declino, que es falso.
    expect(COLORES_DE_RESULTADO_EXCLUSIVOS).not.toContain(COLOR_AULA_LISTA);
    const colores = estadoDeAplicacion([aula("lista")]).estados.map((e) => e.color);
    expect(new Set(colores).size).toBe(4);
  });
});
