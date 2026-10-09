import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

/**
 * **Un aviso tapado es un aviso que no existe.**
 *
 * Los dos avisos del visor del mapa —«Cargando cartografia» y «Completando
 * cartografia local»— se anclaban en `top:10px; right:10px`, la MISMA esquina
 * que `.mon-territorial-map-tools`, que además lleva `z-index: 4`. La barra de
 * zoom se les montaba encima y sólo asomaban las dos primeras letras: el usuario
 * veía un mapa incompleto y la explicación de por qué estaba debajo del control.
 *
 * `ui-quick-check` lo dio por bueno —`solapes=0`— y se encontró mirando la
 * captura. Por eso el guard mira el CSS: **caber no es no pisarse**, y un
 * detector que no lo vio no puede ser el único que lo vigile.
 */

const dir = path.dirname(fileURLToPath(import.meta.url));
const css = readFileSync(path.join(dir, "territorialProfile.css"), "utf8");

/** El par (top, right) con el que una regla se ancla, si se ancla por ahí. */
function anclaje(selector: string): { top?: string; right?: string } {
  const bloque = css.match(new RegExp(`^\\.${selector}\\s*\\{([^}]*)\\}`, "m"));
  expect(bloque, `no encontré la regla .${selector}: ¿la renombraron?`).not.toBeNull();
  const cuerpo = bloque![1];
  return {
    top: cuerpo.match(/(?:^|;)\s*top:\s*([^;]+);/)?.[1]?.trim(),
    right: cuerpo.match(/(?:^|;)\s*right:\s*([^;]+);/)?.[1]?.trim(),
  };
}

const CONTROLES = "mon-territorial-map-tools";
const AVISOS = ["mon-territorial-route-map-status", "mon-territorial-route-map-loading"];

describe("los avisos del mapa no comparten esquina con los controles", () => {
  const tools = anclaje(CONTROLES);

  test("los controles siguen anclados arriba a la derecha, que es lo que da sentido al guard", () => {
    // Si alguien los mueve, este contrato deja de proteger nada y hay que
    // enterarse aquí, no mirando otra captura dentro de seis meses.
    expect(tools.top).toBeDefined();
    expect(tools.right).toBeDefined();
  });

  test.each(AVISOS)("%s no se ancla donde los controles", (selector) => {
    const aviso = anclaje(selector);
    const mismaEsquina = aviso.top === tools.top && aviso.right === tools.right;
    expect(
      mismaEsquina,
      `.${selector} comparte (top:${aviso.top}, right:${aviso.right}) con .${CONTROLES}, ` +
        "que lleva z-index y lo tapa. Un aviso que no se lee no avisa: bájalo (top: 58px) " +
        "o llévalo a otra esquina.",
    ).toBe(false);
  });

  test("y quedan por debajo de la barra, no por encima de su sitio", () => {
    // 10px de top + 4+30+4 de la barra + bordes ≈ 50: menos de eso vuelve a pisar.
    for (const selector of AVISOS) {
      const top = Number.parseInt(anclaje(selector).top ?? "", 10);
      expect(top, `.${selector} debe despejar la barra de zoom`).toBeGreaterThanOrEqual(52);
    }
  });
});
