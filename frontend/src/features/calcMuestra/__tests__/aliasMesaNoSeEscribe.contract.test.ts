import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { AULAS_SAMPLE_ROUTE } from "../../aulasFlow/AulasApplicationFlow";
import { modoPedidoDesdeDireccion } from "../CalcMuestraPage";
import { modoCrudoDeLaDireccion } from "../navegacion";

/**
 * ADR 0044 · Los alias históricos de la dirección se LEEN, nunca se ESCRIBEN.
 *
 * `?mesa=aulas` fue el deep-link del módulo universitario antes de la gramática
 * canónica (`?modo=opinion-universitaria`). La lectura del alias sobrevive
 * —`ALIAS_MODO` en `navegacion.ts` y los alias de `modoPedidoDesdeDireccion`—
 * para no romper enlaces guardados, pero ningún archivo de producción puede
 * volver a serializarlo: cada escritor nuevo del alias alarga su vida y
 * multiplica las direcciones que nombran la misma pantalla.
 *
 * Este guard existe porque la regla ya se rompió después de escrita:
 * `AULAS_SAMPLE_ROUTE` y el redirect de `/muestra-aulas` siguieron emitiendo
 * `?mesa=aulas` un año después del ADR. Una regla sin guard es una regla que se
 * va a romper otra vez (patrón de `adr0057Reglas.contract.test.ts`).
 */

const SRC_ROOT = fileURLToPath(new URL("../../../", import.meta.url));

/**
 * Fuente sin comentarios, como el guard del ADR 0057: la documentación que
 * explica el alias («`?mesa=` se lee, no se escribe») no puede disparar el
 * guard que la hace cumplir.
 */
const sinComentarios = (fuente: string) =>
  fuente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const esFuenteDeProduccion = (rel: string) =>
  /\.(ts|tsx)$/.test(rel) &&
  !rel.includes("__tests__") &&
  !/\.test\.(ts|tsx)$/.test(rel) &&
  !rel.endsWith(".d.ts");

describe("ADR 0044 · el alias ?mesa= no se escribe", () => {
  it("ningún archivo de producción serializa un literal de URL con mesa=", () => {
    const archivos = readdirSync(SRC_ROOT, { recursive: true, withFileTypes: true })
      .filter((entrada) => entrada.isFile())
      .map((entrada) => join(entrada.parentPath, entrada.name))
      .filter((abs) => esFuenteDeProduccion(abs.slice(SRC_ROOT.length)));
    expect(archivos.length).toBeGreaterThan(100);

    // Sólo caza ESCRITURA: un literal `?mesa=`/`&mesa=` dentro de una URL. Los
    // sitios de LECTURA del alias no forman ese literal —consultan
    // `params.get("mesa")`— y por eso no necesitan lista de excepciones.
    const escritores = archivos.filter((abs) =>
      /[?&]mesa=/.test(sinComentarios(readFileSync(abs, "utf8"))),
    );
    expect(
      escritores.map((abs) => abs.slice(SRC_ROOT.length)),
      "estos archivos escriben el alias legacy ?mesa= (ADR 0044: los alias se leen, nunca se escriben)",
    ).toEqual([]);
  });

  it("AULAS_SAMPLE_ROUTE apunta al modo canónico, no al alias", () => {
    expect(AULAS_SAMPLE_ROUTE).toContain("modo=opinion-universitaria");
    expect(AULAS_SAMPLE_ROUTE).not.toMatch(/[?&]mesa=/);
  });

  it("la dirección canónica aterriza en la misma mesa que el alias histórico", () => {
    // La cadena real de lectura del módulo: `modoCrudoDeLaDireccion` saca el
    // modo pedido (canónico o alias) y `modoPedidoDesdeDireccion` lo traduce a
    // la mesa. Cambiar el escritor sólo es seguro si ambos caminos terminan en
    // el mismo desk.
    const search = AULAS_SAMPLE_ROUTE.slice(AULAS_SAMPLE_ROUTE.indexOf("?"));
    const deskCanonico = modoPedidoDesdeDireccion(modoCrudoDeLaDireccion(search));
    const deskLegacy = modoPedidoDesdeDireccion(modoCrudoDeLaDireccion("?mesa=aulas"));
    expect(deskCanonico).toBe("opinion_universitaria");
    expect(deskLegacy).toBe("opinion_universitaria");
    expect(deskCanonico).toBe(deskLegacy);
  });
});
