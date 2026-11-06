import { describe, expect, it } from "vitest";
import { avisoDentroDeLamina } from "./avisoEnLamina";

const PM = "·";

describe("avisoDentroDeLamina (H12)", () => {
  it("quita el rótulo de la lámina, con título y tipo, y no deja punto medio", () => {
    const t = avisoDentroDeLamina(`Lámina 3 ${PM} “Satisfacción” (Un gráfico): el Top Two Box está encendido pero sin sus respuestas.`);
    expect(t).toBe("El Top Two Box está encendido pero sin sus respuestas.");
    expect(t).not.toContain(PM);
  });
  it("también el de una base y el que sólo lleva el número", () => {
    expect(avisoDentroDeLamina(`Lámina 4 de «Docentes» ${PM} “Perfil”: falta la pregunta.`)).toBe("Falta la pregunta.");
    expect(avisoDentroDeLamina("Lámina 41: no se pudo dibujar y sale con «Sin datos».")).toBe("No se pudo dibujar y sale con «Sin datos».");
    expect(avisoDentroDeLamina("Lámina 2 (Índice): no tiene capítulos.")).toBe("No tiene capítulos.");
  });
  it("sin el código técnico del final y con coma en lugar del punto medio", () => {
    expect(avisoDentroDeLamina(`No se pudo leer la base ${PM} E_BASE_FALTA`)).toBe("No se pudo leer la base");
    expect(avisoDentroDeLamina(`Citas sin aprobar ${PM} borrador`)).toBe("Citas sin aprobar, borrador");
  });
  it("un aviso sin rótulo queda igual", () => {
    expect(avisoDentroDeLamina("La pregunta se lee de la base principal.")).toBe("La pregunta se lee de la base principal.");
  });
});
