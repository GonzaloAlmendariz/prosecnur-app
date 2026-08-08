/**
 * Gate 4 del ADR 0067 · dirección canónica (ADR 0044).
 *
 * La pestaña `aulas-relato` resuelve por modo/sección/pestaña declarados en el
 * catálogo, el lente viaja en el param canónico `foco` (se lee y se escribe con
 * los helpers de `direccion.ts`) y ningún fuente del relato escribe un alias
 * histórico (`tab`, `stage`, `mesa`, `desk`, `step`, `reporte`).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CALC_MUESTRA_UNIVERSIDAD_PESTANAS } from "../../../../../../lib/navegacion/catalogos/calcMuestra";
import { conNivel, parsearDireccion } from "../../../../../../lib/navegacion/direccion";
import { resolveUniversityClassroomTab } from "../../../universidadTabs";

const RAIZ_RELATO = fileURLToPath(new URL("../", import.meta.url));

function archivosFuente(dir: string): string[] {
  const resultado: string[] = [];
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) {
      resultado.push(...archivosFuente(ruta));
      continue;
    }
    if (/\.(ts|tsx)$/.test(nombre) && !ruta.includes("__tests__")) resultado.push(ruta);
  }
  return resultado;
}

describe("ADR 0067 · gate 4 — dirección canónica", () => {
  it("el catálogo declara la pestaña con su dirección canónica completa", () => {
    const pestana = CALC_MUESTRA_UNIVERSIDAD_PESTANAS.aulas.find(
      (tab) => tab.id === "aulas-relato",
    );
    expect(pestana).toBeDefined();
    expect(pestana?.label).toBe("Relato");
    expect(pestana?.classroomTab).toBe("aulas-relato");
    expect(pestana?.to).toBe(
      "/calc-muestra?modo=opinion-universitaria&seccion=aulas&pestana=aulas-relato",
    );
  });

  it("la pestaña resuelve por la gramática y el foco se conserva crudo", () => {
    expect(resolveUniversityClassroomTab("aulas-relato")).toBe("aulas-relato");
    const direccion = parsearDireccion(
      "/calc-muestra",
      "?modo=opinion-universitaria&seccion=aulas&pestana=aulas-relato&foco=derecho",
    );
    expect(direccion).toMatchObject({
      modulo: "calc-muestra",
      modo: "opinion-universitaria",
      seccion: "aulas",
      pestana: "aulas-relato",
      foco: "derecho",
    });
  });

  it("el lente se escribe y se borra con el nivel canónico `foco`", () => {
    const base = "?modo=opinion-universitaria&seccion=aulas&pestana=aulas-relato";
    const conFoco = conNivel(base, "foco", "derecho");
    expect(conFoco).toContain("foco=derecho");
    expect(conNivel(conFoco, "foco", null)).toBe(base);
  });

  it("ningún fuente del relato escribe un alias histórico de la dirección", () => {
    for (const ruta of archivosFuente(RAIZ_RELATO)) {
      const fuente = readFileSync(ruta, "utf8");
      expect(fuente, ruta).not.toMatch(/[?&](tab|stage|mesa|desk|step|reporte)=/);
      // Escribir el foco a mano en el search saltaría la gramática compartida.
      expect(fuente, ruta).not.toMatch(/params\.set\(\s*["']foco["']/);
    }
  });
});
