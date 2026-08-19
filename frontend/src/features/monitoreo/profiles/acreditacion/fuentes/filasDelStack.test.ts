import { describe, expect, test } from "vitest";
import fs from "node:fs";
import path from "node:path";

// `.fuentes-resumen-stack` reparte el alto entre EXACTAMENTE dos filas
// (`grid-template-rows: auto minmax(0, 1fr)`). La pestaña «Fuentes y universo»
// reunió tres bloques bajo la franja de estado —resumen, universo y fichas— y
// pasó a tener CUATRO hijos sin que la plantilla cambiara.
//
// Medido en acrconta: `grid-template-rows: 38px 0px 0px 1879px` a 1440x1000 y
// `65px 0px 0px 2644px` a 1024x600. El resumen (13 fuentes en tres tarjetas más
// la cobertura por actor) y el universo (4 padrones con sus botones) se
// dibujaban a CERO píxeles —montados, `checkVisibility()` en true, y ni un
// píxel en pantalla—. Quedaba sólo el tercer bloque, el de declarar; el propio
// comentario del código promete «primero se lee el inventario, después se
// declara» y el inventario no existía.
//
// Ningún test ni el gate visual lo veían: los nodos están en el DOM y son
// «visibles» para CSS.

const raiz = path.resolve(__dirname, "..");
const tsx = fs.readFileSync(path.join(raiz, "AcreditacionMonitoreoPage.tsx"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "fuentes.css"), "utf8");

/** Hijos JSX directos de cada `<div className="… fuentes-resumen-stack …">`. */
function usosDelStack() {
  const usos: Array<{ clases: string; hijos: number }> = [];
  const apertura = /<div className="([^"]*fuentes-resumen-stack[^"]*)">/g;
  for (let m = apertura.exec(tsx); m; m = apertura.exec(tsx)) {
    let i = m.index + m[0].length;
    let profundidad = 1;
    let hijos = 0;
    while (i < tsx.length && profundidad > 0) {
      const c = tsx[i];
      if (c === "<") {
        if (tsx.startsWith("</", i)) profundidad -= 1;
        else {
          if (profundidad === 1) hijos += 1;
          const cierre = tsx.indexOf(">", i);
          if (tsx[cierre - 1] !== "/") profundidad += 1;
          i = cierre;
        }
      } else if (c === "{" && profundidad === 1) {
        // `{sourceStatus}` y demás expresiones también ocupan una fila.
        hijos += 1;
        i = tsx.indexOf("}", i);
      }
      i += 1;
    }
    usos.push({ clases: m[1], hijos });
  }
  return usos;
}

describe("la plantilla de filas alcanza para todos los hijos del stack", () => {
  test("la base declara dos filas", () => {
    // Si alguien le añade filas a la base, este test cae y hay que revisar la
    // cuenta de abajo: es la premisa de todo lo demás.
    expect(css).toMatch(/\.mon-profile-stack\.fuentes-resumen-stack \{[^}]*grid-template-rows: auto minmax\(0, 1fr\);/);
  });

  test("todo stack con más de dos hijos lleva la variante de filas intrínsecas", () => {
    const sinVariante = usosDelStack()
      .filter((uso) => uso.hijos > 2 && !uso.clases.includes("is-inventario"))
      .map((uso) => `${uso.clases} → ${uso.hijos} hijos`);
    expect(sinVariante).toEqual([]);
  });

  test("la variante existe y dimensiona las filas por contenido", () => {
    expect(css).toMatch(
      /\.mon-profile-stack\.fuentes-resumen-stack\.is-inventario \{[^}]*grid-auto-rows: min-content;/,
    );
  });

  test("se encontraron los dos usos del stack", () => {
    // Un cambio de markup que rompa el parseo dejaría la lista vacía y los dos
    // tests de arriba pasarían sin comprobar nada.
    const usos = usosDelStack();
    expect(usos.length).toBe(2);
    expect(usos.map((u) => u.hijos).sort()).toEqual([2, 4]);
  });
});
