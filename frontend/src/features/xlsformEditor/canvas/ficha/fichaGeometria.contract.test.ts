import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

// Contrato geométrico de la ficha del Constructor (C1/C2). Reemplaza al del resumen de la pregunta, que desapareció
// con el rediseño: su grilla de cuatro tarjetas daba equal-frame-drift (xfr-props) porque cada tarjeta tenía un
// contenido de alto distinto. En la ficha sólo las tarjetas de apariencia son un grupo de filas iguales; reglas,
// opciones y usos son listas de alto propio (intrinsic) y el scroll es del cuerpo de la ficha.
const dir = path.dirname(fileURLToPath(import.meta.url));
const leer = (f: string) => fs.readFileSync(path.join(dir, f), "utf8");
const css = leer("ficha.css").replace(/\/\*[\s\S]*?\*\//g, "");

function regla(selector: string): string | undefined {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return css.match(new RegExp(`(?:^|\\})\\s*${esc}\\s*\\{([^{}]*)\\}`))?.[1];
}

describe("contrato geométrico de la ficha", () => {
  test("las apariencias se declaran como filas iguales y su CSS lo cumple", () => {
    const tsx = leer("AparienciaFicha.tsx");
    expect(tsx).toContain('data-qa-geometry-group="xlsform/ficha-apariencias"');
    expect(tsx).toContain('data-qa-geometry-contract="equal"');
    expect(regla(".xfh-apariencias")).toMatch(/grid-auto-rows:\s*1fr/);
  });

  test.each([
    ["ReglasFicha.tsx", "xlsform/ficha-reglas"],
    ["RespuestaFicha.tsx", "xlsform/ficha-opciones"],
    ["FichaCalculo.tsx", "xlsform/ficha-usos"],
  ])("%s declara su lista como intrinsic", (archivo, grupo) => {
    const tsx = leer(archivo);
    expect(tsx).toContain(`data-qa-geometry-group="${grupo}"`);
    expect(tsx).toMatch(new RegExp(`data-qa-geometry-group="${grupo}"[^>]*data-qa-geometry-contract="intrinsic"`));
  });

  test("el cuerpo de la ficha es el único dueño del scroll", () => {
    expect(regla(".xfh-cuerpo")).toMatch(/overflow-y:\s*auto/);
    for (const sel of [".xfh-reglas", ".xfh-opciones", ".xfh-lista", ".xfh-bloque"]) {
      expect(regla(sel) ?? "", sel).not.toMatch(/overflow-y:\s*(auto|scroll)/);
    }
  });

  test("los textos crecen con su contenido y sin asa", () => {
    const r = regla(".xfh-texto") ?? "";
    expect(r).toMatch(/field-sizing:\s*content/);
    expect(r).toMatch(/resize:\s*none/);
  });
});
