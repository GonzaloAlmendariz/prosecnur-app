import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * G39 · La cascada viva no puede leerse antes de existir.
 *
 * `cascadaViva` es un `const` del cuerpo del componente, así que un hook
 * declarado más arriba que la lea revienta en zona muerta temporal
 * (`Cannot access 'cascadaViva' before initialization`) la primera vez que su
 * callback corre. Pasó de verdad: `celdaEnEdicion` quedó por encima de la
 * declaración y la pestaña se caía entera al ErrorBoundary.
 *
 * No lo atrapa nada de lo que ya corre: TypeScript no razona sobre cuándo se
 * ejecuta el callback de un `useMemo`, y el caso de render del tab no llega al
 * punto —el memo sale por `if (!pendientes.size) return null` mientras no haya
 * un criterio editado sin confirmar, que es una interacción—. Por eso el
 * chequeo es sobre el orden del archivo: barato, y exactamente la condición
 * que se rompió.
 */
const FUENTE = fileURLToPath(
  new URL("../CursosHorarioMarcoTab.tsx", import.meta.url),
);

/** Ignora comentarios de línea y de bloque para no contar la prosa como uso. */
function lineasDeCodigo(): string[] {
  const bruto = readFileSync(FUENTE, "utf8").split("\n");
  let enBloque = false;
  return bruto.map((linea) => {
    const limpia = linea.trim();
    if (enBloque) {
      if (limpia.includes("*/")) enBloque = false;
      return "";
    }
    if (limpia.startsWith("/*")) {
      if (!limpia.includes("*/")) enBloque = true;
      return "";
    }
    if (limpia.startsWith("//") || limpia.startsWith("*")) return "";
    return linea;
  });
}

describe("CursosHorarioMarcoTab · orden de declaración", () => {
  for (const nombre of ["cascadaViva", "previewCascada", "bloqueFoco"]) {
    it(`declara \`${nombre}\` antes de cualquier uso`, () => {
      const lineas = lineasDeCodigo();
      const declaracion = lineas.findIndex((linea) =>
        new RegExp(`^\\s*const\\s+${nombre}\\b`).test(linea),
      );
      expect(declaracion, `no se encontró la declaración de ${nombre}`).toBeGreaterThan(-1);

      const usoPrevio = lineas
        .slice(0, declaracion)
        .findIndex((linea) => new RegExp(`\\b${nombre}\\b`).test(linea));
      expect(
        usoPrevio,
        usoPrevio === -1
          ? ""
          : `${nombre} se usa en la línea ${usoPrevio + 1} y se declara en la ${declaracion + 1}`,
      ).toBe(-1);
    });
  }
});
