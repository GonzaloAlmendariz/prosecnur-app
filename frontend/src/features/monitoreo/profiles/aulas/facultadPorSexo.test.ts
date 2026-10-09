import { describe, expect, it } from "vitest";
import { perfilDesdeElMotor } from "./perfilPorFacultad";

const fila = (p: Record<string, unknown>) => ({ faculty: "DERECHO", aulas: 4, meta: 100, respuestas_validas: 60, brecha: 40, ...p });

describe("el perfil por facultad lleva de qué lado va corta", () => {
  it("pasa el déficit de cada sexo del motor", () => {
    const { facultades } = perfilDesdeElMotor([
      fila({ mujeres_deficit: 12, hombres_deficit: 0, celda_corta: true }),
    ]) as { facultades: Array<Record<string, unknown>> };
    expect(facultades[0]).toMatchObject({ mujeresFalta: 12, hombresFalta: 0, celdaCorta: true });
  });

  it("UNA CELDA AUSENTE ES null, NO cero: no se sabe no es va bien", () => {
    const { facultades } = perfilDesdeElMotor([
      fila({ mujeres_deficit: 5, hombres_deficit: null }),
    ]) as { facultades: Array<Record<string, unknown>> };
    expect(facultades[0]!.mujeresFalta).toBe(5);
    expect(facultades[0]!.hombresFalta).toBeNull();
  });

  it("sin el corte del motor no se inventa un cero", () => {
    const { facultades } = perfilDesdeElMotor([fila({})]) as { facultades: Array<Record<string, unknown>> };
    expect(facultades[0]!.mujeresFalta).toBeNull();
    expect(facultades[0]!.celdaCorta).toBe(false);
  });

  it("un déficit negativo no existe: se recorta a cero", () => {
    const { facultades } = perfilDesdeElMotor([
      fila({ mujeres_deficit: -3 }),
    ]) as { facultades: Array<Record<string, unknown>> };
    expect(facultades[0]!.mujeresFalta).toBe(0);
  });
});
