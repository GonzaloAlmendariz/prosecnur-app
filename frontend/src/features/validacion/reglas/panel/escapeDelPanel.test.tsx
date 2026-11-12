/**
 * Esc con un desplegable abierto dentro del panel de regla (segunda revisión
 * del panel, punto 1).
 *
 * Causa medida: el `Sideover` del kit (Radix Dialog) y el `PulsoSelect` (Radix
 * Select) cargan copias DISTINTAS de `@radix-ui/react-dismissable-layer` y de
 * `@radix-ui/react-focus-scope`. Cada copia lleva su propia pila de capas y de
 * trampas de foco:
 *   - las dos capas se creen "la de arriba" y las dos atienden Esc; la del
 *     panel corre primero, marca el evento como atendido y el desplegable ya no
 *     se cierra;
 *   - las dos trampas de foco se devuelven el foco entre sí: en happy-dom,
 *     abrir un `PulsoSelect` dentro de un `Sideover` sin nada de este panel da
 *     `RangeError: Maximum call stack size exceeded` (el mismo error que vio el
 *     QA dentro de la app).
 *
 * El arreglo es del kit y de las dependencias (una sola versión de las dos
 * piezas en `frontend/package.json`, `pnpm.overrides`). Mientras tanto esta
 * prueba documenta el estado con `it.fails`: el día que las versiones
 * coincidan, la prueba "falla al pasar" y hay que convertirla en la prueba
 * normal y agregar la del Esc en happy-dom.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const FRONT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");
const PNPM = path.join(FRONT, "node_modules/.pnpm");

function versionDe(paquete: "react-dialog" | "react-select", interno: string): string | null {
  if (!fs.existsSync(PNPM)) return null;
  const dir = fs.readdirSync(PNPM).find((d) => d.startsWith(`@radix-ui+${paquete}@`));
  if (!dir) return null;
  const enlace = path.join(PNPM, dir, "node_modules/@radix-ui", interno);
  if (!fs.existsSync(enlace)) return null;
  const pkg = JSON.parse(fs.readFileSync(path.join(fs.realpathSync(enlace), "package.json"), "utf8")) as { version?: string };
  return pkg.version ?? null;
}

describe("Esc y foco en un desplegable dentro del panel de regla", () => {
  it.fails("el panel (Radix Dialog) y el desplegable (Radix Select) comparten la pila de capas y la de foco", () => {
    for (const interno of ["react-dismissable-layer", "react-focus-scope"]) {
      const delPanel = versionDe("react-dialog", interno);
      const delDesplegable = versionDe("react-select", interno);
      expect(delPanel, `${interno} del panel`).not.toBeNull();
      expect(delDesplegable, `${interno} del desplegable`).toBe(delPanel);
    }
  });
});
