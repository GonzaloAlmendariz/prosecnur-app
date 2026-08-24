import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const fuente = fs.readFileSync(path.join(aqui, "MaterialsSection.tsx"), "utf8");

/**
 * **Lo que la pantalla promete y lo que el botón hace salen del mismo sitio.**
 *
 * Medido en pantalla el 2026-08-23 sobre el estudio de 193: Materiales decía
 * «Fichas 0 de **193**» y `createInstances`, en el botón de al lado, mandaba
 * `plan.units.map(...)` entero — **2.616**. Dos conjuntos distintos a tres
 * centímetros, y el que se anuncia no es el que se crea.
 *
 * **Esto es un guardián de fuente, y conviene decir por qué.** Lo suyo sería
 * renderizar la sección y leer el contador, pero `MaterialsSection` arranca en
 * `loading` y pinta después de un `useEffect` que hace fetch: con
 * `renderToStaticMarkup` —lo único que este repo usa, no hay
 * @testing-library/react— nunca llega a dibujar la cifra. Por eso el componente
 * no tenía test y el mutante sobrevivía.
 *
 * Así que se vigila la relación que la regresión necesita: que el denominador
 * cuente TODAS las unidades, igual que `unit_refs`. Mata el mutante de volver a
 * `titularesDelPlan`; no comprueba el número pintado, que se verificó a mano.
 */
describe("el denominador de fichas y las unidades que se crean", () => {
  it("el contador cuenta todas las unidades del plan", () => {
    expect(fuente).toContain("unidadesDelPlan(payload?.state.plan)");
    // Y NO las titulares, que es de donde venía la promesa de 193.
    expect(fuente).not.toMatch(/const aulasDelPlan = titularesDelPlan\(/);
  });

  it("y la acción sigue mandando todas, que es lo que el contador anuncia", () => {
    expect(fuente).toContain("plan?.units.map((unit) => unit.unit_id)");
  });

  it("el total va acompañado de su composición por rol", () => {
    // «2.616» a secas se lee como si se fueran a visitar 2.616 aulas.
    expect(fuente).toContain("composicionDelPlan");
    expect(fuente).toContain("titulares");
    expect(fuente).toContain("reemplazos");
    expect(fuente).toContain("adicionales");
  });
});
