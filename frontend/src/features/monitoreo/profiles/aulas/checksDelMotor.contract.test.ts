import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { aulasCheckLabel } from "./aulasPresentation";

/**
 * Toda regla que el motor emite tiene su rótulo en la capa de presentación.
 *
 * Sin este guard, una clave nueva de R sale a pantalla **prettificada** por el
 * fallback —`student_id_required` se leía «Student id required»— y eso parece
 * un rótulo correcto: no hay hueco, no hay error, no falla nada. Ya pasó dos
 * veces en este perfil, y la segunda tardé en verla porque el fallback disfraza
 * la clave vieja de traducción nueva.
 *
 * Lee la lista LITERAL del motor en vez de duplicarla aquí: una copia en el test
 * envejecería igual que el mapa que vigila, y el guard quedaría verde mientras
 * la pantalla enseña jerga.
 */

const RUTA_MOTOR = path.join(__dirname, "../../../../../../api/R/monitoreo_aulas_universitarias.R");

/** Las claves del vector `check = c(...)` de `monitoreo_aulas_dashboard()`. */
function checksDelMotor(): string[] {
  const fuente = readFileSync(RUTA_MOTOR, "utf8");
  const linea = fuente.split("\n").find((l) => l.trim().startsWith("check = c("));
  if (!linea) throw new Error("No se encontró el vector `check = c(...)` en el motor");
  return [...linea.matchAll(/"([a-z0-9_]+)"/g)].map((m) => m[1]);
}

describe("los controles del motor llegan traducidos", () => {
  it("el motor sigue declarando sus reglas en un vector legible", () => {
    // Si el motor deja de escribirlas en una línea, este guard dejaría de
    // vigilar nada y hay que enterarse por aquí, no por la pantalla.
    const checks = checksDelMotor();
    expect(checks.length).toBeGreaterThanOrEqual(10);
    expect(checks).toContain("anonymous_responses");
  });

  it("ninguna clave sale a pantalla como jerga prettificada", () => {
    const sinRotulo = checksDelMotor().filter((check) => {
      const rotulo = aulasCheckLabel(check);
      // El fallback convierte `foo_bar` en «Foo bar»: misma cadena salvo por el
      // guion bajo y la mayúscula inicial. Un rótulo de verdad no se parece a
      // su clave.
      const prettificada = check.replace(/_/g, " ");
      return rotulo.toLowerCase() === prettificada.toLowerCase();
    });
    expect(sinRotulo).toEqual([]);
  });
});
