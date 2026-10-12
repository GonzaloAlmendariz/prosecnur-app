// El selector de variables quedó sin estilos al retirarse el editor anterior (d5aa22564): su hoja sólo la cargaba ese
// editor. Este contrato pide que la hoja que define el selector la cargue la página de Gráficos, que siempre se monta.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const aqui = dirname(fileURLToPath(import.meta.url));

describe("estilos del selector de variables", () => {
  it("la página de Gráficos carga la hoja que define el selector", () => {
    const pagina = readFileSync(resolve(aqui, "GraficosPage.tsx"), "utf8");
    const hojas = [...pagina.matchAll(/^import\s+"(\.[^"]+\.css)";/gm)].map((m) => resolve(aqui, m[1]));
    const define = hojas.filter((h) => /\.pulso-gv2-variable-popover\b/.test(readFileSync(h, "utf8")));
    expect(define.length).toBeGreaterThan(0);
  });
});
