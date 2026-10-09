import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

/**
 * **Un token que no existe no falla: deja el elemento transparente.**
 *
 * Medido el 2026-09-10 en «Rendimiento y efectividad»: el carril pedía
 * `var(--pulso-surface-sunken)` para su fondo. Ese token NO está declarado en
 * ninguna parte, así que la propiedad no resolvía, el carril se quedaba sin
 * fondo sobre el panel y en pantalla eran dos rayitas flotando en el aire, sin
 * regla ni escala. Ni el typecheck, ni los 3 103 tests, ni el build dijeron
 * nada — un `var()` que no resuelve es CSS perfectamente válido.
 *
 * Se mira el fuente porque el defecto es estático: el nombre está declarado o no
 * lo está, y comprobarlo cuesta leer dos ficheros en vez de montar la pantalla y
 * mirar un píxel.
 *
 * Sólo se exigen los `--pulso-*`, que son los del sistema. `--module-accent` lo
 * escribe el frame del módulo en runtime y `--aulas-*` la propia hoja del
 * perfil; los dos se usan SIEMPRE con respaldo, y eso es lo que este guard
 * comprueba de ellos.
 */

const aulasDir = path.resolve(__dirname);
const appDir = path.resolve(__dirname, "../../../../app");

/** Todas las hojas del frontend, para saber qué está declarado de verdad. */
function hojasDelFront(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return hojasDelFront(p);
    return e.name.endsWith(".css") ? [p] : [];
  });
}

/**
 * Los `--pulso-*` declarados en CUALQUIER hoja del frontend.
 *
 * No basta con `tokens.css` y `theme.css`: `--pulso-accent`, por ejemplo, lo
 * declara `monitoreo.css`. Mirar sólo los dos ficheros del sistema acusaría de
 * huérfanos a tokens que sí existen, y un detector que cría lobos acaba
 * silenciado.
 */
function tokensDeclarados(): Set<string> {
  const out = new Set<string>();
  for (const hoja of hojasDelFront(path.resolve(appDir, ".."))) {
    for (const m of readFileSync(hoja, "utf8").matchAll(/(--pulso-[\w-]+)\s*:/g)) out.add(m[1]);
  }
  return out;
}

/** Cada `var(--pulso-x)` de una hoja, con y sin respaldo. */
function tokensUsados(css: string): string[] {
  return [...css.matchAll(/var\(\s*(--pulso-[\w-]+)/g)].map((m) => m[1]);
}

describe("las hojas del perfil sólo piden tokens que existen", () => {
  const hojas = readdirSync(aulasDir).filter((f) => f.endsWith(".css"));
  const declarados = tokensDeclarados();

  test("los tokens del sistema se encuentran", () => {
    // Si `tokens.css` se mueve o cambia de forma, este guard se apagaría en
    // silencio y volvería a dejar pasar un `var()` que no resuelve.
    expect(declarados.size).toBeGreaterThan(100);
    expect(declarados.has("--pulso-text")).toBe(true);
  });

  test("hay hojas que revisar", () => {
    expect(hojas.length).toBeGreaterThanOrEqual(3);
  });

  /**
   * **TOPE, no cero.** Al escribir este guard aparecieron dieciocho tokens
   * huérfanos repartidos por nueve hojas del perfil, todos anteriores a él: son
   * elementos que hoy mismo se pintan sin el fondo o el color que su hoja pide,
   * en silencio. Arreglarlos exige mirar cada uno en pantalla y decidir a qué
   * token real corresponde, que es trabajo de varias sesiones.
   *
   * Lo que este número impide es que la cifra CREZCA, que es como llegó a ser
   * dieciocho. Es el mismo trato que el perfil ya le da al vocabulario de la
   * unidad. Al cerrar huérfanos, baja el TOPE.
   */
  // 2026-09-10: de 18 a 13. Se cerraron los seis `--pulso-border-soft` —el
  // token del perfil se llama `--pulso-border`— al rediseñar la tabla de
  // efectividad, y el `--pulso-warning` del panel de agendación, que es
  // `--pulso-warn-accent`.
  const TOPE = 13;

  test(`no supera los ${TOPE} tokens huérfanos medidos al escribir el guard`, () => {
    const culpables = hojas.flatMap((hoja) => {
      const css = readFileSync(path.join(aulasDir, hoja), "utf8");
      const faltan = [...new Set(tokensUsados(css))].filter((t) => !declarados.has(t));
      return faltan.map((t) => `${t} (${hoja})`);
    });
    expect(
      culpables.length,
      `El perfil pide ${culpables.length} tokens que nadie declara, y un \`var()\` que no resuelve no falla: deja el elemento sin ese color. Son: ${culpables.join(" · ")}. Si vienes de CERRAR huérfanos, baja TOPE a este número.`,
    ).toBeLessThanOrEqual(TOPE);
  });

  test("y ninguno de los huérfanos está en una hoja escrita hoy", () => {
    // El TOPE protege de la deuda vieja; esto, de añadir deuda nueva con la
    // excusa de que cabe bajo el tope.
    const nuevas = ["aulasRendimientoYEfectividad.css"];
    const culpables = nuevas.flatMap((hoja) => {
      if (!hojas.includes(hoja)) return [];
      const css = readFileSync(path.join(aulasDir, hoja), "utf8");
      return [...new Set(tokensUsados(css))].filter((t) => !declarados.has(t)).map((t) => `${hoja}: ${t}`);
    });
    expect(culpables).toEqual([]);
  });

  test("`--module-*` y `--aulas-*` se piden siempre con respaldo", () => {
    // No están en `tokens.css` —los escribe el frame del módulo o la hoja del
    // perfil— así que su garantía no es existir, es tener a qué caer.
    const culpables = hojas.flatMap((hoja) => {
      const css = readFileSync(path.join(aulasDir, hoja), "utf8");
      const sinRespaldo = [...css.matchAll(/var\(\s*(--(?:module|aulas)-[\w-]+)\s*\)/g)]
        .map((m) => m[1]);
      // Los `--aulas-*` que declara el perfil sí pueden ir a pelo. Y no sólo en
      // sus hojas: varios son variables de INSTANCIA que el componente escribe
      // en el elemento (`style={{ "--aulas-eslabones": n }}`), así que hay que
      // mirar también los `.tsx` o el guard acusaría de huérfano a un token que
      // se define una línea antes de usarse.
      const propios = new Set(
        readdirSync(aulasDir)
          .filter((f) => f.endsWith(".css") || f.endsWith(".tsx"))
          .flatMap((f) => [...readFileSync(path.join(aulasDir, f), "utf8")
            // En CSS es `--x:`; en TSX el nombre va entrecomillado, y a veces
            // dentro de un índice calculado —`["--x" as string]:`—, así que
            // cualquier aparición entre comillas cuenta como declaración.
            .matchAll(/(?:"(--aulas-[\w-]+)"|(--aulas-[\w-]+)\s*:)/g)]
            .map((m) => m[1] ?? m[2])),
      );
      const malos = [...new Set(sinRespaldo)].filter((t) => !propios.has(t));
      return malos.length ? [`${hoja}: ${malos.join(", ")}`] : [];
    });
    expect(culpables).toEqual([]);
  });
});
