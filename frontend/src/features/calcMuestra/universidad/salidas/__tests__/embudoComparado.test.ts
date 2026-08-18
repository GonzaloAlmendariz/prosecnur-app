import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { pasoComparado, pasosComparables } from "../embudoComparadoModel";
import type { FichaFacultad } from "../../criterios/fichaFacultadModel";

// El embudo comparado de Coincidencia proyecta las cifras hoy/antes que
// fichaFacultadModel ya enfrentó. Reglas que estos tests fijan: null nunca se
// coacciona a 0 (Number(null) es 0 — trampa del repo), el paso 6 sin
// histórico no aparece como comparable, y la escala es el máximo de TODAS las
// barras (hoy y antes), no sólo de hoy.

function ficha(facultad: string, pasos: Array<[number, string, number | null, number | null]>): FichaFacultad {
  return {
    facultad,
    criteriosPropios: [],
    reservasSostenibles: null,
    reservasPedidas: null,
    aviso: "",
    pasos: pasos.map(([n, titulo, hoy, antes]) => ({ n, titulo, hoy, antes, detalle: "" })),
  };
}

const FICHAS: FichaFacultad[] = [
  ficha("DERECHO", [
    [3, "Aulas que pasan los criterios", 395, 16],
    [6, "Aulas que sobran", 12, null],
  ]),
  ficha("EE.GG. CIENCIAS", [
    [3, "Aulas que pasan los criterios", 299, 25],
    [6, "Aulas que sobran", 4, null],
  ]),
  ficha("SIN MEDIR", [
    [3, "Aulas que pasan los criterios", null, 480],
    [6, "Aulas que sobran", null, null],
  ]),
];

describe("pasosComparables", () => {
  it("incluye los pasos con columna de 2025 y excluye los que no la tienen", () => {
    expect(pasosComparables(FICHAS)).toEqual([{ n: 3, titulo: "Aulas que pasan los criterios" }]);
  });
});

describe("pasoComparado", () => {
  const paso = pasoComparado(FICHAS, 3);

  it("ordena por HOY descendente con los sin-cifra al final", () => {
    expect(paso.filas.map((f) => f.facultad)).toEqual(["DERECHO", "EE.GG. CIENCIAS", "SIN MEDIR"]);
  });

  it("la escala es el máximo de AMBAS series — aquí lo pone un antes (480)", () => {
    expect(paso.escala).toBe(480);
  });

  it("null se queda null: ni hoy, ni antes, ni delta degradan a 0", () => {
    const sinMedir = paso.filas.find((f) => f.facultad === "SIN MEDIR");
    expect(sinMedir).toMatchObject({ hoy: null, antes: 480, delta: null });
  });

  it("el delta es hoy − antes con signo", () => {
    expect(paso.filas.find((f) => f.facultad === "DERECHO")?.delta).toBe(379);
    expect(paso.comparables).toBe(2);
  });
});

describe("montaje en Coincidencia", () => {
  // Test de FUENTE (patrón TarjetasComparativas.test): el componente está
  // importado y montado SIN guard apagado — un mutante `{false && <Embudo…`
  // muere por el negative lookbehind, no sólo por el toMatch del montaje.
  const src = readFileSync(
    join(__dirname, "..", "SalidasCoincidenciaTab.tsx"),
    "utf8",
  );

  it("Coincidencia muestra el sello en modo lectura (la acción vive en Selección)", () => {
    expect(src).toContain('from "../aulas/CertificacionFacultadCard"');
    expect(src).toMatch(/<CertificacionFacultadCard certificacion=\{certificacion\} \/>/);
    // Sin onAgregarAula: el eco no ofrece la acción.
    expect(src).not.toMatch(/CertificacionFacultadCard[^/]*onAgregarAula/);
  });

  it("Coincidencia monta el embudo comparado con las fichas y el periodo", () => {
    expect(src).toContain('from "./EmbudoComparadoFacultades"');
    expect(src).toMatch(/<EmbudoComparadoFacultades[\s\S]*?fichas=\{fichas\}/);
    expect(src).toMatch(/<EmbudoComparadoFacultades[\s\S]*?periodo=\{referencia\?\.periodo \?\? ""\}/);
  });

  it("el montaje no está apagado con un guard constante", () => {
    expect(src).not.toMatch(/false\s*&&[\s\S]{0,80}<EmbudoComparadoFacultades/);
    expect(src).not.toMatch(/\{\s*false\s*&&/);
  });
});

describe("paso 7 — titulares seleccionados", () => {
  it("entra al embudo comparado cuando hay selección y referencia", () => {
    const fichas: FichaFacultad[] = [
      ficha("DERECHO", [[7, "Titulares seleccionados", 18, 16]]),
      ficha("ARQUITECTURA Y URBANISMO", [[7, "Titulares seleccionados", 15, 6]]),
    ];
    expect(pasosComparables(fichas)).toEqual([{ n: 7, titulo: "Titulares seleccionados" }]);
    const paso = pasoComparado(fichas, 7);
    expect(paso.filas.find((f) => f.facultad === "ARQUITECTURA Y URBANISMO")?.delta).toBe(9);
  });

  it("sin selección corrida el hoy viaja null, jamás 0", () => {
    const fichas: FichaFacultad[] = [ficha("DERECHO", [[7, "Titulares seleccionados", null, 16]])];
    const fila = pasoComparado(fichas, 7).filas[0];
    expect(fila.hoy).toBeNull();
    expect(fila.delta).toBeNull();
  });
});
