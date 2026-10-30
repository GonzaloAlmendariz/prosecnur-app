import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { scopeDeAterrizaje, scopeParaSeccion } from "./scopeDeAterrizaje";

describe("scopeDeAterrizaje", () => {
  test.each([
    ["", "advance_summary"],
    ["?modo=acreditacion&seccion=avance&pestana=publicos", "advance_summary"],
    ["?seccion=insumos&pestana=publicos", "source"],
    ["?seccion=modelo&pestana=metas", "advance_summary"],
    ["?seccion=control&pestana=resolver", "queries_summary"],
    ["?seccion=control&pestana=barrido", "phone_summary"],
    ["?seccion=control&pestana=correo", "advance_summary"],
  ])("%s → %s", (search, scope) => {
    expect(scopeDeAterrizaje(search, "acreditacion")).toBe(scope);
  });

  test("telefónico lee el modelo desde phone_summary", () => {
    expect(scopeParaSeccion("modelo", "telefonico")).toBe("phone_summary");
  });

  // Gemelo de `scopeForView` del page-file: si uno cambia sin el otro, el warm
  // start calienta un corte y la página pide otro.
  test("dice lo mismo que scopeForView de la página", () => {
    const cuerpo = (fuente: string, nombre: string) => {
      const inicio = fuente.indexOf(`function ${nombre}(`);
      expect(inicio, `no se encontró ${nombre}`).toBeGreaterThanOrEqual(0);
      const abre = fuente.indexOf("{", fuente.indexOf(")", inicio));
      const cierra = fuente.indexOf("\n}", abre);
      return fuente.slice(abre, cierra)
        .replace(/requestedSection|seccion/g, "S")
        .replace(/profileFamily|familia/g, "F")
        .replace(/\s+/g, " ");
    };
    const pagina = readFileSync(fileURLToPath(new URL("../AcreditacionMonitoreoPage.tsx", import.meta.url)), "utf8");
    const modulo = readFileSync(fileURLToPath(new URL("./scopeDeAterrizaje.ts", import.meta.url)), "utf8");
    expect(cuerpo(modulo, "scopeParaSeccion")).toBe(cuerpo(pagina, "scopeForView"));
  });
});
