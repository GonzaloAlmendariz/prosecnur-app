import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

/**
 * **El parte de campo no trae facultad: se la pone `parteDeCampo`.**
 *
 * La hoja «Aulas Aplicadas (Campo)» del libro del operativo no tiene columna de
 * facultad —el parte se conserva tal como llega del lector— y `parteDeCampo()`
 * se la acompaña cruzando por el código del curso-horario, que es la clave que
 * las dos comparten.
 *
 * Consecuencia: **`deLaFacultad(partes_campo, …)` devuelve SIEMPRE cero filas**.
 * No falla, no avisa: el panel que reciba eso publica su vacío. Pasó el
 * 2026-09-10 al poner el selector de facultad en toda la sección Avance —«Hacia
 * dónde va la efectividad» decía «todavía no hay partes de campo con fecha» con
 * el campo andando y 62 cursos-horario aplicados— y no lo vio ninguna de las
 * 3 190 pruebas del perfil: el fixture de ese panel no pasa por la pestaña.
 *
 * Se mira el fuente porque el defecto es de CABLEADO y está o no está; verlo de
 * otra forma exige montar la pestaña con un payload realista y con foco puesto,
 * que es justo lo que no había.
 */
const aulasDir = path.resolve(__dirname);

/** El trozo de expresión que sigue a una llamada, con paréntesis equilibrados. */
function llamada(fuente: string, desde: number): string {
  let nivel = 0;
  for (let i = desde; i < fuente.length; i += 1) {
    if (fuente[i] === "(") nivel += 1;
    else if (fuente[i] === ")") {
      nivel -= 1;
      if (nivel === 0) return fuente.slice(desde, i + 1);
    }
  }
  return fuente.slice(desde);
}

describe("el parte de campo se cruza con el plan antes de filtrarlo por facultad", () => {
  const fuentes = readdirSync(aulasDir).filter(
    (f) => f.endsWith(".tsx") && !f.includes(".test."),
  );

  test("hay componentes que revisar", () => {
    expect(fuentes.length).toBeGreaterThanOrEqual(20);
  });

  test("ninguno pasa `partes_campo` crudo a `deLaFacultad`", () => {
    const culpables: string[] = [];
    for (const archivo of fuentes) {
      const fuente = readFileSync(path.join(aulasDir, archivo), "utf8");
      let desde = fuente.indexOf("deLaFacultad(");
      while (desde >= 0) {
        const trozo = llamada(fuente, desde + "deLaFacultad".length);
        if (trozo.includes("partes_campo") && !trozo.includes("parteDeCampo(")) {
          culpables.push(`${archivo}: ${trozo.replace(/\s+/g, " ").slice(0, 90)}…`);
        }
        desde = fuente.indexOf("deLaFacultad(", desde + 1);
      }
    }
    expect(culpables, culpables.length
      ? "El parte no trae `faculty`: filtrarlo por facultad da cero filas y el panel "
        + "publica su vacío sin avisar. Crúzalo antes con `parteDeCampo(partes, agenda).filas`.\n  "
        + culpables.join("\n  ")
      : "").toEqual([]);
  });
});
