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
// Las reglas de cada sección salieron de Layout a un módulo puro que también lee
// "Estado del estudio" (etapa P2 del ADR 0142). Layout conserva el cableado al riel.
const secciones = fs.readFileSync(
  path.join(aqui, "../features/procesamiento/estado/seccionesDeProcesamiento.ts"),
  "utf8",
);

describe("el riel de Procesamiento separa faltar de estar bloqueada", () => {
  test("`is-blocked` depende sólo de `blockedReason`", () => {
    // Desde L15 el riel es el SectionPillbar del kit: `is-blocked` sale de
    // `lockedReason`, y a `lockedReason` sólo llega `blockedReason`.
    expect(layout).toMatch(/lockedReason: it\.blockedReason \?\? undefined,/);
    const linea = layout.split("\n").find((l) => l.includes("lockedReason:")) ?? "";
    expect(linea).not.toMatch(/falta/i);
    const pillbar = fs.readFileSync(path.join(aqui, "../components/SectionPillbar.tsx"), "utf8");
    expect(pillbar).toMatch(/item\.lockedReason \? "is-blocked" : ""/);
  });

  test("el riel toma sus secciones del módulo compartido", () => {
    expect(layout).toMatch(/return seccionesDeProcesamiento\(state\);/);
  });

  test("lo que falta viaja por su propio campo", () => {
    expect(secciones).toMatch(/faltaReason\?: string;/);
    expect(secciones).toMatch(/faltaReason: hasAnalitica \? coberturaGraficos\(state\)\.motivo/);
  });

  test("ningún `blockedReason` se alimenta de la cobertura por base", () => {
    // El control: si `coberturaGraficos` volviera a un `blockedReason`, el
    // pill se pintaría bloqueado y dejaría de poder abrirse.
    const lineas = secciones.split("\n").filter((l) => l.includes("blockedReason:"));
    expect(lineas.length).toBeGreaterThanOrEqual(4);
    expect(lineas.some((l) => l.includes("coberturaGraficos"))).toBe(false);
  });

  test("el motivo llega al title y al lector de pantalla", () => {
    expect(layout).toMatch(/nota: it\.faltaReason \?\?/);
    const pillbar = fs.readFileSync(path.join(aqui, "../components/SectionPillbar.tsx"), "utf8");
    expect(pillbar).toMatch(/title=\{item\.lockedReason \?\? item\.nota \?\? item\.label\}/);
    // Desde 706d0c130 el motivo entra al aria-label de la píldora junto con su marca
    // (pendientes o lista), en vez de un span sólo para lector de pantalla.
    expect(pillbar).toMatch(/\[item\.lockedReason \?\? item\.nota, marca\]/);
    expect(pillbar).toMatch(/aria-label=\{detalle \? `\$\{item\.label\}\. \$\{detalle\}` : undefined\}/);
  });
});
