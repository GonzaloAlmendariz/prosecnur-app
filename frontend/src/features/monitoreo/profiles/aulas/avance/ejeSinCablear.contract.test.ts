import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ADR 0121: ninguna vista de Avance nombra, agrupa ni cruza por una variable
 * fija. «Facultad» como texto sólo puede aparecer como RESPALDO de un corte que
 * no declara su eje (`|| "Facultad"`), nunca como rótulo directo.
 */
describe('Avance no cablea "Facultad" (ADR 0121)', () => {
  it('los modelos de Avance sólo usan "Facultad" como respaldo del eje', () => {
    const dir = __dirname;
    const culpables: string[] = [];
    const fuentes = readdirSync(dir).filter((archivo) => /Modelo\.ts$|cuotaPorCruce\.ts$/.test(archivo));
    // Si el filtro dejara de casar, el guard pasaría en verde sin mirar nada.
    expect(fuentes.length).toBeGreaterThan(5);
    for (const archivo of fuentes) {
      const lineas = readFileSync(join(dir, archivo), "utf8").split("\n");
      lineas.forEach((linea, i) => {
        if (/^\s*(\/\/|\*|\/\*)/.test(linea)) return;
        if (/["'`]Facultad["'`]/.test(linea) && !/\|\|\s*["']Facultad["']/.test(linea)) {
          culpables.push(`${archivo}:${i + 1}: ${linea.trim()}`);
        }
      });
    }
    expect(culpables).toEqual([]);
  });
});
