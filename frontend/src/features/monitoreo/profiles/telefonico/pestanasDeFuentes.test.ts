import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  ACREDITACION_SOURCE_TABS,
  PESTANA_DE_FUENTES_POR_DEFECTO_TELEFONICO,
  pestanaDeFuentesInicial,
} from "./pestanasDeFuentes";

describe("dónde aterriza Fuentes", () => {
  it("telefónico abre en el resumen", () => {
    expect(PESTANA_DE_FUENTES_POR_DEFECTO_TELEFONICO).toBe("activas");
    expect(pestanaDeFuentesInicial(true)).toBe("activas");
  });

  it("el aterrizaje es una pestaña que existe en el catálogo", () => {
    const claves = ACREDITACION_SOURCE_TABS.map((tab) => tab.key);
    expect(claves).toContain(pestanaDeFuentesInicial(true));
    expect(claves).toContain(pestanaDeFuentesInicial(false));
  });

  // El page-file declaraba el aterrizaje dos veces —el `useState` en «activas»
  // y el despachador de secciones en `?? "survey"`— y sólo coincidían por que
  // la página siempre pasa su valor. Con dos declaraciones, la que gana depende
  // de quién llame, y la que pierde es la que tiene el comentario explicando
  // por qué.
  it("el perfil no declara un segundo aterrizaje por su cuenta", () => {
    const pagina = readFileSync(resolve(__dirname, "TelefonicoMonitoreoPage.tsx"), "utf8");
    expect(pagina).not.toContain('options.activeSourceTab ?? "survey"');
    expect(pagina).not.toContain('isPhone ? "activas" : "survey"');
    expect(pagina).toContain("pestanaDeFuentesInicial(");
  });
});
