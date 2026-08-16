import { describe, expect, it } from "vitest";
import {
  PULSO_PUCP_COLORS,
  ROJO_FUERA_DE_RAMPA,
  SUGERIDAS_PALETAS,
} from "./paletasSugeridas";

const todas = Object.entries(SUGERIDAS_PALETAS).flatMap(([n, lista]) =>
  lista.map((p) => ({ ...p, n: Number(n) })),
);
const ordinales = todas.filter((p) => p.ordinal);

describe("paletas sugeridas", () => {
  it("ninguna rampa ordinal usa el rojo de juicio", () => {
    // La razón de existir de este archivo: cada proyecto nuevo nacía con el
    // rojo en la rampa y había que corregirlo lista por lista.
    const conRojo = ordinales.filter((p) =>
      p.colors.some((c) => c.toUpperCase() === ROJO_FUERA_DE_RAMPA.toUpperCase()),
    );
    expect(conRojo.map((p) => `${p.n}: ${p.label}`)).toEqual([]);
  });

  it("cada cantidad ofrece exactamente una rampa ordinal", () => {
    // Ni cero —el analista se quedaría sin escala y elegiría una categórica—
    // ni dos, que obligaría a adivinar cuál es la de la casa.
    for (const [n, lista] of Object.entries(SUGERIDAS_PALETAS)) {
      expect(lista.filter((p) => p.ordinal)).toHaveLength(1);
      expect(lista.every((p) => p.colors.length === Number(n))).toBe(true);
    }
  });

  it("la rampa de cuatro pasos es la del entregable aprobado", () => {
    const r = SUGERIDAS_PALETAS[4].find((p) => p.ordinal);
    expect(r?.colors).toEqual(["#F4B183", "#EFD25E", "#B0D597", "#85BB85"]);
  });

  it("las categóricas conservan el rojo institucional", () => {
    // El arreglo es para las rampas: quitarlo de todas partes borraría el color
    // de la casa de los gráficos que sí distinguen series sin orden.
    const categoricas = todas.filter((p) => !p.ordinal);
    expect(
      categoricas.some((p) => p.colors.includes(ROJO_FUERA_DE_RAMPA)),
    ).toBe(true);
  });

  it("ninguna paleta repite un color dentro de sí misma", () => {
    for (const p of todas) {
      expect(new Set(p.colors).size).toBe(p.colors.length);
    }
  });

  it("los dos pasos nuevos de la rampa están declarados", () => {
    expect(PULSO_PUCP_COLORS.naranjaSuave).toBe("#F4B183");
    expect(PULSO_PUCP_COLORS.verdeClaro).toBe("#B0D597");
  });
});
