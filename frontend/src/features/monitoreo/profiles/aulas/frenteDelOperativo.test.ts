import { describe, expect, it } from "vitest";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { frenteDelOperativo, soloElAula } from "./frenteDelOperativo";

const fila = (f: Partial<MonitoreoAulasPlanRow>) => f as MonitoreoAulasPlanRow;
const parte = (codigo: string) => ({ operational_code: codigo });

describe("frenteDelOperativo", () => {
  it("vencida sin parte es lo que hay que perseguir", () => {
    const f = frenteDelOperativo(
      [
        fila({ operational_code: "CH 1", faculty: "Derecho", scheduled_date: "2026-08-10" }),
        fila({ operational_code: "CH 2", faculty: "Derecho", scheduled_date: "2026-08-11" }),
      ],
      [parte("CH 2")],
      "2026-08-18",
    );
    expect(f.vencidas).toBe(2);
    expect(f.vencidasConParte).toBe(1);
    expect(f.pendientes.map((a) => a.codigo)).toEqual(["CH 1"]);
    expect(f.pendientes[0].dias).toBe(8);
  });

  it("el día del corte NO cuenta como vencido", () => {
    // El aula todavía puede aplicarse esa misma tarde: marcarla en rojo por la
    // mañana es una alarma falsa.
    const f = frenteDelOperativo(
      [fila({ operational_code: "HOY", scheduled_date: "2026-08-18" })],
      [],
      "2026-08-18",
    );
    expect(f.vencidas).toBe(0);
    expect(f.porVenir).toBe(1);
  });

  it("el banco no entra: un extra no tiene día que vencer", () => {
    const f = frenteDelOperativo(
      [
        fila({ operational_code: "CH 1", scheduled_date: "2026-08-10" }),
        fila({ operational_code: "EXTRA 1", sample_role: "extra_reserve_pool", scheduled_date: "2026-08-10" }),
      ],
      [],
      "2026-08-18",
    );
    expect(f.conFecha).toBe(1);
    expect(f.pendientes.map((a) => a.codigo)).toEqual(["CH 1"]);
  });

  it("sin fecha se declara aparte, ni al día ni atrasada", () => {
    const f = frenteDelOperativo(
      [fila({ operational_code: "SIN" }), fila({ operational_code: "CON", scheduled_date: "2026-08-10" })],
      [],
      "2026-08-18",
    );
    expect(f.sinFecha).toBe(1);
    expect(f.conFecha).toBe(1);
    expect(f.vencidas).toBe(1);
  });

  it("abre por la que lleva más días caída", () => {
    const f = frenteDelOperativo(
      [
        fila({ operational_code: "RECIENTE", scheduled_date: "2026-08-17" }),
        fila({ operational_code: "ANTIGUA", scheduled_date: "2026-08-10" }),
      ],
      [],
      "2026-08-18",
    );
    expect(f.pendientes.map((a) => a.codigo)).toEqual(["ANTIGUA", "RECIENTE"]);
  });
});

describe("la columna «dónde» entrega el aula, no otra vez la hora", () => {
  // `SESIONES Y AULA` del Excel es un texto descriptivo entero —«LUN 08:00
  // A101»— y se pintaba tal cual, pegado a la columna «cuándo» que ya dice
  // «lun 10/08 16:00». Dos columnas contiguas repitiendo día y hora, con el
  // dato que la segunda promete ocupando 4 de sus 14 caracteres.
  it("quita el prefijo de día y hora", () => {
    expect(soloElAula("LUN 16:00 V110")).toBe("V110");
    expect(soloElAula("MIE 14:00 N121")).toBe("N121");
    expect(soloElAula("mar 8:00 A101")).toBe("A101");
  });

  it("deja intacto lo que no lleva ese prefijo", () => {
    // Adivinar dónde acaba el prefijo cuando no está sería peor que no tocarlo:
    // se perdería el único dato de la columna.
    expect(soloElAula("Pabellón A, aula 12")).toBe("Pabellón A, aula 12");
    expect(soloElAula("V110")).toBe("V110");
    expect(soloElAula("LUN V110")).toBe("LUN V110");
    expect(soloElAula("16:00 V110")).toBe("16:00 V110");
  });

  it("nunca devuelve vacío si entró algo", () => {
    // Un texto que fuese SOLO día y hora se quedaría sin nada que enseñar, y una
    // celda vacía se lee como dato que falta.
    expect(soloElAula("LUN 16:00 ")).toBe("LUN 16:00");
    expect(soloElAula("   ")).toBe("");
  });
});
