import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

/**
 * **Ningún hook después de la guarda que hace `return null`.**
 *
 * Las seis pestañas del perfil comparten el mismo molde: un
 * `if (pestana !== "<la suya>") return null;` cerca del principio y el render
 * debajo. Un `useMemo` colocado DESPUÉS de esa línea se llama en unos renders y
 * en otros no, y eso es React #310 —«rendered more hooks than during the
 * previous render»—: no falla en la pestaña donde se escribió, falla al CAMBIAR
 * de pestaña, tumba la app entera y el error boundary tapa además las pestañas
 * siguientes, así que parece que se rompieron tres.
 *
 * Pasó el 2026-09-09 en `AulasPestanaRendimiento.tsx` y **la suite entera siguió
 * en verde**: 3 535 tests entonces, incluido uno recién escrito para ese mismo
 * panel. No lo vio porque un test de render pinta siempre con su pestaña
 * activa, y el conteo de hooks sólo cambia cuando el mismo componente se vuelve
 * a pintar con OTRA. Lo encontró el barrido en pantalla.
 *
 * Se mira el fuente y no el render porque el defecto es estructural: está o no
 * está, y verlo cuesta un `readFileSync` en vez de montar seis pestañas y
 * navegar entre ellas.
 */

const aulasDir = path.resolve(__dirname);
/** `useMemo(`, `useState(`, `useCallback(`… en llamada, no en un import. */
const LLAMADA_A_HOOK = /(?<![\w.])use[A-Z]\w*\s*\(/g;

/**
 * **Sin comentarios, o el guard grita en falso y acaba borrado.**
 *
 * La primera versión de este test acusó a `AulasPestanaCuotas.tsx` de llamar
 * `useTablasDeAvance` bajo su guarda. No lo llama: la línea 125 es un COMENTARIO
 * que lo menciona —«tabla `diario` con su propio `useTablasDeAvance()`»—. Este
 * perfil ya tiene un guard que aprendió lo mismo por su cuenta
 * (`cifrasConFormato.test.ts` separa prosa de código por el determinante), y un
 * detector que cría lobos es un detector que alguien silencia.
 */
function sinComentarios(fuente: string): string {
  return fuente
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

function hooksTrasLaGuarda(fuenteCruda: string): string[] {
  const fuente = sinComentarios(fuenteCruda);
  // La guarda canónica del molde: `if (pestana !== "x") return null;`
  const guarda = fuente.search(/if\s*\(\s*pestana\s*!==[^)]*\)\s*return null;/);
  if (guarda < 0) return [];
  const despues = fuente.slice(guarda);
  return [...despues.matchAll(LLAMADA_A_HOOK)].map((m) => m[0].replace(/\s*\($/, ""));
}

describe("las pestañas del perfil no llaman hooks después de su guarda", () => {
  const archivos = readdirSync(aulasDir).filter(
    (f) => f.startsWith("AulasPestana") && f.endsWith(".tsx") && !f.includes(".test."),
  );

  test("hay pestañas que revisar", () => {
    // Si el molde se renombra, este guard se apaga en silencio. Que falle.
    expect(archivos.length).toBeGreaterThanOrEqual(5);
  });

  test("ninguna llama un hook por debajo del `return null` de su guarda", () => {
    const culpables = archivos.flatMap((archivo) => {
      const hooks = hooksTrasLaGuarda(readFileSync(path.join(aulasDir, archivo), "utf8"));
      return hooks.length ? [`${archivo}: ${[...new Set(hooks)].join(", ")}`] : [];
    });
    expect(culpables).toEqual([]);
  });
});
