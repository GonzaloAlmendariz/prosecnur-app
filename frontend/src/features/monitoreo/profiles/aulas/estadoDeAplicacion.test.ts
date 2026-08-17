import { describe, expect, test } from "vitest";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { COLOR_AULA_LISTA, estadoDeAplicacion } from "./estadoDeAplicacion";
import { coberturaPorAula } from "./coberturaPorAula";
import { COLORES_DE_RESULTADO_EXCLUSIVOS } from "../../coloresDeResultado";

function aula(estado: string): MonitoreoAulasPlanRow {
  return { application_state: estado } as unknown as MonitoreoAulasPlanRow;
}

describe("estadoDeAplicacion", () => {
  test("reparte los seis estados en orden de circuito", () => {
    const res = estadoDeAplicacion([
      aula("cerrando"), aula("pendiente"), aula("pendiente"),
      aula("en_aplicacion"), aula("lista"), aula("reemplazada"),
      // «En reserva» entró como sexto: una reserva del banco no está sin
      // agendar, es que no hay que agendarla salvo que caiga su titular.
      aula("en_reserva"),
    ]);
    expect(res.estados.map((e) => [e.clave, e.aulas])).toEqual([
      ["pendiente", 2], ["lista", 1], ["en_aplicacion", 1], ["cerrando", 1],
      ["reemplazada", 1], ["en_reserva", 1],
    ]);
    expect(res.total).toBe(7);
  });

  test("una reemplazada NO se cuenta como sin agendar", () => {
    // Lo que vio Gonzalo: un aula del lunes rotulada «Sin agendar». Medido sobre
    // el estudio de 196, de las 48 que lo decían, 26 eran reemplazadas y 22
    // estaban agendadas con fecha: ni una sola estaba sin agendar. Una
    // reemplazada no es que falte agendarla — cayó y su reserva tomó el relevo.
    const res = estadoDeAplicacion([aula("reemplazada"), aula("reemplazada"), aula("lista")]);
    expect(res.estados.find((e) => e.clave === "pendiente")?.aulas).toBe(0);
    expect(res.estados.find((e) => e.clave === "reemplazada")?.aulas).toBe(2);
    // Tampoco entra en «sin empezar»: no está esperando campo, está fuera.
    expect(res.sinSalirACampo).toBe(1);
  });

  test("separa «sin agendar» de «agendada sin respuestas»", () => {
    // Es la distincion que el histograma de cobertura NO puede hacer: alli las
    // dos caen en «sin respuestas». Aqui dice si lo que falta es telefono o
    // campo.
    const res = estadoDeAplicacion([aula("pendiente"), aula("lista"), aula("lista")]);
    expect(res.sinSalirACampo).toBe(3);
    // Por CLAVE y no por índice: al entrar «En reserva» como sexto tramo, un
    // aserto posicional habría seguido pasando señalando otra cosa.
    expect(res.estados.find((e) => e.clave === "pendiente")?.aulas).toBe(1);
    expect(res.estados.find((e) => e.clave === "lista")?.aulas).toBe(2);
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
    // Seis tramos, seis colores distintos: si «En reserva» compartiera el gris
    // de «Sin agendar», el gráfico volvería a mezclar los dos estados que este
    // tramo existe para separar.
    const colores = estadoDeAplicacion([aula("lista")]).estados.map((e) => e.color);
    expect(new Set(colores).size).toBe(6);
  });
});

describe("el eje del agendamiento no cuenta respuestas", () => {
  // Medido el 2026-08-17 en pantalla: el pie de «Status de aplicación» decía
  // «14 de 196 cursos-horario no han recibido ni una respuesta» y el panel de
  // «Cobertura de la meta», un dedo más abajo, decía «Sin respuestas 48». El
  // mismo hecho con dos números, porque el pie lo derivaba sumando los dos
  // primeros tramos DE OTRO eje.
  test("«sin salir a campo» excluye reservas y reemplazadas", () => {
    const res = estadoDeAplicacion([
      aula("pendiente"), aula("lista"),
      // Ninguna de estas dos está esperando campo: una es del banco y la otra
      // cayó. Sumarlas diría que hay cuatro aulas por trabajar.
      aula("en_reserva"), aula("reemplazada"),
    ]);
    expect(res.sinSalirACampo).toBe(2);
    expect(res.estados.find((e) => e.clave === "en_reserva")?.aulas).toBe(1);
  });

  test("las aulas sin una sola respuesta las cuenta el eje de cobertura", () => {
    // `coberturaPorAula` es el dueño: mira `respuestas_validas`, que es de lo
    // que trata la frase. Aquí las cuatro tienen cero.
    const filas = [
      { expected_valid: 20, respuestas_validas: 0 },
      { expected_valid: 20, respuestas_validas: 0 },
      { expected_valid: 20, respuestas_validas: 0 },
      { expected_valid: 20, respuestas_validas: 5 },
    ] as unknown as Parameters<typeof coberturaPorAula>[0];
    expect(coberturaPorAula(filas).sinRespuestas).toBe(3);
  });
});
