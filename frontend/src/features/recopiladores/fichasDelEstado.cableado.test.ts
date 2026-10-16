import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const fuente = fs.readFileSync(path.join(aqui, "MaterialsSection.tsx"), "utf8");

/**
 * H22 — guardián de fuente del cableado.
 *
 * `MaterialsSection` arranca en `loading` y pinta tras un `useEffect` con
 * fetch; con `renderToStaticMarkup` (este repo no tiene DOM de test ni
 * @testing-library) nunca llega a dibujar el contador ni a pulsar «Generar».
 * Mismo motivo que `fichasDenominador.test.ts`. Las funciones puras se prueban
 * en `fichasDelEstado.test.ts`; aquí se vigila que la sección las use.
 */
describe("H22 — MaterialsSection lee las fichas del estado persistido", () => {
  it("el numerador ya no sale de instances.length (contaba instancias de la sesión, no unidades)", () => {
    expect(fuente).not.toMatch(/cuentaDeFichas\(\s*instances\.length/);
    expect(fuente).toMatch(/fichasHechasDelEstado\(/);
  });

  it("render() reutiliza la instancia persistida antes de crear una nueva", () => {
    // Hoy: `instances.length ? instances : await createInstances()` con
    // `instances` siempre [] al montar → cada render crea una instancia nueva
    // y `material_instances` crece en cada visita.
    expect(fuente).toMatch(/instanciaReutilizable\(/);
    expect(fuente).toMatch(/from "\.\/fichasDelEstado"/);
  });
});
