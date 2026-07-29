import fs from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

/**
 * Contrato: un solo deck de avisos efímeros en toda la app.
 *
 * Antes del ADR 0047 no había toaster compartido, así que el mapa de lógica del
 * editor XLSForm se hizo el suyo: `useState` propio, temporizador propio y su
 * `aria-live` propio dentro de un componente de 2610 líneas. Cualquier
 * superficie que quisiera confirmar una acción tenía que copiar ese patrón.
 *
 * Este test no migra el deck heredado —tocar `LogicCanvas.tsx` es una unidad de
 * trabajo con su propio riesgo y sin red de tests, porque vitest corre sin DOM—
 * pero congela la lista para que no aparezca un tercero. La whitelist SOLO
 * puede encoger: al migrar el deck heredado se borra su línea.
 */

const AQUI = fileURLToPath(new URL(".", import.meta.url));
const SRC = join(AQUI, "..");

/** El host canónico y el deck heredado que todavía no se migró. */
const DECKS_PERMITIDOS = [
  "components/Toaster.tsx",
  "features/xlsformEditor/canvas-graph/LogicCanvas.tsx",
] as const;

function sinComentarios(codigo: string): string {
  return codigo
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function archivosFuente(dir: string = SRC): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = join(dir, entrada.name);
    if (entrada.isDirectory()) {
      if (entrada.name === "node_modules" || entrada.name === "__tests__") return [];
      return archivosFuente(ruta);
    }
    if (!/\.tsx?$/.test(entrada.name)) return [];
    if (/\.(?:test|spec)\.tsx?$/.test(entrada.name)) return [];
    return [relative(SRC, ruta).split(sep).join("/")];
  });
}

describe("deck de avisos efímeros", () => {
  test("nadie nuevo monta su propio aria-live de toasts", () => {
    const infractores: string[] = [];

    for (const rel of archivosFuente()) {
      if ((DECKS_PERMITIDOS as readonly string[]).includes(rel)) continue;
      const codigo = sinComentarios(fs.readFileSync(join(SRC, rel), "utf8"));

      // La firma de un deck: una región viva que RENDERIZA UNA COLECCIÓN de
      // toasts. El plural importa — un archivo que emite `toast.exito(...)` y
      // además tiene su propia región viva para otra cosa (por ejemplo el
      // lienzo, que anuncia el nodo enfocado) no es un deck, y acusarlo
      // obligaría a elegir entre avisar y ser accesible.
      const tieneRegionViva = /aria-live=/.test(codigo);
      const renderizaColeccion = /\btoasts\b/.test(codigo);
      if (tieneRegionViva && renderizaColeccion) infractores.push(rel);
    }

    expect(
      infractores,
      "Decks de toasts fuera de components/Toaster.tsx. Usa `toast` de components/toasterStore.",
    ).toEqual([]);
  });

  test("el host canónico declara las dos regiones vivas", () => {
    const codigo = fs.readFileSync(join(SRC, "components/Toaster.tsx"), "utf8");
    // `polite` para lo normal; `assertive` para errores, que sí interrumpen.
    expect(codigo).toContain('aria-live="polite"');
    expect(codigo).toContain('aria-live="assertive"');
  });

  test("el CSS del toaster no vive en theme.css, que está congelado", () => {
    // `theme.css` tiene línea base en agentic/manifest.json y el audit se pone
    // rojo si crece. El deck trae su propia hoja.
    expect(fs.existsSync(join(SRC, "components/toaster.css"))).toBe(true);
    const theme = fs.readFileSync(join(SRC, "app/theme.css"), "utf8");
    expect(theme).not.toContain(".pulso-toaster");
  });

  test("el store no persiste: un toast que sobrevive un reload es un bug", () => {
    const codigo = fs.readFileSync(join(SRC, "components/toasterStore.ts"), "utf8");
    expect(codigo).not.toContain("zustand/middleware");
    expect(codigo).not.toContain("persist(");
  });
});
