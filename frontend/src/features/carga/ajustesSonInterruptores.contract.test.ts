import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Un ajuste que QUEDA PUESTO es un interruptor (`components/Switch`); la casilla
 * sólo marca elementos de una lista sobre los que se va a actuar (dictado
 * 2026-09-04: «no debe ser un check, debe ser un switch»). El usuario volvió a
 * encontrar casillas en Carga, así que el inventario se fija aquí: una casilla
 * nueva tiene que justificarse como selección o el test cae.
 */
const leer = (rel: string) => fs.readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const casillas = (src: string) => (src.match(/type="checkbox"/gu) ?? []).length;

// Casillas legítimas: selección múltiple o confirmación de una acción.
const CASILLAS_PERMITIDAS: Record<string, number> = {
  "./BasesPanel.tsx": 3, // recopiladores a incluir: rejilla de decisión, selector SM y su ID manual
  "./ReconciliacionExtraDialog.tsx": 1, // variables extra a incorporar
  "./AcreditacionBatchPanel.tsx": 1, // confirmar el reemplazo antes de crear las bases
  "./CargaPage.tsx": 0,
  "./CargaUniverseFilter.tsx": 0,
};

// Ajustes que quedan puestos: cada rótulo vive junto a un `<Switch`.
const INTERRUPTORES: Array<[string, string]> = [
  ["./CargaUniverseFilter.tsx", "Usar una variable real/prueba"],
  ["./CargaPage.tsx", "Incluir respuestas parciales"],
  ["./BasesPanel.tsx", "Mostrar solo casos observados"],
  ["./BasesPanel.tsx", "Mostrar solo respuestas casi completas"],
  ["./BasesPanel.tsx", "Rescatar parciales con avance suficiente"],
  ["./BasesPanel.tsx", "Permitir repetidos en la base"],
  ["./BasesPanel.tsx", "Permitir rechazos en la base"],
];

describe("Carga: ajustes con interruptor, selección con casilla", () => {
  it.each(Object.entries(CASILLAS_PERMITIDAS))("%s no suma casillas fuera de la selección", (archivo, n) => {
    expect(casillas(leer(archivo))).toBe(n);
  });

  it.each(INTERRUPTORES)("%s: «%s» es un interruptor", (archivo, rotulo) => {
    const src = leer(archivo);
    const i = src.indexOf(`ariaLabel="${rotulo}"`);
    expect(i, `no se encontró el interruptor «${rotulo}»`).toBeGreaterThan(-1);
    expect(src.lastIndexOf("<Switch", i)).toBeGreaterThan(src.lastIndexOf("/>", i));
  });

  it("la piel del interruptor no reimplementa la geometría de la casa", () => {
    const css = leer("./carga-v2.css");
    expect(css).not.toMatch(/\.pulso-carga-universe-switch\s*>\s*span/u);
    const piel = css.match(/\.pulso-carga-switch\s*\{([^}]*)\}/u)?.[1] ?? "";
    expect(piel).toMatch(/--pulso-switch-accent/u);
    expect(piel).not.toMatch(/(?:^|;)\s*(?:width|height|left|transform)\s*:/u);
  });
});
