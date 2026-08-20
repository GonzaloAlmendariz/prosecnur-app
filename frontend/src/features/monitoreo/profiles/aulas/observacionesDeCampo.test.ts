import { describe, expect, it } from "vitest";

import { observacionesDeCampo } from "./observacionesDeCampo";

const parte = (o: Record<string, unknown>) => o;

describe("observacionesDeCampo", () => {
  it("agrupa por lo que dice: lo repetido es un patrón, no N incidencias", () => {
    // El caso real del corte: 16 partes con la MISMA observación entre dos
    // equipos. Listadas una a una son dieciséis casos sueltos; agrupadas son un
    // patrón que cambia cómo se agenda.
    const r = observacionesDeCampo([
      parte({ field_note: "El docente pidió empezar al final", operational_code: "CH 1", applied_by: "Equipo 1", applied_date: "2026-08-01" }),
      parte({ field_note: "el docente pidió empezar al final.", operational_code: "CH 2", applied_by: "Equipo 4", applied_date: "2026-08-03" }),
      parte({ field_note: "Aula cambiada a última hora", operational_code: "CH 3", applied_by: "Equipo 1", applied_date: "2026-08-02" }),
      parte({ field_note: "  ", operational_code: "CH 4" }),
    ]);
    expect(r.conNota).toBe(3);
    expect(r.partes).toBe(4);
    expect(r.observaciones).toHaveLength(2);
    const primera = r.observaciones[0];
    expect(primera.aulas).toBe(2);
    // El texto es el del PRIMERO tal como se escribió, no la clave normalizada.
    expect(primera.texto).toBe("El docente pidió empezar al final");
    expect(primera.codigos).toEqual(["CH 1", "CH 2"]);
    expect(primera.aplicadores).toEqual(["Equipo 1", "Equipo 4"]);
    expect(primera.ultima).toBe("2026-08-03");
  });

  it("lo repetido va primero, y a igualdad lo más reciente", () => {
    const r = observacionesDeCampo([
      parte({ field_note: "Sola", applied_date: "2026-08-09" }),
      parte({ field_note: "Dos veces", applied_date: "2026-08-01" }),
      parte({ field_note: "Dos veces", applied_date: "2026-08-02" }),
      parte({ field_note: "Otra sola", applied_date: "2026-08-10" }),
    ]);
    expect(r.observaciones.map((o) => o.texto)).toEqual(["Dos veces", "Otra sola", "Sola"]);
  });

  it("sin observaciones no inventa ninguna", () => {
    const r = observacionesDeCampo([parte({ operational_code: "CH 1" })]);
    expect(r).toEqual({ observaciones: [], conNota: 0, partes: 1 });
  });

  it("el mismo aplicador no se repite en la lista de quién lo reportó", () => {
    const r = observacionesDeCampo([
      parte({ field_note: "X", applied_by: "Equipo 1" }),
      parte({ field_note: "X", applied_by: "Equipo 1" }),
      parte({ field_note: "X", applied_by: "Equipo 2" }),
    ]);
    expect(r.observaciones[0].aplicadores).toEqual(["Equipo 1", "Equipo 2"]);
    expect(r.observaciones[0].aulas).toBe(3);
  });
});
