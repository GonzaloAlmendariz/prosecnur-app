// horaDelMotor.contract.test.ts — la malla de carga NO re-parsea horas.
//
// Bug reportado con captura (2026-09-02): la celda del martes 08:00 decía «1
// confirmado» y el detalle «CH 16 · … · 8:00pm» — una cita acordada a las 8 PM
// pintada a las 8 AM, con la demanda del pico MAL contada. El parser del motor
// es correcto (`monitoreo_aulas_hora_parse("8:00pm") = 20:00`); el fallo era
// del cliente, que re-leía `scheduled_time` con un regex sin ancla y se
// quedaba con el «8:00».
//
// Regla congelada aquí: la POSICIÓN horaria de un confirmado sale de las
// ventanas del bloque `franjas` (ya en 24h), vía `ventanasDelMotor`; el texto
// crudo del libro sólo puede ser rótulo. Y una hora con sufijo que no llegó
// con ventana del motor no se posiciona: banda plausible, no adivinanza.
import { describe, expect, it } from "vitest";

import type { MonitoreoAulasFranjas, MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { calcularCarga, leerHora, ventanasDelMotor } from "./cargaDeCampo";

const aula = (over: Partial<MonitoreoAulasPlanRow>): MonitoreoAulasPlanRow =>
  ({
    selection_run_id: "r", wave: "M1", orden: 1, classroom_id: "x", label: "x", course_id: "c",
    course_name: "Curso", section: "", schedule: "", teacher: "", teacher_email: "", faculty: "F",
    program: "", level: "", stratum: "", eligible_n: 20, expected_valid: 10, link: "", qr: "",
    collector_id: "", responsible: "", sample_role: "titular",
    ...over,
  }) as MonitoreoAulasPlanRow;

// El caso del bug: cita del martes 15/09 acordada a las «8:00pm», clase de
// 19:00 a 21:00. El motor publica su ventana 20:00–20:20.
const ch16 = aula({
  classroom_id: "b16", operational_code: "CH 16",
  sesiones_dia_hora: "MAR 19:00-21:00",
  scheduled_time: "8:00pm", scheduled_date: "2026-09-15",
});

const franjas: MonitoreoAulasFranjas = {
  dias: [{
    fecha: "2026-09-15",
    ventanas: [{ codigo: "CH 16", inicio: "20:00", fin: "20:20", confirmada: true }],
    pico: { aulas: 1, inicio: "20:00", fin: "20:20" },
    por_confirmar: [],
  }],
  personas_fuente: "confirmadas",
};

const franjaDe = (malla: { franjas: number[] }, hhmm: number) => malla.franjas.indexOf(hhmm);

describe("la posición horaria sale del motor, no del texto del libro", () => {
  it("«8:00pm» con ventana del motor pinta a las 20:00, no a las 08:00", () => {
    const malla = calcularCarga([ch16], {
      duracionMin: 30, eje: "semana", ventanas: ventanasDelMotor(franjas),
    });
    const martes = 1;
    expect(malla.firmes[martes][franjaDe(malla, 20 * 60)]).toBe(1);
    expect(malla.firmes[martes][franjaDe(malla, 8 * 60)]).toBe(0);
    // Y el detalle de la celda de las 20:00 lo nombra, con la hora tal como
    // se pactó — el texto crudo es rótulo, nunca posición.
    expect(malla.quienes[martes][franjaDe(malla, 20 * 60)][0]).toMatchObject({
      codigo: "CH 16", hora: "8:00pm", confirmada: true,
    });
  });

  it("en el calendario la fecha del motor también manda", () => {
    const malla = calcularCarga([ch16], {
      duracionMin: 30, eje: "calendario", ventanas: ventanasDelMotor(franjas),
    });
    const i = malla.filas.findIndex((f) => f.fecha === "2026-09-15");
    expect(i).toBeGreaterThanOrEqual(0);
    expect(malla.firmes[i][franjaDe(malla, 20 * 60)]).toBe(1);
  });

  it("sin ventana del motor, una hora con sufijo NO se posiciona: banda, no adivinanza", () => {
    const malla = calcularCarga([ch16], { duracionMin: 30, eje: "semana" });
    const martes = 1;
    // Ni a las 8 ni a las 20: sin fuente confiable no hay ventana firme.
    expect(malla.firmes[martes].every((n) => n === 0)).toBe(true);
    // La clase sigue contando como banda plausible — el aula no desaparece.
    expect(malla.plausibles[martes][franjaDe(malla, 19 * 60)]).toBe(1);
    expect(malla.plausibles[martes][franjaDe(malla, 8 * 60)]).toBe(0);
  });

  it("leerHora es de 24 horas exactas: el sufijo la anula en vez de truncarse", () => {
    expect(leerHora("20:00")).toBe(1200);
    expect(leerHora("8:00pm")).toBeNull();
    expect(leerHora("8:05 am")).toBeNull();
  });

  it("ventanasDelMotor ignora tentativas y horas rotas: sólo citas pactadas posicionan", () => {
    const conRuido = ventanasDelMotor({
      dias: [{
        fecha: "2026-09-15",
        ventanas: [
          { codigo: "CH 16", inicio: "20:00", fin: "20:20", confirmada: true },
          { codigo: "CH 2", inicio: "17:00", fin: "20:00", confirmada: false },
          { codigo: "CH 3", inicio: "", fin: "20:20", confirmada: true },
        ],
        pico: { aulas: 1, inicio: "20:00", fin: "20:20" },
        por_confirmar: ["CH 2"],
      }],
      personas_fuente: "confirmadas",
    });
    expect([...conRuido.keys()]).toEqual(["CH 16"]);
    expect(conRuido.get("CH 16")).toEqual({ fecha: "2026-09-15", inicioMin: 1200 });
  });
});
