import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { ordenarPorCursosHorario } from "../ordenCategorias";

/**
 * G37 → G39 · «Las categorías con más cursos-horario van primero. En todas.»
 *
 * Gonzalo lo pidió tres veces, cada una viendo una superficie distinta que se
 * había quedado fuera:
 *
 *   1. La lista de conmutadores (G37).
 *   2. «En todos los criterios que lo tengan» — la radiografía de tipo de sesión
 *      ordenaba por alumnos elegibles y la tarjeta genérica no ordenaba (G39).
 *   3. «La mayor está al final cuando debería estar al principio» — la rejilla de
 *      tarjetas de esa misma radiografía, en el mismo archivo que la anterior.
 *
 * Tres avisos, la misma causa: reparar la superficie donde se reportó en vez de
 * enumerar la clase. Este contrato la enumera de una vez, así que una quinta
 * superficie que liste categorías sin usar la regla compartida sale roja aquí en
 * vez de en la pantalla de Gonzalo.
 */
const RAIZ = join(__dirname, "..", "..");
const SUPERFICIES = [
  "criterios/FacultadCategoriaToggles.tsx",
  "criterios/controles.tsx",
  "marco/exploradorModel.ts",
  "marco/TipoSesionRadiografia.tsx",
];

describe("el orden por cursos-horario vive en un solo sitio", () => {
  it.each(SUPERFICIES)("%s usa la regla compartida", (archivo) => {
    const src = readFileSync(join(RAIZ, archivo), "utf8");
    expect(src).toContain("ordenarPorCursosHorario");
  });

  it("ninguna superficie ordena categorías por su cuenta", () => {
    /*
     * Un `sort` propio sobre categorías es la forma en que la regla vuelve a
     * divergir: compila, se ve razonable, y ordena por otra cifra. La excepción
     * declarada es el propio módulo de la regla.
     */
    const sospechosos: string[] = [];
    for (const archivo of SUPERFICIES) {
      const src = readFileSync(join(RAIZ, archivo), "utf8");
      // `sort` sobre algo que parece una lista de categorías o tipos.
      if (/\b(categorias|categories|tipos|filas)\b[^\n]*\.sort\(/.test(src)) sospechosos.push(archivo);
    }
    expect(sospechosos).toEqual([]);
  });
});

describe("qué cifra manda", () => {
  it("ordena por los cursos-horario que la categoría TIENE", () => {
    // La distinción que hace estable la lista: si ordenara por los que siguen
    // incluidos, apagar una categoría la mandaría al fondo y la siguiente que
    // ibas a tocar ya no estaría donde la dejaste.
    const items = [
      { et: "chica", ch: 1 },
      { et: "grande", ch: 493 },
      { et: "media", ch: 38 },
    ];
    expect(ordenarPorCursosHorario(items, (i) => i.ch, (i) => i.et).map((i) => i.et))
      .toEqual(["grande", "media", "chica"]);
  });

  it("desempata por etiqueta, no por orden de llegada", () => {
    const items = [{ et: "zeta", ch: 5 }, { et: "alfa", ch: 5 }];
    expect(ordenarPorCursosHorario(items, (i) => i.ch, (i) => i.et).map((i) => i.et))
      .toEqual(["alfa", "zeta"]);
  });

  it("una cifra ausente pesa cero y no rompe el orden", () => {
    const items = [{ et: "sin", ch: null }, { et: "con", ch: 3 }];
    expect(ordenarPorCursosHorario(items, (i) => i.ch, (i) => i.et).map((i) => i.et))
      .toEqual(["con", "sin"]);
  });
});
