import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  ESTANDAR_NOMINAL,
  LIKERT_RECETARIO,
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

  it("la rampa de cuatro pasos es la Likert del recetario, la misma que el motor pone por defecto (Gonzalo, 2026-10-09)", () => {
    const r = SUGERIDAS_PALETAS[4].find((p) => p.ordinal);
    expect(r?.colors).toEqual(["#F4B183", "#FFD965", "#ADD493", "#70AD47"]);
    const r5 = SUGERIDAS_PALETAS[5].find((p) => p.ordinal);
    expect(r5?.colors).toEqual(["#F4B183", "#FFD965", "#ADD493", "#70AD47", "#BFBFBF"]);
    const r6 = SUGERIDAS_PALETAS[6].find((p) => p.ordinal);
    expect(r6?.colors[2]).toBe(LIKERT_RECETARIO.neutro);
  });

  it("ninguna paleta lleva el coral: va sólo en los títulos (estandar_pulso.json, reglas.coral)", () => {
    const conCoral = todas.filter((p) => p.colors.some((c) => c.toUpperCase() === ROJO_FUERA_DE_RAMPA.toUpperCase()));
    expect(conCoral.map((p) => `${p.n}: ${p.label}`)).toEqual([]);
  });

  it("las nominales son las del estándar: el JSON manda (Gonzalo, 2026-10-27)", () => {
    const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
    const json = JSON.parse(readFileSync(resolve(raiz, "api/inst/estandar/estandar_pulso.json"), "utf8"));
    const pal = json.ppt.paletas;
    expect(ESTANDAR_NOMINAL.dicotomica).toEqual(pal.dicotomica.colores);
    expect(ESTANDAR_NOMINAL.categorica).toEqual(pal.categorica.colores);
    expect(ESTANDAR_NOMINAL.actores).toEqual(pal.actores.colores);
    expect(LIKERT_RECETARIO.desacuerdoFuerte).toBe(pal.likert.colores[0]);
    expect(LIKERT_RECETARIO.neutro).toBe(pal.likert_neutro.colores[2]);
    // Lo que completa una lista de dos opciones sin colores es la dicotómica, como el mazo entregado de ACRD Conta.
    expect(SUGERIDAS_PALETAS[2][0].colors).toEqual(pal.dicotomica.colores);
    for (const n of [3, 5, 6]) expect(SUGERIDAS_PALETAS[n][0].colors[0]).toBe(pal.categorica.colores[0]);
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
