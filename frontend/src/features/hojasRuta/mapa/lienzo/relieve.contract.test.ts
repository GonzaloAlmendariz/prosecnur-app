import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import ciudades from "../../ciudadesIndice.json";
import indice from "../../relieveIndice.json";

// Relieve del lienzo (H10, build_relieve.R): una imagen del Perú y una por ciudad del índice, servidas desde public/.
const publico = resolve(__dirname, "../../../../../public/relieve");
const imagenes = (indice as { imagenes: Array<{ clave: string; oeste: number; este: number; sur: number; norte: number }> }).imagenes;

describe("relieve del lienzo", () => {
  it("cubre el Perú y cada ciudad del atlas", () => {
    const claves = new Set(imagenes.map((i) => i.clave));
    expect(claves.has("pe")).toBe(true);
    for (const c of (ciudades as { ciudades: Array<{ codigo: string }> }).ciudades) expect(claves.has(c.codigo), c.codigo).toBe(true);
  });

  it("cada imagen existe y su caja es coherente", () => {
    for (const i of imagenes) {
      expect(existsSync(resolve(publico, `${i.clave}.webp`)), i.clave).toBe(true);
      expect(i.este).toBeGreaterThan(i.oeste);
      expect(i.norte).toBeGreaterThan(i.sur);
    }
  });

  it("el conjunto no pesa más de 12 MB (se piden sólo el Perú y la ciudad abierta)", () => {
    const total = imagenes.reduce((a, i) => a + statSync(resolve(publico, `${i.clave}.webp`)).size, 0);
    expect(total).toBeLessThan(12 * 1024 * 1024);
  });

  it("cita la fuente", () => {
    expect((indice as { fuente: string }).fuente).toMatch(/Copernicus/);
  });
});
