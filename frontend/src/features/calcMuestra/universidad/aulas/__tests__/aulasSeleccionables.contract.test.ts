/**
 * Guardia: ninguna cifra de «aulas» de la UI cuenta el marco COMPLETO.
 *
 * `frameRows` es el aula_frame entero —las incluidas por criterios y las
 * excluidas— y su nombre no lo dice. El 2026-08-21 se confió en él tres veces
 * seguidas: el aviso de duración anunciaba «5.269 cursos-horario» donde se
 * comparan 3.373; el mapa de preparación decía «5.269» justo debajo del rótulo
 * «Una fila por curso-horario SELECCIONABLE»; y el fallback de
 * `selectableFrameCount` sobreestimaba en silencio, del que dependen si la
 * pestaña se cree utilizable y cuántos titulares muestra.
 *
 * Ninguno lo vio el typecheck ni los tests de entonces: los vio la pantalla.
 * De ahí este contrato, que sí puede verlos antes.
 *
 * El modelo cuenta una vez (`frameIncludedCount`) y las superficies lo usan.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const src = (rel: string) => readFileSync(resolve(__dirname, "..", rel), "utf8");

const sinComentarios = (texto: string) =>
  texto.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

describe("las cifras de aulas cuentan las seleccionables", () => {
  const SUPERFICIES = ["AulasMetodoTab.tsx", "AulasSeleccionTab.tsx"];

  it("ninguna superficie mide el marco con `frameRows.length`", () => {
    for (const f of SUPERFICIES) {
      expect(sinComentarios(src(f)), `${f} cuenta el marco completo`).not.toMatch(
        /frameRows\s*\.\s*length/,
      );
    }
  });

  it("el modelo cuenta las incluidas una sola vez y las publica", () => {
    const modelo = src("classroomLabModel.ts");
    expect(modelo).toContain("frameIncludedRows");
    expect(modelo).toContain("frameIncludedCount");
    // Contar es filtrar por el booleano, no por lo que parezca verdadero:
    // `included` llega del motor y un "true" de texto no es una inclusión.
    expect(modelo).toMatch(/fila\.included === true/);
  });

  it("el fallback de aulas seleccionables no puede caer al marco completo", () => {
    const modelo = sinComentarios(src("classroomLabModel.ts"));
    // La rama sin auditoría publicada debe usar el conteo de incluidas.
    const fallback = modelo.slice(
      modelo.indexOf("const selectableFrameCount"),
      modelo.indexOf("const m1ForDisplay"),
    );
    expect(fallback).toContain("frameIncludedCount");
    expect(fallback).not.toMatch(/frameRows\s*\.\s*length/);
  });
});
