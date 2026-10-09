import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * **Ninguna lista de filas mide sus columnas fila a fila.**
 *
 * Cuando la rejilla se declara en el `li`, cada fila es un grid independiente y
 * su `auto` mide sólo SU texto. Basta un dígito de más para que todo lo que va
 * detrás se desplace, y las columnas que deberían leerse en vertical dejan de
 * coincidir. En un gráfico de barras es peor que estético: cuatro barras que no
 * comparten origen no se comparan a ojo, y la más corta se lee más larga de lo
 * que es.
 *
 * Ya existía un guard con esta misma forma —`anticipacionAlineada.contract`—
 * escrito cuando «Pedir» acabó empezando en cuatro x distintas (736, 727, 756 y
 * 703 px). Miraba UN selector. Este barre la hoja entera: el 2026-08-31 el
 * mismo patrón seguía vivo en la concentración de brecha, en las duraciones, en
 * el embudo del aula y en el desglose por filtro, cuatro sitios que nadie
 * comparaba con el que sí estaba protegido.
 *
 * Mira la CAUSA en la hoja y no el efecto: en jsdom no hay layout que medir.
 *
 * **Dos formas legítimas de resolverlo**, las dos aceptadas aquí:
 * - `display: contents` en el `li`, cuando la fila no tiene caja propia.
 * - `grid-template-columns: subgrid`, cuando sí la tiene (fondo, borde,
 *   padding): contents le quitaría la caja. La declaración anterior queda como
 *   fallback para un motor sin subgrid, y por eso el guard sólo mira la ÚLTIMA.
 */

const css = readFileSync(
  fileURLToPath(new URL("./aulasMonitoreo.css", import.meta.url)),
  "utf-8",
);

/**
 * Rejillas de TARJETAS, donde el `auto` por fila es correcto y deliberado.
 *
 * Un contenedor `repeat(auto-fit, …)` reparte tarjetas en varias columnas; dos
 * que caen lado a lado no tienen por qué compartir su reparto interno, y
 * forzarlo las estira a todo el ancho. La excepción se declara aquí y no se
 * infiere: que un selector desaparezca de esta lista tiene que costar una
 * decisión.
 */
const TARJETAS_NO_FILAS = new Set([".aulas-umbrales-celdas"]);

/**
 * Si una pista se dimensiona con el contenido de SU fila.
 *
 * No basta con mirar si empieza por `auto`: lo que manda es su MÁXIMO, y en
 * `minmax(120px, auto)` el máximo es el contenido igual que en un `auto` suelto.
 * Ésa era, además, la forma exacta del defecto que originó este guard —la
 * concentración de brecha declaraba `minmax(120px, auto)`—, así que un detector
 * que sólo mirase el prefijo habría dado verde sobre el caso que lo motivó.
 * Comprobado con un mutante: revertir esa regla tiene que ponerlo rojo.
 *
 * `minmax(0, 1fr)` y `minmax(150px, 1fr)` sí son comunes a todas las filas:
 * reparten el sobrante del contenedor, no miden texto.
 */
function dependeDeLaFila(pista: string): boolean {
  const p = pista.trim();
  const minmax = p.match(/^minmax\(([^,]+),(.+)\)$/);
  const maximo = (minmax ? minmax[2] : p).trim();
  return /^(auto|min-content|max-content|fit-content)\b/.test(maximo);
}

type Bloque = { selector: string; reparto: string };

function listasConRejillaEnLaFila(): Bloque[] {
  const out: Bloque[] = [];
  for (const m of css.matchAll(/([^\n{}]*\bli)\s*\{([^}]*)\}/g)) {
    const cuerpo = m[2];
    // La ÚLTIMA declaración es la que gana en cascada: una que empiece con el
    // reparto viejo y termine en `subgrid` está resuelta, no rota.
    const declaraciones = [...cuerpo.matchAll(/grid-template-columns:([^;]*);/g)];
    if (!declaraciones.length) continue;
    const reparto = declaraciones[declaraciones.length - 1][1].trim();
    if (reparto === "subgrid") continue;
    const pistas = reparto.split(/\s+(?![^(]*\))/);
    if (!pistas.some(dependeDeLaFila)) continue;
    // El nombre util es la ultima CLASE del selector, no la penultima palabra:
    // con `.x > ul > li` la penultima es «>» y el rojo no dice donde mirar.
    const clases = m[1].trim().match(/\.[A-Za-z0-9_-]+/g) ?? [];
    out.push({ selector: clases[clases.length - 1] ?? m[1].trim(), reparto });
  }
  return out;
}

describe("las listas del perfil de aulas alinean sus columnas entre filas", () => {
  it("la hoja se lee y trae rejillas que inspeccionar: sin esto el test no probaría nada", () => {
    expect(css.length).toBeGreaterThan(10_000);
    expect(css).toContain("grid-template-columns");
  });

  it("ninguna fila mide sus columnas con su propio texto", () => {
    const rotas = listasConRejillaEnLaFila().filter((b) => !TARJETAS_NO_FILAS.has(b.selector));
    // El mensaje lleva el reparto culpable: sin él, quien vea el rojo tiene que
    // volver a buscar cuál de las pistas era la mala.
    expect(rotas.map((b) => `${b.selector} → ${b.reparto}`)).toEqual([]);
  });

  it("las excepciones declaradas siguen siendo rejillas de tarjetas", () => {
    // Una excepción que deje de ser `auto-fit` ya no es una tarjeta: es una
    // fila, y entonces la exención la estaría protegiendo de su propio defecto.
    for (const sel of TARJETAS_NO_FILAS) {
      const contenedor = css.match(
        new RegExp(`\\${sel} \\{[^}]*grid-template-columns:([^;]*);`),
      );
      expect(contenedor, `${sel} ya no declara columnas`).not.toBeNull();
      expect(contenedor![1]).toMatch(/repeat\(\s*auto-fit/);
    }
  });
});
