import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * La marca de readiness la publica la PÁGINA, nunca un panel del chrome.
 *
 * `estadoListo()` resuelve con `querySelector("[data-audit-ready]")`, o sea con
 * la primera marca del documento. Una segunda marca puesta por un panel que se
 * monta durante la carga responde «listo» por una vista que no es suya, y ahí
 * se cae la única defensa que tiene el QA visual contra capturar la pantalla de
 * carga.
 *
 * Pasó de verdad: `CalidadDeCampo` —que los CUATRO perfiles montan en las
 * secciones «avance» y «calidad»— publicaba `data-audit-ready` fija. Los tres
 * perfiles que apagan su marca con `undefined` seguían dando la vista por lista
 * mientras cargaban, porque la única marca que quedaba en el DOM era la del
 * panel. Nadie consumía esa marca por nombre: lo único que hacía era mentir.
 */

const dir = __dirname;

/**
 * El fuente sin comentarios.
 *
 * Sin esto el guard se caza a sí mismo: el comentario que explica POR QUÉ un
 * panel no debe publicar la marca nombra el atributo, y una búsqueda literal lo
 * cuenta como una emisión. Lo que se prohíbe es emitirla, no nombrarla.
 */
function codigo(ruta: string) {
  return readFileSync(ruta, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("readiness de Monitoreo", () => {
  it("ningún componente compartido del chrome publica data-audit-ready", () => {
    const culpables = readdirSync(dir)
      .filter((f) => f.endsWith(".tsx"))
      .filter((f) => codigo(path.join(dir, f)).includes("data-audit-ready="));
    expect(culpables).toEqual([]);
  });

  it("los cuatro perfiles apagan su marca mientras cargan", () => {
    // El control de este guard: si un perfil vuelve a emitirla fija, la
    // expresión condicional desaparece y esto cae. Cada uno usa su propia
    // bandera —`loading`, `activeLoading`, `auditReady`—, así que se comprueba
    // la forma condicional y no un nombre concreto.
    const perfiles = {
      aulas: "aulas/AulasMonitoreoPage.tsx",
      territorial: "territorial/TerritorialMonitoreoPage.tsx",
      telefonico: "telefonico/TelefonicoMonitoreoPage.tsx",
      acreditacion: "acreditacion/AcreditacionMonitoreoPage.tsx",
    };
    for (const [nombre, rel] of Object.entries(perfiles)) {
      const src = codigo(path.join(dir, "..", "profiles", rel));
      const marcas = src.match(/data-audit-ready=[^\s>]*/g) ?? [];
      expect(marcas.length, `${nombre} declara ${marcas.length} marcas`).toBe(1);
      expect(marcas[0], `${nombre} emite la marca fija`).toContain("={");
    }
  });
});
