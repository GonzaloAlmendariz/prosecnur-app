import { describe, expect, it } from "vitest";

import { aulaDeLaClase, clasesSinCita } from "./clasesSinCita";

const clase = (extra: Record<string, unknown> = {}) => ({
  codigo: "CH 7", curso: "ECONOMETRÍA", docente: "PÉREZ, JOSÉ",
  aula: "Z411", aulas: ["Z411"], aula_incierta: false,
  inicio: "08:00", fin: "10:00", modalidad: "PRESENCIAL", elegibles: 35,
  ...extra,
});

describe("clasesSinCita", () => {
  it("indexa por fecha y cuenta el total", () => {
    const v = clasesSinCita({
      dias: [
        { fecha: "2026-09-22", cursos: [clase(), clase({ codigo: "CH 18" })] },
        { fecha: "2026-09-24", cursos: [clase()] },
      ],
      total: 3,
    });
    expect(v?.total).toBe(3);
    expect(v?.porFecha.get("2026-09-22")).toHaveLength(2);
    expect(v?.porFecha.get("2026-09-24")?.[0].codigo).toBe("CH 7");
  });

  it("una fila sin código o sin horas no se pinta: sería un viaje a ciegas", () => {
    const v = clasesSinCita({
      dias: [{ fecha: "2026-09-22", cursos: [
        clase(), clase({ codigo: "" }), clase({ inicio: "" }), clase({ fin: "" }),
      ] }],
      total: 4,
    });
    expect(v?.porFecha.get("2026-09-22")).toHaveLength(1);
    expect(v?.total).toBe(1);
  });

  it("con varias aulas no elige una: las nombra todas", () => {
    const v = clasesSinCita({
      dias: [{ fecha: "2026-09-23", cursos: [
        clase({ codigo: "CH 40", aula: "", aulas: ["Z201", "Z413"], aula_incierta: true }),
      ] }],
      total: 1,
    });
    const c = v!.porFecha.get("2026-09-23")![0];
    expect(c.aulaIncierta).toBe(true);
    expect(aulaDeLaClase(c)).toBe("Z201 o Z413");
  });

  it("aunque el motor no marque la duda, dos aulas sin elegida no eligen una", () => {
    const v = clasesSinCita({
      dias: [{ fecha: "2026-09-23", cursos: [
        clase({ aula: "", aulas: ["A", "B"], aula_incierta: undefined }),
      ] }],
      total: 1,
    });
    expect(v!.porFecha.get("2026-09-23")![0].aulaIncierta).toBe(true);
  });

  it("lo que no tiene horario legible viaja aparte, con su motivo", () => {
    const v = clasesSinCita({
      dias: [],
      total: 0,
      sin_horario: [{ codigo: "CH 8", curso: "X", motivo: "El catálogo no dice qué día." }],
    });
    expect(v?.sinHorario).toHaveLength(1);
    expect(v?.sinHorario[0].motivo).toContain("catálogo");
  });

  it("un bloque ausente o vacío no fabrica una tabla vacía", () => {
    expect(clasesSinCita(null)).toBeNull();
    expect(clasesSinCita(undefined)).toBeNull();
    expect(clasesSinCita({ dias: [], total: 0 })).toBeNull();
    expect(clasesSinCita({ dias: [{ fecha: "2026-09-22", cursos: [] }], total: 0 })).toBeNull();
  });
});
