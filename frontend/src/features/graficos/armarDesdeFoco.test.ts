import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// C4 teclado (QA en vivo Meta A): tras «Reemplazar plan actual» el foco caía en <body> porque `aplicar()` cerraba el
// popover sin devolverlo al disparador. Sin DOM en vitest, se fija por la fuente: todo cierre desde un control del
// diálogo pasa por `cerrarDevolviendoFoco`, que enfoca `disparadorRef`.

const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "SuggestedPlanButton.tsx"), "utf8");

function cuerpoDe(firma: string): string {
  const i = src.indexOf(firma);
  expect(i).toBeGreaterThan(-1);
  const abre = src.indexOf("{", i + firma.length);
  let profundidad = 0;
  for (let j = abre; j < src.length; j += 1) {
    if (src[j] === "{") profundidad += 1;
    else if (src[j] === "}" && --profundidad === 0) return src.slice(abre, j + 1);
  }
  throw new Error(`sin cierre para ${firma}`);
}

describe("«Armar desde…» devuelve el foco al disparador al cerrar", () => {
  it("cerrarDevolviendoFoco cierra el panel y enfoca el disparador", () => {
    const cuerpo = cuerpoDe("function cerrarDevolviendoFoco()");
    expect(cuerpo).toContain("panel.cerrar()");
    expect(cuerpo).toMatch(/enfocarSinDesplazar\(disparadorRef\.current\)/);
    expect(src).toMatch(/ref=\{disparadorRef\}[\s\S]{0,80}pulso-gv2-suggest-trigger/);
  });

  // Reemplazar, Fusionar y Sincronizar terminan en `aplicar()`.
  it("aplicar() (Reemplazar / Fusionar) cierra devolviendo el foco", () => {
    const aplicar = cuerpoDe("function aplicar(");
    expect(aplicar).toContain("cerrarDevolviendoFoco()");
    expect(aplicar).not.toMatch(/panel\.cerrar\(\)/);
    for (const f of ["function replacePlan()", "function mergePlan()"]) {
      expect(cuerpoDe(f)).toMatch(/\baplicar\(/);
    }
  });

  it("ningún botón del diálogo cierra con panel.cerrar a secas", () => {
    expect(src).not.toMatch(/onClick=\{panel\.cerrar\}/);
  });
});
