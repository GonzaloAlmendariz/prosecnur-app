import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

/**
 * Este test cuidaba dos cosas sobre el marcado inline del rail de Bitácora: que
 * las secciones salieran del manifiesto y no de una lista paralela, y que la
 * navegación fuera por enlaces con `aria-current`, nunca un tablist —sus tres
 * destinos son direcciones, no pestañas, y anunciarlos como tabs es mentirle al
 * lector de pantalla—.
 *
 * La banda pasó a `ModuleCommandBar` y el rail a `SectionPillbar`, así que ese
 * marcado ya no vive acá. Las dos garantías siguen siendo exactamente las mismas;
 * lo que cambia es dónde se comprueba cada una: el origen de las secciones sigue
 * siendo de esta página, y la semántica de enlaces es ahora responsabilidad del
 * componente compartido, así que se verifica sobre su fuente. Si alguien le
 * pusiera `role="tab"` a `SectionPillbar`, los seis módulos que lo usan se
 * romperían a la vez y este test lo ve.
 */
describe("navegación primaria de Bitácora", () => {
  test("deriva sus secciones del manifiesto y las pasa al pillbar compartido", () => {
    const source = fs.readFileSync(
      path.join(__dirname, "BitacoraPage.tsx"),
      "utf8",
    );

    expect(source).toMatch(
      /BITACORA_SECTIONS\s*=\s*BITACORA_MODULE\.sections\.filter/,
    );

    const pillbar = source.slice(
      source.indexOf("<SectionPillbar"),
      source.indexOf("/>", source.indexOf("<SectionPillbar")),
    );
    expect(pillbar).not.toBe("");
    // Los items salen del manifiesto, con la dirección canónica de cada sección.
    expect(pillbar).toMatch(/items=\{BITACORA_SECTIONS\.map/);
    expect(pillbar).toMatch(/href:\s*item\.to/);
    expect(pillbar).toMatch(/seccionActiva=\{tab\}/);

    // Y la página ya no arma el rail a mano.
    expect(source).not.toContain("<GlidingTabList");
  });

  test("el pillbar compartido navega con enlaces y aria-current, no con tabs", () => {
    // Sin comentarios: el encabezado del componente EXPLICA por qué no usa
    // `role="tab"`, y buscarlo en el texto crudo daría un falso positivo sobre
    // la propia justificación de la regla.
    const pillbarSource = fs
      .readFileSync(
        path.join(__dirname, "..", "..", "components", "SectionPillbar.tsx"),
        "utf8",
      )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");

    expect(pillbarSource).toMatch(/mode="nav"/);
    expect(pillbarSource).toMatch(/aria-current/);
    expect(pillbarSource).not.toMatch(/role="tablist"/);
    expect(pillbarSource).not.toMatch(/role="tab"/);
    expect(pillbarSource).not.toMatch(/aria-selected=/);
  });
});
