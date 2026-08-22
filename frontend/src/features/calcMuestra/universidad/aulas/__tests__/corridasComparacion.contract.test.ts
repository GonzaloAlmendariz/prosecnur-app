/**
 * Los tres caminos que lanzan la comparación mandan lo mismo.
 *
 * Comparar y medir estabilidad son acciones distintas desde `d87e5ac9`. Pero
 * había tres formas de lanzar la comparación con dos comportamientos: la barra
 * mandaba `0`, mientras `runComparison` de Método y el aviso de etapa de
 * Simulación mandaban `config.simulation_runs ?? config.monte_carlo_n ?? 500`.
 * Con HSVG2026 (`simulation_runs: 0`) los tres acaban en 0 por casualidad,
 * porque `??` deja pasar el cero; con un estudio que declare 300, un botón
 * compararía con 300 corridas y otro con ninguna.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CM_CORRIDAS_COMPARACION, corridasDeEstabilidad } from "../duracionComparacion";

const leer = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const sinComentarios = (f: string) =>
  f.replace(/\{\/\*[\s\S]*?\*\/\}/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

const CAMINOS = ["../AulasMetodoTab.tsx", "../AulasSimulacionTab.tsx", "../ClassroomLabCommandBar.tsx"];

const CAMINOS_SORTEO = [
  "../ClassroomLabCommandBar.tsx",
  "../AulasSeleccionTab.tsx",
  "../ClassroomMethodComparator.tsx",
];

describe("los caminos que sortean respetan la configuración", () => {
  it("ninguno sortea con el método RECOMENDADO a espaldas del configurado", () => {
    // f2623619 lo reparó en la barra de acciones y el defecto seguía vivo en el
    // aviso de etapa de Selección, que mandaba `recommendedMethodId`. El tercer
    // camino —«Usar método» en una tarjeta— manda el id de ESA tarjeta, que es
    // una elección explícita y por eso es legítimo.
    for (const rel of ["../ClassroomLabCommandBar.tsx", "../AulasSeleccionTab.tsx"]) {
      const copy = sinComentarios(leer(rel));
      expect(copy, `${rel} sortea con el recomendado`)
        .not.toMatch(/onSelectMethod\([^)]*recommendedMethodId/);
    }
  });

  it("los tres caminos existen y llaman a onSelectMethod", () => {
    for (const rel of CAMINOS_SORTEO) {
      expect(sinComentarios(leer(rel)), `${rel} ya no sortea`).toContain("onSelectMethod(");
    }
  });
});

describe("las corridas de la comparación salen de un solo sitio", () => {
  it("comparar es una pasada por método, no una simulación", () => {
    expect(CM_CORRIDAS_COMPARACION).toBe(0);
  });

  it("ningún camino recalcula las corridas por su cuenta", () => {
    for (const rel of CAMINOS) {
      const copy = sinComentarios(leer(rel));
      expect(copy, `${rel} vuelve a resolver las corridas a mano`)
        .not.toMatch(/simulation_runs\s*\?\?\s*[\w.]*monte_carlo_n/);
    }
  });

  it("los tres caminos nombran la constante", () => {
    for (const rel of CAMINOS) {
      expect(sinComentarios(leer(rel)), `${rel} no usa CM_CORRIDAS_COMPARACION`)
        .toContain("CM_CORRIDAS_COMPARACION");
    }
  });

  it("comparar y medir estabilidad siguen siendo cosas distintas", () => {
    // Si acabaran en el mismo número, M1 se habría deshecho.
    expect(corridasDeEstabilidad({}).corridas).not.toBe(CM_CORRIDAS_COMPARACION);
  });
});
