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

/**
 * **Un botón apagado dice por qué lo está, y en su sitio.**
 *
 * Visto en Materiales el 2026-08-23: los tres botones de render —Ver imagen,
 * Generar PDF, Generar el paquete— salían grises y el motivo vivía arriba a la
 * derecha, en otra banda, como «accesos sin preparar». Quien pulsa mira el
 * botón, no la esquina opuesta.
 *
 * Y el hueco de al lado, que ocupa dos tercios del panel, explicaba **dónde no
 * se guardan** unos archivos que todavía no se pueden generar: información
 * correcta contestando otra pregunta.
 */
describe("el panel de render explica su propio bloqueo", () => {
  it("hay un motivo único que alimenta los tres botones y el vacío", () => {
    // Uno solo: dos textos distintos para el mismo bloqueo vuelven a separarse
    // en cuanto alguien toque uno.
    expect(fuente).toContain("const motivoBloqueo = deployment");
    expect(fuente.match(/title=\{motivoBloqueo/g) ?? []).toHaveLength(3);
  });

  it("el motivo dice la causa, no sólo el hecho", () => {
    // «Sin accesos» es el hecho; que la ficha no tenga enlace que codificar es
    // la causa, y es lo que deja actuar.
    expect(fuente).toContain("no tiene enlace que codificar");
    expect(fuente).toContain("Los accesos se preparan en la seccion Accesos");
  });

  it("con accesos listos, el vacío vuelve a su nota de archivo", () => {
    expect(fuente).toContain("no se guardan dentro del proyecto");
  });
});
