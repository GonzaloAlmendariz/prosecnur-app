import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Un ajuste que QUEDA PUESTO es un interruptor (`components/Switch`); la casilla
 * sólo marca elementos de una lista sobre los que se va a actuar (dictado
 * 2026-09-04). Inventario de Codificación: una casilla nueva se justifica como
 * selección o el test cae.
 */
const leer = (rel: string) => fs.readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const casillas = (src: string) => (src.match(/type="checkbox"/gu) ?? []).length;

const CASILLAS_PERMITIDAS: Record<string, number> = {
  "./CodingConfigActions.tsx": 2, // variables a exportar en la matriz · filas de la matriz importada a usar
  "./RespuestasCodificador.tsx": 1, // respuestas que se meten o sacan del grupo activo
  "./AgruparCategoriasCodificador.tsx": 0,
  "./PreguntasLanding.tsx": 0,
};

const INTERRUPTORES: Array<[string, string]> = [
  ["./AgruparCategoriasCodificador.tsx", "Recoge el resto de códigos sin asignar"],
  ["./AgruparCategoriasCodificador.tsx", "Recoge los años escritos en «Otro» que caen en su rango"],
  ["./AgruparCategoriasCodificador.tsx", "Recoge el resto de textos escritos en «Otro»"],
];

describe("Codificación: ajustes con interruptor, selección con casilla", () => {
  it.each(Object.entries(CASILLAS_PERMITIDAS))("%s no suma casillas fuera de la selección", (archivo, n) => {
    expect(casillas(leer(archivo))).toBe(n);
  });

  it.each(INTERRUPTORES)("%s: «%s» es un interruptor", (archivo, rotulo) => {
    const src = leer(archivo);
    const i = src.indexOf(`ariaLabel="${rotulo}"`);
    expect(i, `no se encontró el interruptor «${rotulo}»`).toBeGreaterThan(-1);
    expect(src.lastIndexOf("<Switch", i)).toBeGreaterThan(src.lastIndexOf("/>", i));
  });

  it("«Incluir en codificación» es un interruptor con rótulo fijo", () => {
    const src = leer("./PreguntasLanding.tsx");
    const i = src.indexOf("ariaLabel={`Incluir ${p.parent} en el flujo de codificación`}");
    expect(i).toBeGreaterThan(-1);
    expect(src.lastIndexOf("<Switch", i)).toBeGreaterThan(src.lastIndexOf("/>", i));
    expect(src).not.toContain("✓ Incluida en codificación");
  });
});
