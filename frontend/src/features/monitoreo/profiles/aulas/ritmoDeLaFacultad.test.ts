import { describe, expect, it } from "vitest";
import { ritmoDeLaFacultad, type RitmoDeFacultad } from "./ritmoDeLaFacultad";
import type { RitmoDiario } from "./AulasRitmoDiario";

const global: RitmoDiario = {
  dias: [
    { fecha: "2026-09-07", validas: 100, acumulado: 100 },
    { fecha: "2026-09-08", validas: 200, acumulado: 300 },
    { fecha: "2026-09-09", validas: 466, acumulado: 766 },
  ],
  dias_con_campo: 3,
  mejor_dia: { fecha: "2026-09-09", validas: 466 },
  media_diaria: 255.3,
  meta: 3233,
  brecha: 2467,
};

const porFacultad: RitmoDeFacultad[] = [
  {
    facultad: "PSICOLOGÍA", faculty_key: "PSICOLOGIA",
    dias: [
      { fecha: "2026-09-07", validas: 10, acumulado: 10 },
      { fecha: "2026-09-08", validas: 0, acumulado: 10 },
      { fecha: "2026-09-09", validas: 40, acumulado: 50 },
    ],
    dias_con_campo: 2, mejor_dia: { fecha: "2026-09-09", validas: 40 },
    media_diaria: 25, meta: 120, brecha: 70,
  },
];

describe("ritmoDeLaFacultad", () => {
  it("sin facultad en foco devuelve la serie del operativo", () => {
    expect(ritmoDeLaFacultad(global, porFacultad, undefined)).toBe(global);
  });

  it("con facultad en foco devuelve SU serie, no la del operativo", () => {
    const r = ritmoDeLaFacultad(global, porFacultad, "PSICOLOGÍA");
    expect(r?.dias.at(-1)?.acumulado).toBe(50);
    expect(r?.meta).toBe(120);
    expect(r?.brecha).toBe(70);
  });

  it("empareja sin depender de acentos ni de mayúsculas", () => {
    expect(ritmoDeLaFacultad(global, porFacultad, "psicologia")?.meta).toBe(120);
  });

  it("sin el bloque del motor manda la global — no se inventa un reparto", () => {
    expect(ritmoDeLaFacultad(global, [], "PSICOLOGÍA")).toBe(global);
    expect(ritmoDeLaFacultad(global, undefined, "PSICOLOGÍA")).toBe(global);
  });

  it("una facultad sin respuestas dibuja el mismo calendario a cero", () => {
    const r = ritmoDeLaFacultad(global, porFacultad, "DERECHO");
    expect(r?.dias.map((d) => d.fecha)).toEqual(["2026-09-07", "2026-09-08", "2026-09-09"]);
    expect(r?.dias.every((d) => d.validas === 0 && d.acumulado === 0)).toBe(true);
    expect(r?.dias_con_campo).toBe(0);
    // Y NO cae al vacío del componente, que diría «no traen fecha de envío».
    expect(r).not.toBeNull();
  });

  it("sin serie global tampoco revienta", () => {
    expect(ritmoDeLaFacultad(null, porFacultad, undefined)).toBeNull();
    expect(ritmoDeLaFacultad(null, porFacultad, "DERECHO")?.dias).toEqual([]);
  });
});
