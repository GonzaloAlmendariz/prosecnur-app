// Ronda 5 de la QA del lienzo: lo que sólo vive en CSS se fija aquí para que no vuelva.
// R5-5: en el marco ancho el panel de avisos reserva su columna (no tapa la hoja). R5-8: «Actualizando» abajo a la
// izquierda (arriba a la derecha tapaba el logo). R5-10: soltada la lámina, el número se ve dentro del foco del asa.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const leer = (archivo: string) => fs.readFileSync(path.join(aqui, archivo), "utf8");
/** El cuerpo de la primera regla cuyo selector contiene `selector` (dentro o fuera de un @container). */
const regla = (css: string, selector: string): string => {
  const i = css.indexOf(selector);
  if (i < 0) return "";
  const a = css.indexOf("{", i);
  return css.slice(a + 1, css.indexOf("}", a));
};

describe("ronda 5: geometría en CSS", () => {
  it("R5-5: con el contenedor ancho, el panel de avisos es una cuarta columna del workbench", () => {
    const css = leer("panelAvisos.css");
    const bloque = css.slice(css.indexOf("@container pulso-f6-laminas (min-width: 1121px)"));
    expect(bloque.length).toBeGreaterThan(0);
    expect(regla(bloque, ".pulso-f6-laminas:has(> .pulso-f6-avisos-panel)")).toMatch(/grid-template-columns:[^;]*var\(--pulso-avisos-ancho\)/);
    const panel = regla(bloque, ".pulso-f6-laminas > .pulso-f6-avisos-panel");
    expect(panel).toMatch(/position:\s*relative/);
    expect(panel).toMatch(/grid-column:\s*4/);
    // El umbral es el mismo del inspector: por debajo de 1121 px sigue siendo sideover.
    expect(leer("laminasWorkbench.css")).toContain("@container pulso-f6-laminas (max-width: 1120px)");
  });

  it("R7-2: el chip «Actualizando» vive en la barra del visor, no sobre la hoja", () => {
    const css = leer("visorLamina.css");
    expect(css).not.toContain(".pulso-f6-hoja-actualizando");
    expect(regla(css, ".pulso-f6-barra-actualizando {")).not.toMatch(/position:\s*absolute/);
    const tsx = leer("VisorLamina.tsx");
    const barra = tsx.slice(tsx.indexOf('<header className="pulso-f6-visor-barra">'), tsx.indexOf("</header>"));
    expect(barra).toContain("pulso-f6-barra-actualizando");
  });

  it("R5-10: con el foco en el asa y sin puntero ni arrastre, el número se ve (el glifo se apaga)", () => {
    const css = leer("ordenLaminas.css");
    expect(css).toContain(".pulso-f6-fila-ordenable:not(:hover):not(.is-arrastrando) > .pulso-f6-asa-lamina.is-estructura:focus > svg");
    // El número ya no se esconde por tener el foco dentro de la fila (el asa lo retiene al soltar).
    expect(css).not.toContain(".pulso-f6-fila-ordenable:focus-within .pulso-f6-lamina-pos");
  });
});
