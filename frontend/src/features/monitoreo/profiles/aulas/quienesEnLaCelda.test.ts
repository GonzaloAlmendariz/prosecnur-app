// quienesEnLaCelda.test.ts — la celda de la carga sabe QUIÉNES la ocupan.
//
// Dictado en vivo (2026-09-02, mirando la malla): «cada 30 mins con hover» —
// el número de la celda dice cuántos, y el operativo necesita saber cuáles:
// código, docente, dónde, y si la cita es un hecho o un techo. El dato lo
// produce `calcularCarga` en la MISMA pasada que las matrices: una segunda
// implementación del marcado (ventana firme vs banda plausible, bloque de la
// fecha real) divergiría en la primera regla nueva.
import { describe, expect, it } from "vitest";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { calcularCarga, citasDeLaFila, pabellonesDeLasCitas, ventanasDelMotor } from "./cargaDeCampo";

const aula = (over: Partial<MonitoreoAulasPlanRow>): MonitoreoAulasPlanRow =>
  ({
    selection_run_id: "r", wave: "M1", orden: 1, classroom_id: "x", label: "x", course_id: "c",
    course_name: "Curso", section: "", schedule: "", teacher: "", teacher_email: "", faculty: "F",
    program: "", level: "", stratum: "", eligible_n: 20, expected_valid: 10, link: "", qr: "",
    collector_id: "", responsible: "", sample_role: "titular",
    ...over,
  }) as MonitoreoAulasPlanRow;

const franjaDe = (malla: { franjas: number[] }, hhmm: number) => malla.franjas.indexOf(hhmm);

describe("calcularCarga anota quiénes ocupan cada celda", () => {
  const malla = calcularCarga(
    [
      aula({
        classroom_id: "a", operational_code: "CH 1", teacher: "CHINCHAYÁN, RUTH",
        venue: "A501", sesiones_dia_hora: "LUN 10:00-12:00", scheduled_time: "10:00",
      }),
      aula({
        classroom_id: "b", operational_code: "CH 2", teacher: "VILELA, MARTA",
        venue: "A502", sesiones_dia_hora: "LUN 10:00-12:00",
      }),
    ],
    { duracionMin: 30, eje: "semana" },
  );
  const lunes = 0;

  it("la franja de la cita lista al confirmado y al plausible, cada uno con su estado", () => {
    const j = franjaDe(malla, 10 * 60);
    const ocupantes = malla.quienes[lunes][j];
    // La facultad viaja con el ocupante (dictado 2026-09-02: «algo que le
    // falta a los boxes con información es decir la facultad también»).
    expect(ocupantes).toEqual([
      {
        codigo: "CH 1", docente: "CHINCHAYÁN, RUTH", lugar: "A501", facultad: "F", confirmada: true,
        fecha: "", hora: "10:00", momento: "",
      },
      {
        codigo: "CH 2", docente: "VILELA, MARTA", lugar: "A502", facultad: "F", confirmada: false,
        fecha: "", hora: "", momento: "",
      },
    ]);
  });

  it("la cita confirmada viaja con sus tres señas: fecha exacta, hora pactada y momento", () => {
    // Dictado (2026-09-02, mirando el detalle): «no me muestras ni la fecha
    // exacta ni la hora en la que se acordó ir ni qué etapa de la clase es».
    // En el patrón semanal la fila «sábado» agrega varios sábados: sin la
    // fecha en el ocupante, el detalle no puede decir CUÁL.
    // La hora pactada está en AM/PM: la POSICIÓN viene de la ventana del
    // motor (contrato en horaDelMotor.contract.test.ts) y el texto queda de
    // rótulo, tal como se pactó.
    const conSenas = calcularCarga(
      [aula({
        classroom_id: "c", operational_code: "CH 106", teacher: "CHAN SANCHEZ, JULIO JOSE",
        venue: "J309", sesiones_dia_hora: "SAB 13:00-15:00",
        scheduled_time: "1:00 pm", scheduled_date: "2026-09-12", scheduled_moment: "inicio",
      })],
      {
        duracionMin: 30,
        eje: "semana",
        ventanas: ventanasDelMotor({
          dias: [{
            fecha: "2026-09-12",
            ventanas: [{ codigo: "CH 106", inicio: "13:00", fin: "13:20", confirmada: true }],
            pico: { aulas: 1, inicio: "13:00", fin: "13:20" },
            por_confirmar: [],
          }],
          personas_fuente: "confirmadas",
        }),
      },
    );
    const sabado = 5;
    const o = conSenas.quienes[sabado][franjaDe(conSenas, 13 * 60)][0];
    expect(o).toMatchObject({
      codigo: "CH 106",
      fecha: "2026-09-12",
      hora: "1:00 pm",
      momento: "inicio",
    });
  });

  it("«cierre» del libro se lee como el momento final; lo no acordado queda vacío", () => {
    const conCierre = calcularCarga(
      [aula({
        classroom_id: "c", operational_code: "CH 9", sesiones_dia_hora: "LUN 10:00-12:00",
        scheduled_time: "10:00", scheduled_moment: "cierre",
      })],
      { duracionMin: 30, eje: "semana" },
    );
    // El momento corre la ventana al final de la clase: 11:30-12:00.
    const o = conCierre.quienes[0][franjaDe(conCierre, 11 * 60 + 30)][0];
    expect(o?.momento).toBe("final");
  });

  it("pasada la ventana firme queda solo la banda: la lista dice lo mismo que el número", () => {
    // 10:30: la aplicación de 30 min de CH 1 ya terminó; la banda de CH 2
    // cubre su clase entera. La lista y `firmes+plausibles` no pueden divergir.
    const j = franjaDe(malla, 10 * 60 + 30);
    expect(malla.quienes[lunes][j].map((o) => o.codigo)).toEqual(["CH 2"]);
    expect(malla.quienes[lunes][j]).toHaveLength(malla.firmes[lunes][j] + malla.plausibles[lunes][j]);
  });

  it("fuera de toda clase la celda no tiene ocupantes", () => {
    expect(malla.quienes[lunes][franjaDe(malla, 8 * 60)]).toEqual([]);
  });
});

describe("en el calendario cada fila lista lo suyo", () => {
  const malla = calcularCarga(
    [
      aula({
        classroom_id: "a", operational_code: "CH 1", sesiones_dia_hora: "LUN 10:00-12:00",
        scheduled_time: "10:00", scheduled_date: "2026-09-14",
      }),
      aula({ classroom_id: "b", operational_code: "CH 2", sesiones_dia_hora: "MAR 14:00-16:00" }),
    ],
    { duracionMin: 30, eje: "calendario" },
  );

  it("la fecha agendada lista su cita y el carril lo pendiente, sin cruzarse", () => {
    const iFecha = malla.filas.findIndex((f) => f.fecha === "2026-09-14");
    const iCarril = malla.filas.findIndex((f) => f.porAgendar);
    expect(malla.quienes[iFecha][franjaDe(malla, 10 * 60)].map((o) => o.codigo)).toEqual(["CH 1"]);
    expect(malla.quienes[iCarril][franjaDe(malla, 14 * 60)].map((o) => o.codigo)).toEqual(["CH 2"]);
    expect(malla.quienes[iCarril][franjaDe(malla, 10 * 60)]).toEqual([]);
  });

  it("sin código operativo, el aula se nombra por su identificador y no queda anónima", () => {
    const sinCodigo = calcularCarga(
      [aula({ classroom_id: "1urb01_0501", operational_code: undefined, sesiones_dia_hora: "LUN 10:00-12:00" })],
      { duracionMin: 30, eje: "semana" },
    );
    expect(sinCodigo.quienes[0][franjaDe(sinCodigo, 10 * 60)][0]?.codigo).toBe("1urb01_0501");
  });
});

describe("citasDeLaFila — el parte del día entero (B37)", () => {
  it("dedup por código en orden de arranque: un curso de dos horas aparece UNA vez", () => {
    // CH 1 confirmada a las 10:00 (ocupa 10:00 y — con 30 min — nada más);
    // CH 2 sin agendar cubre su clase entera 10:00-12:00 (cuatro franjas).
    // El parte del día los quiere una vez cada uno, CH 1 primero.
    const malla = calcularCarga(
      [
        aula({ classroom_id: "a", operational_code: "CH 1", sesiones_dia_hora: "LUN 10:00-12:00", scheduled_time: "10:00" }),
        aula({ classroom_id: "b", operational_code: "CH 2", sesiones_dia_hora: "LUN 10:00-12:00" }),
      ],
      { duracionMin: 30, eje: "semana" },
    );
    const dia = citasDeLaFila(malla, 0);
    expect(dia.map((o) => o.codigo)).toEqual(["CH 1", "CH 2"]);
    expect(dia[0].confirmada).toBe(true);
    expect(dia[1].confirmada).toBe(false);
  });

  it("fila sin citas o fuera de rango = lista vacía, no error", () => {
    const malla = calcularCarga([], { duracionMin: 30, eje: "semana" });
    expect(citasDeLaFila(malla, 0)).toEqual([]);
    expect(citasDeLaFila(malla, 99)).toEqual([]);
  });
});

describe("pabellonesDeLasCitas — a qué edificios se va ese día", () => {
  it("cuenta por letra, ordena por volumen y declara «otros» sin tragar", () => {
    const cita = (lugar: string) => ({
      codigo: "x", docente: "", lugar, facultad: "", confirmada: true,
      fecha: "", hora: "", momento: "" as const,
    });
    expect(pabellonesDeLasCitas([
      cita("A703"), cita("A101"), cita("J308"), cita("J203 · J210"),
      cita("A202"), cita("Polideportivo"), cita(""),
    ])).toEqual([
      { pabellon: "A", aulas: 3 },
      { pabellon: "J", aulas: 2 },
      { pabellon: "otros", aulas: 1 },
    ]);
  });
});
