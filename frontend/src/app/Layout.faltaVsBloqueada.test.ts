import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

// Al conectar la cobertura por base de Gráficos reusé `blockedReason` para
// decir «faltan los mazos de egresados». Eso pintó `is-blocked` sobre una
// sección que sí se puede abrir: una etapa incompleta no es una etapa
// bloqueada, y el riel las distingue con clase, no sólo con texto.
//
// El test mira el cableado porque el defecto era de cableado: el texto salía
// bien y la clase estaba mal.

const aqui = path.dirname(fileURLToPath(import.meta.url));
const layout = fs.readFileSync(path.join(aqui, "Layout.tsx"), "utf8");

describe("el riel de Procesamiento separa faltar de estar bloqueada", () => {
  test("`is-blocked` depende sólo de `blockedReason`", () => {
    const clase = layout.slice(layout.indexOf('blocked ? "is-blocked"'));
    expect(clase.slice(0, 80)).not.toMatch(/falta/i);
    expect(layout).toMatch(/const blocked = !!it\.blockedReason;/);
  });

  test("lo que falta viaja por su propio campo", () => {
    expect(layout).toMatch(/faltaReason\?: string;/);
    expect(layout).toMatch(/faltaReason: hasAnalitica \? coberturaGraficos\(state\)\.motivo/);
  });

  test("ningún `blockedReason` se alimenta de la cobertura por base", () => {
    // El control: si `coberturaGraficos` volviera a un `blockedReason`, el
    // pill se pintaría bloqueado y dejaría de poder abrirse.
    const lineas = layout.split("\n").filter((l) => l.includes("blockedReason:"));
    expect(lineas.length).toBeGreaterThanOrEqual(4);
    expect(lineas.some((l) => l.includes("coberturaGraficos"))).toBe(false);
  });

  test("el motivo llega al title y al lector de pantalla", () => {
    expect(layout).toMatch(/title=\{it\.blockedReason \?\? it\.faltaReason \?\?/);
    expect(layout).toMatch(/: it\.faltaReason\s*\n\s*\? `\$\{it\.label\}\. \$\{it\.faltaReason\}`/);
  });
});
