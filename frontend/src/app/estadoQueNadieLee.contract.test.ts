import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

/**
 * **Un estado que se escribe y ningún JSX lee no falla: simplemente no se ve.**
 *
 * Medido el 2026-09-11 en el perfil de cursos-horario: `marcar()` guardaba el
 * mensaje que devolvía el motor en `avisoDeMarca` y **ninguna línea del JSX lo
 * pintaba**. Quien pulsaba «Marcar» veía cerrarse el popover y nada más — ni la
 * confirmación, ni el motivo cuando el motor rechazaba la marca. Costó una
 * jornada entera de diagnóstico a ciegas.
 *
 * TypeScript no lo ve, y con razón: el setter SÍ se usa y la variable aparece
 * en su propia declaración, así que no hay nada «sin usar» que señalar. El
 * lint tampoco. Sólo se nota mirando la pantalla y echando de menos algo que
 * nadie prometió.
 *
 * El guard es barato porque la firma es exacta: `const [x, setX] = useState`
 * donde `setX` se llama y `x` no aparece en ningún otro sitio del archivo.
 */

const SRC = path.resolve(__dirname, "..");

function fuentes(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entrada) => {
    const completo = path.join(dir, entrada.name);
    if (entrada.isDirectory()) return fuentes(completo);
    if (!entrada.name.endsWith(".tsx")) return [];
    // Un test puede declarar estado de atrezo sin pintarlo: no es la avería.
    if (entrada.name.includes(".test.")) return [];
    return [completo];
  });
}

describe("estado de React que se escribe y nadie lee", () => {
  test("ningún useState queda escribiéndose sin que nadie lo pinte", () => {
    const culpables: string[] = [];
    for (const archivo of fuentes(SRC)) {
      const fuente = readFileSync(archivo, "utf8");
      for (const [, variable, setter] of fuente.matchAll(
        /const \[(\w+), (set\w+)\] = useState/g,
      )) {
        const usos = fuente.match(new RegExp(`\\b${variable}\\b`, "g"))?.length ?? 0;
        const escrituras = fuente.match(new RegExp(`\\b${setter}\\b`, "g"))?.length ?? 0;
        // `usos` incluye la propia declaración, `escrituras` también.
        if (usos - 1 === 0 && escrituras - 1 > 0) {
          culpables.push(`${path.relative(SRC, archivo)}: ${variable} (lo escribe ${setter}, no lo lee nadie)`);
        }
      }
    }
    expect(culpables).toEqual([]);
  });

  test("el barrido encuentra estados de verdad, o no está guardando nada", () => {
    // Un guard que deja de encontrar su objeto se queda en verde para siempre.
    // Con ~1 750 `useState` en el frontend, cero significa que el regex murió.
    const total = fuentes(SRC).reduce(
      (n, f) => n + (readFileSync(f, "utf8").match(/= useState/g)?.length ?? 0),
      0,
    );
    expect(total).toBeGreaterThan(500);
  });
});
