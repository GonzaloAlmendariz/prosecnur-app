import { describe, expect, it } from "vitest";
import { acreditacionVentanaCampoObservada } from "./AcreditacionVentanaCampo";

describe("ventana de campo observada", () => {
  it("deriva inicio, fin y semanas del rango real de acrconta", () => {
    // El campo corrió del 25/05 al 22/07: 59 días de calendario, 9 semanas.
    const rows = [
      { Fecha: "2026-05-25", "Total respuestas": 25 },
      { Fecha: "2026-06-11", "Total respuestas": 11 },
      { Fecha: "2026-07-22", "Total respuestas": 2 },
    ];
    const v = acreditacionVentanaCampoObservada(rows)!;
    expect(v.inicio).toBe("2026-05-25");
    expect(v.fin).toBe("2026-07-22");
    expect(v.diasCalendario).toBe(59);
    expect(v.diasConRespuesta).toBe(3);
    expect(v.semanas).toBe(9);
  });

  it("ignora los días sin respuesta para fijar los extremos", () => {
    const rows = [
      { Fecha: "2026-05-01", "Total respuestas": 0 },
      { Fecha: "2026-05-04", "Total respuestas": 3 },
      { Fecha: "2026-05-09", "Total respuestas": 0 },
    ];
    const v = acreditacionVentanaCampoObservada(rows)!;
    expect(v.inicio).toBe("2026-05-04");
    expect(v.fin).toBe("2026-05-04");
    expect(v.semanas).toBe(1);
  });

  it("no adivina formatos de fecha ajenos al bloque canónico", () => {
    expect(acreditacionVentanaCampoObservada([{ Fecha: "25/05/2026", Total: 4 }])).toBeNull();
    expect(acreditacionVentanaCampoObservada([{ Fecha: "Sin fecha", Total: 4 }])).toBeNull();
  });

  it("devuelve null cuando no hay ninguna respuesta fechada", () => {
    expect(acreditacionVentanaCampoObservada([])).toBeNull();
    expect(acreditacionVentanaCampoObservada([{ Fecha: "2026-05-01", Total: 0 }])).toBeNull();
  });

  it("usa Efectivas cuando el bloque no publica un total", () => {
    const v = acreditacionVentanaCampoObservada([{ Fecha: "2026-06-02", Efectivas: 7 }])!;
    expect(v.diasConRespuesta).toBe(1);
  });
});
